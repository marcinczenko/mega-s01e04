/** A valid run-log event has exactly one of these statuses. */
export type RunStatus = 'ok' | 'retry' | 'fail';

/** Counts of valid events, not counts of jobs or their final statuses. */
export type StatusCounts = Record<RunStatus, number>;

/** One job's events, ordered by instant; equal instants retain file order. */
export type DigestRow = {
  job: string;
  /** Owner on the latest event, including null; views display null as “—”. */
  owner: string | null;
  /** All valid events for this job, including retry and fail events. */
  runs: number;
  /** Number of retry events. Views flag retries >= 3. */
  retries: number;
  /** Number of fail events. Views flag any failures, even after recovery. */
  failures: number;
  lastStatus: RunStatus;
  /** Latest nonempty error in event order; retained after success, else null. */
  lastError: string | null;
  /** Earliest/latest event timestamps verbatim, preserving the log's offset. */
  firstAt: string;
  lastAt: string;
};

export type NightDigest = {
  found: true;
  night: string;
  /** Ascending job names by JS string comparison, independent of locale. */
  rows: DigestRow[];
  /** Nonblank lines with invalid JSON or an invalid event shape. */
  badLines: number;
  counts: StatusCounts;
};

export type MissingNight = {
  found: false;
  night: string;
};

export type ReadNightResult = NightDigest | MissingNight;

/**
 * Contract for readNight, implemented and exported by src/digest/reader.ts.
 *
 * Reads runsDir/<night>.jsonl synchronously. A night must match YYYY-MM-DD;
 * invalid names and ENOENT return { found: false, night } (routes return 404).
 * Other filesystem errors propagate rather than masquerading as an empty night.
 * A present empty/blank-only file returns found: true, rows: [], badLines: 0,
 * and counts: { ok: 0, retry: 0, fail: 0 }; views render “nothing ran”.
 *
 * Ignore blank lines. Every other line must decode to a non-array object with
 * a nonempty job string, a timezone-bearing ISO timestamp `at` representing a
 * valid instant, a RunStatus `status`, and an `owner` that is a string or null.
 * Optional `error` must be a string when present; extra fields are ignored.
 * Count an invalid line once in badLines and exclude it from rows and counts.
 * Trim only to test blankness; preserve valid field values and time offsets.
 *
 * Group by exact job name. Compare timestamps by instant, not their strings;
 * ties use file order (earliest first, latest last). lastError is the latest
 * error whose trimmed value is nonempty, preserving its original text.
 * Sort rows by job using < / >, without localeCompare. counts sums all valid
 * events, so counts.ok + counts.retry + counts.fail equals sum(row.runs).
 * Both HTML and JSON consume this result; neither re-aggregates the log.
 */
export type ReadNight = (runsDir: string, night: string) => ReadNightResult;
