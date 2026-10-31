import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { resolve, extname, sep } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)));
const PORT = Number(process.env.PORT) || 8080;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.wasm': 'application/wasm',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

async function serve(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  let filePath = decodeURIComponent(url.pathname);

  if (filePath === '/' || filePath === '') {
    filePath = '/index.html';
  }

  // Seguridad: evita salir del directorio del proyecto.
  const fullPath = resolve(ROOT, `.${filePath}`);
  if (fullPath !== ROOT && !fullPath.startsWith(ROOT + sep)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Forbidden');
  }

  try {
    const content = await readFile(fullPath);
    const mime =
      MIME_TYPES[extname(fullPath).toLowerCase()] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': mime,
      // Desarrollo: nunca cachear, para que los cambios se vean al recargar.
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    });
    res.end(content);
  } catch (err) {
    if (err.code === 'ENOENT') {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
    } else {
      console.error('[server]', err);
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Internal Server Error');
    }
  }
}

createServer(serve).listen(PORT, () => {
  console.log(`🚀 Servidor en http://localhost:${PORT}`);
  console.log('   Stockfish WASM single-threaded (no requiere COOP/COEP).');
  console.log('   Cache-Control: no-store (desarrollo).');
});
