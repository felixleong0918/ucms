// 環境檢查：npm run doctor
// 逐項確認 Node、相依套件、JDK、.env、連接埠與模擬器快取。
import { join } from 'node:path';
import {
  ROOT,
  MIN_JAVA,
  PORTS,
  JAVA_HELP,
  javaMajor,
  portFree,
  exists,
  loadConfig,
  emulatorsUp,
  emulatorCache,
} from './lib.mjs';

const results = [];
const ok = (label, detail = '') => results.push({ level: 'ok', label, detail });
const warn = (label, detail = '') => results.push({ level: 'warn', label, detail });
const fail = (label, detail = '') => results.push({ level: 'fail', label, detail });

const node = Number(process.versions.node.split('.')[0]);
node >= 22
  ? ok(`Node.js ${process.versions.node}`)
  : fail(`Node.js ${process.versions.node}`, '需要 Node.js 22 以上。');

const deps = ['esbuild', 'react', 'react-dom', 'jszip', 'firebase-tools'];
const missing = [];
for (const dep of deps) if (!(await exists(join(ROOT, 'node_modules', dep)))) missing.push(dep);
missing.length
  ? fail('相依套件', `缺少 ${missing.join('、')}，請執行 npm install。`)
  : ok('相依套件已安裝');

const java = await javaMajor();
if (java >= MIN_JAVA) ok(`JDK ${java}`);
else fail(java ? `JDK ${java}（版本過舊）` : '找不到 Java', JAVA_HELP);

const config = await loadConfig();
(await exists(join(ROOT, '.env')))
  ? ok(`.env：模式 ${config.mode}，專案 ${config.projectId}`)
  : warn('.env 不存在', '使用預設的本機模擬器設定。可執行 npm run setup 建立。');

const up = await emulatorsUp(config);
if (config.mode === 'emulator') {
  if (up.both) ok('Firebase Emulator 執行中', `${config.authUrl}、${config.firestoreUrl}`);
  else {
    const busy = [];
    for (const [name, port] of [
      ['Auth', PORTS.auth],
      ['Firestore', PORTS.firestore],
      ['Emulator UI', PORTS.ui],
    ])
      if (!(await portFree(port))) busy.push(`${name} ${port}`);
    busy.length
      ? fail('連接埠被佔用', `${busy.join('、')}。請關閉佔用的程式，或確認模擬器是否已在執行。`)
      : ok('模擬器連接埠可用（9099、8080、4000）');
    const cache = emulatorCache();
    cache.cached
      ? ok('Firestore 模擬器已下載', cache.dir)
      : warn(
          'Firestore 模擬器尚未下載',
          '第一次執行 npm run emulators 會從 storage.googleapis.com 下載約 137 MB。\n' +
            '若網路受限，可手動下載 jar 放到專案的 .emulator-cache/（見 README）。',
        );
  }
}
(await portFree(PORTS.web))
  ? ok(`網頁連接埠 ${PORTS.web} 可用`)
  : warn(`連接埠 ${PORTS.web} 使用中`, 'npm run dev 可能已在執行。');

const mark = { ok: '✓', warn: '!', fail: '✗' };
for (const r of results) {
  console.log(`${mark[r.level]} ${r.label}`);
  if (r.detail) console.log(r.detail.replace(/^/gm, '    '));
}
const failed = results.filter((r) => r.level === 'fail').length;
console.log(failed ? `\n有 ${failed} 項需要處理。` : '\n環境就緒。');
process.exit(failed ? 1 : 0);
