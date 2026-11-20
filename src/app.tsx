import { Hono } from 'hono';
import { loadConfig, type RigConfig } from './config.js';
import { registerDigestApi } from './digest/api.js';
import { registerDigestPage } from './digest/page.js';
import { readNight } from './digest/read-night.js';
import { lane } from './lane.js';
import { readStatus } from './status.js';
import { Layout } from './views/layout.js';
import { StatusBoard } from './views/status.js';

export function createApp(config: RigConfig = loadConfig()) {
  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true, lane: lane().id }));

  app.get('/', (c) =>
    c.html(
      <Layout title="status" lane={lane()}>
        <StatusBoard status={readStatus(config, readNight)} />
      </Layout>,
    ),
  );

  registerDigestPage(app, config.runsDir, readNight);
  registerDigestApi(app, config.runsDir, readNight);

  return app;
}
