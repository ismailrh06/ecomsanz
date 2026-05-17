const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.vtt': 'text/vtt; charset=utf-8'
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function getFilePath(urlPath) {
  let cleanPath = '/';
  try {
    cleanPath = decodeURIComponent(urlPath.split('?')[0]);
  } catch (error) {
    return null;
  }

  if (cleanPath === '/') return path.join(ROOT, 'index.html');

  const filePath = path.normalize(path.join(ROOT, cleanPath));
  if (!filePath.startsWith(ROOT + path.sep)) return null;
  if (!path.extname(filePath)) {
    const htmlPath = `${filePath}.html`;
    if (fs.existsSync(htmlPath)) return htmlPath;
  }
  return filePath;
}

function serveFile(res, filePath) {
  if (!filePath) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bad request');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1e6) {
        reject(new Error('Request body too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const requestUrl = req.url || '/';

  if (req.method === 'POST' && requestUrl.startsWith('/api/lead')) {
    try {
      const rawBody = await readRequestBody(req);
      const body = rawBody ? JSON.parse(rawBody) : {};
      const name = String(body.name || '').trim();
      const email = String(body.email || '').trim();
      const phone = String(body.phone || '').trim();

      if (!name) {
        return sendJson(res, 400, { ok: false, error: 'Missing required fields', field: 'name' });
      }

      return sendJson(res, 200, {
        ok: true,
        requiresVerification: false,
        message: 'Acceso concedido.',
        lead: { name, email, phone }
      });
    } catch (error) {
      return sendJson(res, 500, {
        ok: false,
        error: 'Local API error',
        details: String(error?.message || error)
      });
    }
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD, POST' });
    res.end();
    return;
  }

  const filePath = getFilePath(requestUrl);
  serveFile(res, filePath);
});

server.listen(PORT, () => {
  console.log(`Local server running at http://localhost:${PORT}`);
});
