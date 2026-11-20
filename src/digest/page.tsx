import type { Hono } from 'hono';
import { lane } from '../lane.js';
import { Layout } from '../views/layout.js';
import type { ReadNight } from './types.js';
import { DigestView } from '../views/digest.js';

export function registerDigestPage(app: Hono, runsDir: string, readNight: ReadNight) {
  app.get('/digest/:night', (c) => {
    const night = c.req.param('night');
    const digest = readNight(runsDir, night);
    if (digest === null) return c.notFound();

    return c.html(
      <Layout title={`digest · ${night}`} lane={lane()}>
        <DigestView night={night} digest={digest} />
      </Layout>,
    );
  });
}
