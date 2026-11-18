// 啟動 Firebase Emulator（Auth + Firestore）。
//   npm run emulators                 啟動並保留資料於 .emulator-data/
//   node scripts/emulators.mjs exec "<指令>"   啟動乾淨的模擬器、執行指令後關閉
import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  ROOT,
  MIN_JAVA,
  JAVA_HELP,
  javaMajor,
  loadConfig,
  assertEmulator,
  emulatorsUp,
  emulatorCache,
  exists,
} from './lib.mjs';

const [mode, command] = process.argv.slice(2);
const config = await loadConfig();
try {
  assertEmulator(config);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const java = await javaMajor();
if (java < MIN_JAVA) {
  console.error(java ? `目前的 Java 版本是 ${java}。` : '找不到 Java。');
  console.error(JAVA_HELP);
  process.exit(1);
}

const firebase = join(
  ROOT,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'firebase.cmd' : 'firebase',
);
if (!(await exists(firebase))) {
  console.error('找不到 firebase-tools，請先執行 npm install。');
  process.exit(1);
}

const running = await emulatorsUp(config);
if (running.auth || running.firestore) {
  console.error('模擬器的連接埠已在使用中。若模擬器已在執行，不需要重複啟動。');
  process.exit(1);
}

const cache = emulatorCache();
const env = { ...process.env, FIREBASE_EMULATORS_PATH: cache.dir };
if (!cache.cached) console.log('第一次啟動會下載 Firestore 模擬器（約 137 MB），請稍候。');

// 模擬器管理介面（:4000）需要另外下載。執行測試時用不到；使用專案內的
// .emulator-cache/ 且裡面沒有管理介面時，也自動停用，避免在受限網路下啟動失敗。
const uiCached = (() => {
  try {
    return readdirSync(cache.dir).some((f) => /^ui-v/.test(f));
  } catch {
    return false;
  }
})();
const offline = cache.dir === join(ROOT, '.emulator-cache');
const common = ['--only', 'auth,firestore', '--project', config.projectId];
if (mode === 'exec' || (offline && !uiCached)) {
  // 設定檔必須放在專案根目錄，firebase-tools 才能找到 firestore.rules。
  const base = JSON.parse(await readFile(join(ROOT, 'firebase.json'), 'utf8'));
  base.emulators.ui = { enabled: false };
  const file = join(ROOT, '.firebase.no-ui.json');
  await writeFile(file, JSON.stringify(base, null, 2));
  common.push('--config', file);
  if (mode !== 'exec')
    console.log('未找到模擬器管理介面的檔案，這次啟動不含 http://127.0.0.1:4000。');
}
let args;
if (mode === 'exec') {
  if (!command) {
    console.error('用法：node scripts/emulators.mjs exec "<指令>"');
    process.exit(1);
  }
  args = ['emulators:exec', ...common, command];
} else {
  const data = join(ROOT, '.emulator-data');
  args = ['emulators:start', ...common, '--export-on-exit', data];
  if (await exists(data)) args.push('--import', data);
  console.log(
    '模擬器啟動後：另開終端機執行 npm run seed（第一次）與 npm run dev。按 Ctrl+C 結束並保存資料。',
  );
}

const child = spawn(firebase, args, {
  cwd: ROOT,
  env,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
child.on('exit', (code) => process.exit(code ?? 1));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
