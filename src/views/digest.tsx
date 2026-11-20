import type { DigestNight, DigestRow } from '../digest/types.js';

const missing = '—';

function statusLabel(row: DigestRow) {
  return row.lastStatus === 'fail' ? <strong class="warn">{row.lastStatus}</strong> : row.lastStatus;
}

function errorLabel(error: string | null) {
  return error === null ? missing : <span class="warn">{error}</span>;
}

export function DigestView({ night, digest }: { night: string; digest: DigestNight }) {
  return (
    <>
      <h1>digest · {night}</h1>
      {digest.rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <div class="table-scroll" role="region" aria-labelledby="digest-jobs" tabIndex={0}>
          <table>
            <caption id="digest-jobs">Jobs for {night}</caption>
            <thead>
              <tr>
                <th scope="col">job</th>
                <th scope="col">owner</th>
                <th scope="col">runs</th>
                <th scope="col">retries</th>
                <th scope="col">status</th>
                <th scope="col">last error</th>
                <th scope="col">first time</th>
                <th scope="col">last time</th>
              </tr>
            </thead>
            <tbody>
              {digest.rows.map((row) => (
                <tr>
                  <th scope="row">{row.job}</th>
                  <td>{row.owner ?? missing}</td>
                  <td>{row.runs}</td>
                  <td>{row.retries >= 3 ? <strong class="warn">{row.retries}</strong> : row.retries}</td>
                  <td>{statusLabel(row)}</td>
                  <td>{errorLabel(row.lastError)}</td>
                  <td>{row.firstAt}</td>
                  <td>{row.lastAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
