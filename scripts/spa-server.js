// Tiny SPA server : sert dist/ avec fallback toutes routes inconnues sur index.html.
// Nécessaire pour Expo Router en mode static export (1 seul index.html, routing client).
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', 'dist');
const mime = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.json': 'application/json', '.wasm': 'application/wasm', '.png': 'image/png',
  '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.map': 'application/json',
};

http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  let p = path.join(root, urlPath);
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) {
    p = path.join(root, 'index.html');
  }
  if (!fs.existsSync(p)) {
    res.writeHead(404);
    res.end('404');
    return;
  }
  res.setHeader('Content-Type', mime[path.extname(p)] || 'application/octet-stream');
  fs.createReadStream(p).pipe(res);
}).listen(8083, () => console.log('SPA server :8083 → ' + root));
