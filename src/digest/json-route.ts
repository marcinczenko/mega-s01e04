import type { Hono } from 'hono';
import type { RigConfig } from '../config.js';
import { readNight } from './reader.js';

/** Register the machine-readable digest endpoint. */
export function registerJsonRoute(app: Hono, config: RigConfig): void {
  app.get('/api/digest/:night', (c) => {
    const result = readNight(config.runsDir, c.req.param('night'));
    return c.json(result, result.found ? 200 : 404);
  });
}
