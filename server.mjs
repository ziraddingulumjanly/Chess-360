import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)));
const port = Number(process.env.PORT || 4173);
const mime = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.mjs':'text/javascript; charset=utf-8', '.wasm':'application/wasm', '.svg':'image/svg+xml', '.png':'image/png', '.txt':'text/plain; charset=utf-8', '.json':'application/json', '.md':'text/markdown; charset=utf-8' };

const server = createServer(async (request, response) => {
  response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  response.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  response.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  if (!['GET', 'HEAD'].includes(request.method || 'GET')) { response.writeHead(405).end(); return; }
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); }
  catch { response.writeHead(400).end(); return; }
  const path = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!(path === root || path.startsWith(root + sep))) { response.writeHead(403).end(); return; }
  try {
    const info = await stat(path);
    if (!info.isFile()) { response.writeHead(404).end(); return; }
    response.setHeader('Content-Type', mime[extname(path)] || 'application/octet-stream');
    response.setHeader('Content-Length', info.size);
    response.setHeader('Cache-Control', pathname.startsWith('/engine/') || pathname.startsWith('/assets/') ? 'public, max-age=604800' : 'no-cache');
    if (request.method === 'HEAD') { response.writeHead(200).end(); return; }
    // Streams large WASM assets without reading them fully into the server's memory.
    const { createReadStream } = await import('node:fs');
    createReadStream(path).on('error', () => { if (!response.headersSent) response.writeHead(500); response.end(); }).pipe(response);
  } catch { response.writeHead(404).end('Not found'); }
});
server.listen(port, '0.0.0.0', () => console.log(`Chess 360 → http://localhost:${port}`));
