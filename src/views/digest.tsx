import type { DigestRow, NightDigest } from '../digest/types.js';

function Flag({ children }: { children: string }) {
  return <span class="warn">{children} ⚠</span>;
}

function DigestRowView({ row }: { row: DigestRow }) {
  return (
    <tr>
      <td>{row.job}</td>
      <td>{row.owner ?? '—'}</td>
      <td>{row.runs}</td>
      <td>{row.retries >= 3 ? <Flag>{String(row.retries)}</Flag> : row.retries}</td>
      <td>{row.lastStatus}</td>
      <td>{row.failures > 0 ? <Flag>{String(row.failures)}</Flag> : row.failures}</td>
      <td>{row.lastError ?? '—'}</td>
      <td>{row.firstAt}</td>
      <td>{row.lastAt}</td>
    </tr>
  );
}

export function DigestPage({ digest }: { digest: NightDigest }) {
  return (
    <>
      <h1>digest · {digest.night}</h1>
      <p>{digest.badLines} invalid {digest.badLines === 1 ? 'line' : 'lines'}</p>
      {digest.rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <div class="digest-table-scroll">
          <table class="digest-table">
            <thead>
              <tr>
                <th scope="col">job</th>
                <th scope="col">owner</th>
                <th scope="col">runs</th>
                <th scope="col">retries</th>
                <th scope="col">last status</th>
                <th scope="col">failures</th>
                <th scope="col">last error</th>
                <th scope="col">first time</th>
                <th scope="col">last time</th>
              </tr>
            </thead>
            <tbody>
              {digest.rows.map((row) => <DigestRowView row={row} />)}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
