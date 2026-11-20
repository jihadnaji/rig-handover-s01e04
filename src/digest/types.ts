export type RunStatus = 'ok' | 'retry' | 'fail';

export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: RunStatus;
  lastError: string | null;
  firstAt: string;
  lastAt: string;
};

export type DigestNight = {
  /** Rows sorted by job in ascending order. */
  rows: DigestRow[];
  badLines: number;
  /** Counts of accepted log entries, before grouping by job. */
  counts: Record<RunStatus, number>;
};

/** Returns null for a missing night and an empty digest for an empty file. */
export type ReadNight = (runsDir: string, night: string) => DigestNight | null;
