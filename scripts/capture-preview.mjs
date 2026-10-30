import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const destination = resolve(process.cwd(), process.argv[2] ?? '../preview/index.html');
const url = 'http://127.0.0.1:8787/digest/2026-10-28';

let response;
try {
  response = await fetch(url);
} catch (error) {
  console.error(`Could not fetch ${url}: ${error.message}`);
  process.exitCode = 1;
}

if (response) {
  const contentType = response.headers.get('content-type') ?? '';
  if (!response.ok || !contentType.includes('text/html')) {
    console.error(`Expected an HTML page from ${url}; received ${response.status} (${contentType || 'no content type'}).`);
    process.exitCode = 1;
  } else {
    const html = await response.text();
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, html, 'utf8');
    console.log(`Saved ${url} to ${destination}`);
  }
}

