import type { Hono } from 'hono';
import { readNight } from './reader.js';
import type { RigConfig } from '../config.js';
import { Layout } from '../views/layout.js';
import { DigestPage } from '../views/digest.js';
import { lane } from '../lane.js';

export function registerDigestPageRoute(app: Hono, config: RigConfig): void {
  app.get('/digest/:night', (c) => {
    const digest = readNight(config.runsDir, c.req.param('night'));
    if (!digest.found) return c.notFound();

    return c.html(
      <Layout title={`digest · ${digest.night}`} lane={lane()}>
        <DigestPage digest={digest} />
      </Layout>,
    );
  });
}
