import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { readNight } from '../src/digest/read-night.js';

const night = '2026-10-28';
const tempDirs: string[] = [];

function withLog(content: string) {
  const dir = mkdtempSync(join(tmpdir(), 'digest-reader-'));
  tempDirs.push(dir);
  writeFileSync(join(dir, night + '.jsonl'), content);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true });
});

it('summarizes the October 28 run log', () => {
  const digest = readNight('runs', night);
  expect(digest?.badLines).toBe(1);
  expect(digest?.counts).toEqual({ ok: 10, retry: 4, fail: 1 });
  expect(digest?.rows.map(row => row.job)).toEqual([
    'digest/render', 'fixtures/refresh', 'lane/sync', 'notes/backup', 'rig/rotate-logs',
  ]);
  expect(digest?.rows[0].owner).toBeNull();
  expect(digest?.rows[1]).toEqual({
    job: 'fixtures/refresh', runs: 4, retries: 3, owner: 'rook', lastStatus: 'ok',
    lastError: 'upstream 503', firstAt: '2026-10-29T01:30:00+01:00', lastAt: '2026-10-29T01:37:00+01:00',
  });
});

it('distinguishes an empty file, a missing file and invalid night names', () => {
  const dir = withLog('');
  expect(readNight(dir, night)).toEqual({ rows: [], counts: { ok: 0, retry: 0, fail: 0 }, badLines: 0 });
  expect(readNight(dir, '2026-10-29')).toBeNull();
  expect(readNight(dir, '../' + basename(dir) + '/' + night)).toBeNull();
  writeFileSync(join(dir, '2026-02-30.jsonl'), '');
  expect(readNight(dir, '2026-02-30')).toBeNull();
});

const base = { job: 'task', status: 'ok', at: '2026-10-28T14:00:00+02:00', owner: 'first' };

it('orders instants across offsets and breaks ties in file order', () => {
  const entries = [
    { ...base, at: '2026-10-28T12:30:00Z', status: 'retry', error: 'later' },
    { ...base, status: 'fail', error: 'earlier' },
    { ...base, at: '2026-10-28T13:30:00+01:00', owner: null },
  ];
  const dir = withLog(entries.map(entry => JSON.stringify(entry)).join('\n'));
  expect(readNight(dir, night)?.rows).toEqual([{
    job: 'task', runs: 3, retries: 1, firstAt: base.at, lastAt: entries[2].at,
    owner: null, lastStatus: 'ok', lastError: 'later',
  }]);
});

it('counts each malformed physical line and continues reading', () => {
  const invalid = ['null', '{', '', '[]', ...[
    { ...base, status: 'other' }, { ...base, owner: undefined }, { ...base, at: 'tomorrow' },
    { ...base, job: 42 }, { ...base, error: 5 },
  ].map(entry => JSON.stringify(entry))];
  const dir = withLog([...invalid, JSON.stringify(base), ''].join('\r\n'));
  expect(readNight(dir, night)).toMatchObject({ badLines: invalid.length, counts: { ok: 1, fail: 0, retry: 0 } });
});
