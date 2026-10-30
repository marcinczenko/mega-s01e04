import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/reader.js';

const night = '2026-10-28';
const valid = { at: '2026-10-28T23:00:00+01:00', job: 'job', status: 'ok', owner: null };
let runsDir: string;

beforeEach(() => { runsDir = mkdtempSync(join(tmpdir(), 'rig-reader-')); });
afterEach(() => { rmSync(runsDir, { recursive: true, force: true }); });

function writeEvents(events: unknown[]) {
  writeFileSync(join(runsDir, `${night}.jsonl`), events.map((event) => JSON.stringify(event)).join('\n'));
}

describe('readNight', () => {
  it('reads the supplied night without changing its fixtures', () => {
    const result = readNight(new URL('../runs/', import.meta.url).pathname, night);
    expect(result.found).toBe(true);
    if (!result.found) throw new Error('Sample night missing');
    expect(result.rows.map((row) => row.job)).toEqual([
      'digest/render', 'fixtures/refresh', 'lane/sync', 'notes/backup', 'rig/rotate-logs',
    ]);
    expect(result.badLines).toBe(1);
    expect(result.counts).toEqual({ ok: 10, retry: 4, fail: 1 });
    expect(result.rows.reduce((total, row) => total + row.runs, 0)).toBe(15);
    expect(result.rows[0].owner).toBeNull();
    expect(result.rows[1]).toMatchObject({ runs: 4, retries: 3, lastStatus: 'ok', lastError: 'upstream 503' });
    expect(result.rows[3]).toMatchObject({ failures: 1, lastStatus: 'fail', lastError: 'quota exceeded' });
  });

  it.each(['', '2026-10', '../2026-10-28', '2026-10-28.jsonl', '/2026-10-28', '2026-10-28\n'])('rejects invalid night %j', (name) => {
    expect(readNight(runsDir, name)).toEqual({ found: false, night: name });
  });

  it('distinguishes missing files from other filesystem errors', () => {
    expect(readNight(runsDir, night)).toEqual({ found: false, night });
    mkdirSync(join(runsDir, `${night}.jsonl`));
    expect(() => readNight(runsDir, night)).toThrow();
  });

  it.each(['', ' \n\t\r\n\n'])('returns an empty digest for blank contents', (contents) => {
    writeFileSync(join(runsDir, `${night}.jsonl`), contents);
    expect(readNight(runsDir, night)).toEqual({
      found: true, night, rows: [], badLines: 0, counts: { ok: 0, retry: 0, fail: 0 },
    });
  });

  it('counts invalid JSON and event shapes once each and keeps valid rows', () => {
    const invalid = [
      null, [], 'string', 7, {},
      { ...valid, job: '' }, { ...valid, job: ' \t' }, { ...valid, job: 7 },
      { ...valid, owner: undefined }, { ...valid, owner: 7 },
      { ...valid, status: ['ok'] }, { ...valid, status: 'unknown' },
      { ...valid, error: null }, { ...valid, error: 3 },
      { ...valid, at: 7 }, { ...valid, at: 'yesterday' },
      { ...valid, at: '2026-10-28T23:00:00' },
    ];
    writeFileSync(join(runsDir, `${night}.jsonl`), [
      '{broken', ...invalid.map((event) => JSON.stringify(event)), '', '  ',
      JSON.stringify({ ...valid, job: ' job ', owner: '', error: ' ', extra: true }),
    ].join('\r\n'));
    const result = readNight(runsDir, night);
    expect(result).toMatchObject({ found: true, badLines: invalid.length + 1, counts: { ok: 1, retry: 0, fail: 0 } });
    if (!result.found) throw new Error('Fixture missing');
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ job: ' job ', owner: '', lastError: null });
  });

  it.each([
    '2026-02-29T12:00:00Z', '2024-02-30T12:00:00Z', '2026-04-31T12:00:00Z',
    '2026-00-01T12:00:00Z', '2026-13-01T12:00:00Z', '2026-10-00T12:00:00Z',
    '2026-10-28T25:00:00Z', '2026-10-28T12:60:00Z', '2026-10-28T12:00:60Z',
    '2026-10-28T12:00:00+24:00', '2026-10-28T12:00:00+01:60',
    '2026-10-28T12:00:00Z junk', ' 2026-10-28T12:00:00Z', '2026-10-28T12:00:00Z\n',
  ])('rejects invalid timestamp %s', (at) => {
    writeEvents([{ ...valid, at }]);
    expect(readNight(runsDir, night)).toMatchObject({ found: true, rows: [], badLines: 1, counts: { ok: 0, retry: 0, fail: 0 } });
  });

  it('accepts leap days and preserves valid timestamps verbatim', () => {
    const at = '2024-02-29T12:00:00.1234-03:30';
    writeEvents([{ ...valid, at }]);
    expect(readNight(runsDir, night)).toMatchObject({ found: true, badLines: 0, rows: [{ firstAt: at, lastAt: at }] });
  });

  it('orders by instant and file-order ties, retaining a failure and error after recovery', () => {
    writeEvents([
      { ...valid, at: '2026-10-29T01:00:00+02:00', owner: 'later', error: '  retained error  ', status: 'fail' },
      { ...valid, at: '2026-10-29T00:30:00+02:00', owner: 'earlier', error: 'old error', status: 'retry' },
      { ...valid, at: '2026-10-28T23:00:00Z', owner: null, error: ' \t' },
    ]);
    expect(readNight(runsDir, night)).toEqual({
      found: true, night, badLines: 0, counts: { ok: 1, retry: 1, fail: 1 },
      rows: [{
        job: 'job', owner: null, runs: 3, retries: 1, failures: 1,
        lastStatus: 'ok', lastError: '  retained error  ',
        firstAt: '2026-10-29T00:30:00+02:00', lastAt: '2026-10-28T23:00:00Z',
      }],
    });
  });

  it('orders fractional instants without rounding away sub-millisecond differences', () => {
    writeEvents([
      { ...valid, at: '2026-10-28T23:00:00.0002Z', owner: 'last' },
      { ...valid, at: '2026-10-28T23:00:00.00010Z', owner: 'first', status: 'fail' },
    ]);
    expect(readNight(runsDir, night)).toMatchObject({ rows: [{
      owner: 'last', lastStatus: 'ok', failures: 1,
      firstAt: '2026-10-28T23:00:00.00010Z', lastAt: '2026-10-28T23:00:00.0002Z',
    }] });
  });

  it('groups exact job names safely and sorts independently of locale', () => {
    writeEvents(['ä', 'a', 'Z', '__proto__', ' a', 'a'].map((job) => ({ ...valid, job })));
    const result = readNight(runsDir, night);
    if (!result.found) throw new Error('Fixture missing');
    expect(result.rows.map((row) => row.job)).toEqual([' a', 'Z', '__proto__', 'a', 'ä']);
    expect(result.rows.find((row) => row.job === 'a')?.runs).toBe(2);
  });
});
