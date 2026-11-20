import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, ReadNight, RunStatus } from './types.js';

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

type Event = {
  at: string;
  instant: number;
  submillis: string;
  job: string;
  owner: string | null;
  status: RunStatus;
  error?: string;
};

function parseEvent(line: string): Event | null {
  let input: unknown;
  try {
    input = JSON.parse(line);
  } catch {
    return null;
  }
  if (!input || typeof input !== 'object') return null;
  const { at, job, owner, status, error } = input as Record<string, unknown>;
  if (
    typeof at !== 'string' || typeof job !== 'string' || !job.trim() ||
    (owner !== null && typeof owner !== 'string') ||
    (status !== 'ok' && status !== 'retry' && status !== 'fail') ||
    (error !== undefined && typeof error !== 'string')
  ) return null;

  const time = /^(\d{4}-\d{2}-\d{2})T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.(\d+))?(?:Z|[+-]\d{2}:\d{2})$/i.exec(at);
  if (!time || !validDate(time[1])) return null;
  const instant = Date.parse(at);
  if (!Number.isFinite(instant)) return null;
  const submillis = (time[2] ?? '').slice(3).replace(/0+$/, '');
  return { at, instant, submillis, job, owner, status, error };
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export const readNight: ReadNight = (runsDir, night) => {
  if (!validDate(night)) return null;
  let log: string;
  try {
    log = readFileSync(join(runsDir, night + '.jsonl'), 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }

  const events: Event[] = [];
  let badLines = 0;
  const lines = log.split('\n');
  if (lines.at(-1) === '') lines.pop();
  for (const line of lines) {
    const event = parseEvent(line);
    if (event) events.push(event);
    else badLines++;
  }

  // Stable sort keeps file order for events at the same instant.
  events.sort((a, b) => a.instant - b.instant || compareText(a.submillis, b.submillis));
  const jobs = new Map<string, DigestRow>();
  const counts = { ok: 0, retry: 0, fail: 0 };
  for (const event of events) {
    counts[event.status]++;
    const row = jobs.get(event.job) ?? {
      job: event.job, firstAt: event.at, runs: 0, retries: 0, lastError: null,
      lastAt: event.at, owner: event.owner, lastStatus: event.status,
    };
    row.runs++;
    if (event.status === 'retry') row.retries++;
    if (event.error !== undefined) row.lastError = event.error;
    row.lastAt = event.at;
    row.owner = event.owner;
    row.lastStatus = event.status;
    jobs.set(event.job, row);
  }
  const rows = [...jobs.values()].sort((a, b) => compareText(a.job, b.job));
  return { rows, badLines, counts };
};
