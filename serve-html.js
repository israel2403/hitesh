#!/usr/bin/env node
// Simple static file server for HTML (and assets) with Node.js (no dependencies)

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const args = process.argv.slice(2);

// --- CLI options ---
let rootDir = process.cwd();
let port = 8080;
let openBrowser = false;

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '-p' || a === '--port') {
    port = Number(args[++i]) || port;
  } else if (a === '-d' || a === '--dir') {
    rootDir = path.resolve(args[++i] || '.');
  } else if (a === '-o' || a === '--open') {
    openBrowser = true;
  } else if (a === '-h' || a === '--help') {
    console.log(`
Usage: node serve-html.js [options]

Options:
  -d, --dir <path>    Directory to serve (default: current directory)
  -p, --port <port>   Port to listen on (default: 8080)
  -o, --open          Open default browser to http://localhost:<port>
  -h, --help          Show this help

Examples:
  node serve-html.js
  node serve-html.js -d ./public -p 3000 -o
`);
    process.exit(0);
  }
}

// --- MIME types (minimal set) ---
const MIME = {
  '.html': 'text/html; charset=UTF-8',
  '.htm':  'text/html; charset=UTF-8',
  '.js':   'application/javascript; charset=UTF-8',
  '.mjs':  'application/javascript; charset=UTF-8',
  '.css':  'text/css; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
  '.ico':  'image/x-icon',
  '.txt':  'text/plain; charset=UTF-8',
  '.map':  'application/json',
  '.wav':  'audio/wav',
  '.mp3':  'audio/mpeg',
  '.mp4':  'video/mp4',
  '.wasm': 'application/wasm'
};

// --- Utility: send file ---
function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';

  // Basic caching for static assets (except HTML)
  const isHtml = type.startsWith('text/html');
  if (!isHtml) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  } else {
    res.setHeader('Cache-Control', 'no-cache');
  }

  res.setHeader('Content-Type', type);
  const stream = fs.createReadStream(filePath);
  stream.on('error', () => send404(res));
  stream.pipe(res);
}

function send404(res) {
  res.statusCode = 404;
  res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
  res.end('404 Not Found');
}

function sendDirListing(res, absDir, urlPath) {
  fs.readdir(absDir, { withFileTypes: true }, (err, entries) => {
    if (err) return send404(res);
    const listItems = entries
      .sort((a,b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name))
      .map(e => {
        const slash = e.isDirectory() ? '/' : '';
        const href = path.posix.join(urlPath, e.name) + slash;
        return `<li><a href="${href}">${e.name}${slash}</a></li>`;
      })
      .join('\n');

    res.setHeader('Content-Type', 'text/html; charset=UTF-8');
    res.end(`<!doctype html>
<html lang="en">
<meta charset="utf-8">
<title>Index of ${escapeHtml(urlPath)}</title>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;margin:2rem}
  h1{font-size:1.1rem}
  ul{line-height:1.8}
</style>
<h1>Index of ${escapeHtml(urlPath)}</h1>
<ul>
  ${urlPath !== '/' ? `<li><a href="${path.posix.join(urlPath, '..')}">..</a></li>` : ''}
  ${listItems}
</ul>
</html>`);
  });
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// --- HTTP server ---
const server = http.createServer((req, res) => {
  try {
    // Prevent path traversal
    const reqUrl = decodeURIComponent(req.url.split('?')[0]);
    const safePath = path.normalize(reqUrl).replace(/^(\.\.[/\\])+/, '');
    let absPath = path.join(rootDir, safePath);

    // If path is a directory, try index.html; otherwise show listing
    if (fs.existsSync(absPath) && fs.statSync(absPath).isDirectory()) {
      const indexFile = path.join(absPath, 'index.html');
      if (fs.existsSync(indexFile)) {
        return sendFile(res, indexFile);
      }
      const urlPath = safePath.replace(/\\/g, '/').endsWith('/') ? safePath : safePath + '/';
      return sendDirListing(res, absPath, urlPath === '' ? '/' : urlPath);
    }

    // If file not found, fall back to 404
    if (!fs.existsSync(absPath) || !fs.statSync(absPath).isFile()) {
      return send404(res);
    }

    sendFile(res, absPath);
  } catch {
    send404(res);
  }
});

// Start server
server.listen(port, () => {
  console.log(`Serving "${rootDir}" at http://localhost:${port}`);
  if (openBrowser) {
    const url = `http://localhost:${port}`;
    const opener =
      process.platform === 'win32' ? 'cmd' :
      process.platform === 'darwin' ? 'open' : 'xdg-open';
    const args = process.platform === 'win32' ? ['/c', 'start', url] : [url];
    spawn(opener, args, { stdio: 'ignore', detached: true }).unref();
  }
});
