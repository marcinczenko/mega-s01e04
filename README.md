# rig

Keeps a lane's lights on while nobody is in it: a heartbeat every minute, a status board, and
a morning digest of what ran overnight.

```sh
cp .env.example .env   # set LANE_MARKER
pnpm install
pnpm dev               # http://localhost:8787
```

## Capture the review page

Start rig locally with the issued lane marker in `.env`, then save the rendered digest as one
HTML file outside this Git repository:

```sh
pnpm start
# In another terminal, from this repository:
pnpm preview:capture
```

The capture command fetches `http://127.0.0.1:8787/digest/2026-10-28` and writes
`../preview/index.html` (the sibling `preview` directory is created if needed). The route
includes its stylesheet inline and has no client scripts or external assets. The script checks
that the service returned a successful HTML response before writing the file. A different
destination can be supplied as its first argument, for example
`pnpm preview:capture /tmp/rig-preview.html`.

Keep the marker in the page through review. When the review has arrived, regenerate the same
file with the marker unset; an empty environment value takes precedence over `.env`:

```sh
LANE_MARKER= pnpm start
# In another terminal, overwrite the same local file:
pnpm preview:capture
```

The regenerated banner says `no marker set`. Uploading either capture, including replacing the
same public URL with the marker-free copy, is a separate approval step. Never add the captured
HTML to Git, an issue, or a chat attachment.

For SSH/SCP publication and replacement, use [upload-preview](.agents/skills/upload-preview/SKILL.md). Supply host-specific values from private local notes; they do not belong in this repository.

Working on it with an agent: start at [AGENTS.md](AGENTS.md).
