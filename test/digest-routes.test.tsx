import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const night = '2026-10-28';
const config = (runsDir: string) => ({
  adapter: 'shim',
  installed: '2026-10-29T14:06:00+01:00',
  beatEverySeconds: 60,
  runsDir,
});

let runsDir: string;

beforeEach(async () => {
  runsDir = await mkdtemp(join(tmpdir(), 'rig-digest-routes-'));
});

afterEach(async () => {
  await rm(runsDir, { recursive: true, force: true });
});

async function writeNight(contents: string): Promise<void> {
  await writeFile(join(runsDir, `${night}.jsonl`), contents, 'utf8');
}

describe('digest routes', () => {
  it('returns the same sorted rows and fields as HTML and JSON', async () => {
    await writeNight([
      // Deliberately write events out of time order; the digest orders by instant.
      JSON.stringify({ at: '2026-10-28T10:30:00+01:00', job: 'a&<job>', status: 'ok', owner: null }),
      JSON.stringify({ at: '2026-10-28T08:30:00Z', job: 'a&<job>', status: 'fail', owner: 'ops', error: 'failed <stage> & "quoted"' }),
      JSON.stringify({ at: '2026-10-28T10:20:00+02:00', job: 'a&<job>', status: 'retry', owner: 'ops' }),
      'this is not JSON',
      JSON.stringify({ at: '2026-10-28T10:10:00+02:00', job: 'a&<job>', status: 'retry', owner: 'ops' }),
      JSON.stringify({ at: '2026-10-28T11:00:00+01:00', job: 'z-job', status: 'ok', owner: 'R&D <team>' }),
      JSON.stringify({ at: '2026-10-28T10:00:00+02:00', job: 'a&<job>', status: 'retry', owner: 'ops' }),
      JSON.stringify({ at: 'not-a-date', job: 'bad-shape', status: 'ok', owner: 'ops' }),
      '',
    ].join('\n'));

    const app = createApp(config(runsDir));
    const [page, json] = await Promise.all([
      app.request(`/digest/${night}`),
      app.request(`/api/digest/${night}`),
    ]);

    expect(page.status).toBe(200);
    expect(json.status).toBe(200);

    const html = await page.text();
    const payload: unknown = await json.json();
    expect(payload).toEqual({
      found: true,
      night,
      badLines: 2,
      counts: { ok: 2, retry: 3, fail: 1 },
      rows: [
        {
          job: 'a&<job>',
          owner: null,
          runs: 5,
          retries: 3,
          failures: 1,
          lastStatus: 'ok',
          lastError: 'failed <stage> & "quoted"',
          firstAt: '2026-10-28T10:00:00+02:00',
          lastAt: '2026-10-28T10:30:00+01:00',
        },
        {
          job: 'z-job',
          owner: 'R&D <team>',
          runs: 1,
          retries: 0,
          failures: 0,
          lastStatus: 'ok',
          lastError: null,
          firstAt: '2026-10-28T11:00:00+01:00',
          lastAt: '2026-10-28T11:00:00+01:00',
        },
      ],
    });

    // The page reflects those exact JSON rows in the same order and escapes data as HTML.
    expect(html.indexOf('a&amp;&lt;job&gt;')).toBeLessThan(html.indexOf('z-job'));
    expect(html).toContain('R&amp;D &lt;team&gt;');
    expect(html).toContain('failed &lt;stage&gt; &amp; &quot;quoted&quot;');
    expect(html).not.toContain('<job>');
    expect(html).not.toContain('<stage>');
    expect(html).toContain('<td>5</td>');
    expect(html).toContain('<td>ok</td>');

    // Three retries and one failure are highlighted, even though the final status recovered.
    expect(html).toContain('<span class="warn">3 ⚠</span>');
    expect(html).toContain('<span class="warn">1 ⚠</span>');
    expect(html).toContain('—');
    expect(html).toContain('2026-10-28T10:00:00+02:00');
    expect(html).toContain('2026-10-28T10:30:00+01:00');
  });

  it('returns 404 for a night with no file', async () => {
    const app = createApp(config(runsDir));
    const [page, json] = await Promise.all([
      app.request(`/digest/${night}`),
      app.request(`/api/digest/${night}`),
    ]);

    expect(page.status).toBe(404);
    expect(json.status).toBe(404);
    expect(await json.json()).toEqual({ found: false, night });
  });

  it('renders an existing empty night as nothing ran', async () => {
    await writeNight('  \n\t\n');
    const app = createApp(config(runsDir));
    const [page, json] = await Promise.all([
      app.request(`/digest/${night}`),
      app.request(`/api/digest/${night}`),
    ]);

    expect(page.status).toBe(200);
    expect(json.status).toBe(200);
    expect(await page.text()).toContain('nothing ran');
    expect(await json.json()).toEqual({
      found: true,
      night,
      rows: [],
      badLines: 0,
      counts: { ok: 0, retry: 0, fail: 0 },
    });
  });
});
