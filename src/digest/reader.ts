import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, ReadNight, RunStatus, StatusCounts } from './types.js';

type RunEvent = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
  second: number;
  fraction: string;
};

function parseEvent(line: string): RunEvent | null {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const event = value as Record<string, unknown>;
  if (
    typeof event.job !== 'string' || event.job.trim() === '' ||
    typeof event.at !== 'string' ||
    (event.status !== 'ok' && event.status !== 'retry' && event.status !== 'fail') ||
    (event.owner !== null && typeof event.owner !== 'string') ||
    ('error' in event && typeof event.error !== 'string')
  ) return null;

  // Validate calendar components before parsing: Date.parse normalizes February 30.
  const timestamp = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?(Z|[+-]\d{2}:\d{2})$/.exec(event.at);
  if (!timestamp || timestamp[0] !== event.at) return null;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, fraction, zone] = timestamp;
  const [year, month, day, hour, minute, second] =
    [yearText, monthText, dayText, hourText, minuteText, secondText ?? '0'].map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (
    month < 1 || month > 12 || day < 1 || day > days[month - 1] ||
    hour > 23 || minute > 59 || second > 59 ||
    (zone !== 'Z' && (Number(zone.slice(1, 3)) > 23 || Number(zone.slice(4)) > 59))
  ) return null;
  const instant = Date.parse(`${yearText}-${monthText}-${dayText}T${hourText}:${minuteText}:${secondText ?? '00'}${zone}`);
  if (!Number.isFinite(instant)) return null;

  return {
    at: event.at,
    job: event.job,
    status: event.status,
    owner: event.owner,
    error: event.error as string | undefined,
    second: instant,
    fraction: fraction ?? '',
  };
}

function compareEvents(a: RunEvent, b: RunEvent): number {
  if (a.second !== b.second) return a.second - b.second;
  // Preserve sub-millisecond order too, without rounding fractional seconds.
  const width = Math.max(a.fraction.length, b.fraction.length);
  const left = a.fraction.padEnd(width, '0');
  const right = b.fraction.padEnd(width, '0');
  return left < right ? -1 : left > right ? 1 : 0;
}

export const readNight: ReadNight = (runsDir, night) => {
  if (night.length !== 10 || !/^\d{4}-\d{2}-\d{2}$/.test(night)) return { found: false, night };
  let contents: string;
  try {
    contents = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return { found: false, night };
    }
    throw error;
  }

  const jobs = new Map<string, RunEvent[]>();
  const counts: StatusCounts = { ok: 0, retry: 0, fail: 0 };
  let badLines = 0;
  for (const line of contents.split(/\r?\n/)) {
    if (line.trim() === '') continue;
    const event = parseEvent(line);
    if (!event) {
      badLines++;
      continue;
    }
    counts[event.status]++;
    const events = jobs.get(event.job) ?? [];
    events.push(event);
    jobs.set(event.job, events);
  }

  const rows: DigestRow[] = [];
  for (const [job, events] of jobs) {
    // Array.sort is stable: equal instants retain the original file order.
    events.sort(compareEvents);
    const first = events[0];
    const last = events[events.length - 1];
    let lastError: string | null = null;
    for (const event of events) {
      if (event.error?.trim()) lastError = event.error;
    }
    rows.push({
      job,
      owner: last.owner,
      runs: events.length,
      retries: events.filter((event) => event.status === 'retry').length,
      failures: events.filter((event) => event.status === 'fail').length,
      lastStatus: last.status,
      lastError,
      firstAt: first.at,
      lastAt: last.at,
    });
  }
  rows.sort((a, b) => a.job < b.job ? -1 : a.job > b.job ? 1 : 0);
  return { found: true, night, rows, badLines, counts };
};
