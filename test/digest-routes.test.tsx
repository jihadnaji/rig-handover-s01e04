import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const tempDirs: string[] = [];

function makeRunsDir() {
  const dir = mkdtempSync(join(tmpdir(), 'rig-digest-routes-'));
  tempDirs.push(dir);
  return dir;
}

function writeNight(runsDir: string, night: string, lines: string[]) {
  writeFileSync(join(runsDir, `${night}.jsonl`), lines.join('\n'));
}

function appFor(runsDir: string) {
  return createApp({
    adapter: 'shim',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    runsDir,
  });
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('digest routes', () => {
  it('serves sorted rows on the page and as the same JSON digest', async () => {
    const runsDir = makeRunsDir();
    const night = '2026-10-29';
    writeNight(runsDir, night, [
      JSON.stringify({ at: '2026-10-29T02:00:00Z', job: 'zeta/job', status: 'ok', owner: 'Zoe' }),
      JSON.stringify({ at: '2026-10-29T01:00:00Z', job: 'alpha/job', status: 'retry', owner: 'Ari' }),
    ]);

    const app = appFor(runsDir);
    const [page, api] = await Promise.all([
      app.request(`/digest/${night}`),
      app.request(`/api/digest/${night}`),
    ]);
    const html = await page.text();

    expect(page.status).toBe(200);
    expect(api.status).toBe(200);
    const digest = await api.json();
    expect(digest).toMatchObject({
      rows: [
        { job: 'alpha/job' },
        { job: 'zeta/job' },
      ],
    });
    expect(html.indexOf('alpha/job')).toBeLessThan(html.indexOf('zeta/job'));
    expect(html).toContain('alpha/job');
    expect(html).toContain('zeta/job');
  });

  it('returns 404 for a night with no file on both routes', async () => {
    const app = appFor(makeRunsDir());

    const [page, api] = await Promise.all([
      app.request('/digest/2026-10-30'),
      app.request('/api/digest/2026-10-30'),
    ]);

    expect(page.status).toBe(404);
    expect(api.status).toBe(404);
  });

  it('renders an empty night and returns empty JSON rows', async () => {
    const runsDir = makeRunsDir();
    const night = '2026-10-31';
    writeNight(runsDir, night, []);
    const app = appFor(runsDir);

    const [page, api] = await Promise.all([
      app.request(`/digest/${night}`),
      app.request(`/api/digest/${night}`),
    ]);

    expect(page.status).toBe(200);
    expect(await page.text()).toContain('nothing ran');
    expect(api.status).toBe(200);
    expect(await api.json()).toMatchObject({ rows: [] });
  });

  it('renders valid rows when a line is malformed and counts the bad line in JSON', async () => {
    const runsDir = makeRunsDir();
    const night = '2026-11-01';
    writeNight(runsDir, night, [
      JSON.stringify({ at: '2026-11-01T01:00:00Z', job: 'good/job', status: 'ok', owner: null }),
      '{malformed json',
    ]);
    const app = appFor(runsDir);

    const [page, api] = await Promise.all([
      app.request(`/digest/${night}`),
      app.request(`/api/digest/${night}`),
    ]);
    const html = await page.text();

    expect(page.status).toBe(200);
    expect(html).toContain('good/job');
    expect(api.status).toBe(200);
    const digest = await api.json();
    expect(digest).toMatchObject({ badLines: 1, rows: [{ job: 'good/job' }] });
  });
});
