// 本機預覽：建置後以靜態伺服器提供 dist/（http://127.0.0.1:5173）。
// 修改原始碼後請重新執行此指令。
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, join } from 'node:path';
import { buildApp } from './build.mjs';
import { ROOT, PORTS, loadConfig, emulatorsUp } from './lib.mjs';

await buildApp();
const config = await loadConfig();
if (config.mode === 'emulator' && !(await emulatorsUp(config)).both)
  console.warn('提醒：尚未偵測到 Firebase Emulator。請在另一個終端機執行 npm run emulators。');

const root = join(ROOT, 'dist');
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
};
const port = Number(process.env.PORT) || PORTS.web;
const server = createServer(async (req, res) => {
  try {
    let file = resolve(
      root,
      '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname),
    );
    if (!file.startsWith(root + '/') && file !== root) {
      res.writeHead(403).end();
      return;
    }
    try {
      if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html');
    } catch {
      file = resolve(root, 'index.html');
    }
    res.setHeader('Content-Type', mime[extname(file)] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.end(await readFile(file));
  } catch {
    res.writeHead(500).end('Unable to serve file');
  }
});
server.on('error', (err) => {
  console.error('無法啟動本機伺服器：' + err.message);
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => console.log(`UCMS：http://127.0.0.1:${port}`));
