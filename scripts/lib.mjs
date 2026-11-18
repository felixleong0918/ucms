// 腳本共用工具：讀取 .env、檢查 Java、偵測模擬器。
import { execFile } from 'node:child_process';
import { readFile, access } from 'node:fs/promises';
import { createServer } from 'node:net';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { readdirSync } from 'node:fs';

export const ROOT = resolve(import.meta.dirname, '..');
export const MIN_JAVA = 21;
export const PORTS = { auth: 9099, firestore: 8080, ui: 4000, web: 5173 };

export async function readEnv() {
  const env = {};
  try {
    for (const line of (await readFile(join(ROOT, '.env'), 'utf8')).split('\n')) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m) env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
    }
  } catch {}
  return env;
}

// 與 dist/config.js 相同的設定物件；build、seed 與整合測試共用。
export async function loadConfig() {
  const env = { ...(await readEnv()), ...pick(process.env) };
  return {
    mode: env.UCMS_MODE || 'emulator',
    projectId: env.FIREBASE_PROJECT_ID || 'demo-ucms',
    apiKey: env.FIREBASE_API_KEY || 'local-emulator-key',
    authUrl: env.AUTH_EMULATOR_URL || 'http://127.0.0.1:9099',
    firestoreUrl: env.FIRESTORE_EMULATOR_URL || 'http://127.0.0.1:8080',
  };
}
function pick(source) {
  const keys = [
    'UCMS_MODE',
    'FIREBASE_PROJECT_ID',
    'FIREBASE_API_KEY',
    'AUTH_EMULATOR_URL',
    'FIRESTORE_EMULATOR_URL',
  ];
  return Object.fromEntries(
    keys.filter((k) => source[k]?.trim()).map((k) => [k, source[k].trim()]),
  );
}

// 建置前的設定檢查，回傳問題清單（空陣列代表可以建置）。
// 在 Vercel 上（vercel: true）一律要求正式環境的設定，避免把指向本機模擬器的網站部署出去。
export function deployProblems(config, { vercel = false } = {}) {
  const problems = [];
  if (!['emulator', 'production'].includes(config.mode))
    problems.push(`UCMS_MODE 只能是 emulator 或 production（目前是「${config.mode}」）。`);
  else if (vercel && config.mode !== 'production')
    problems.push('在 Vercel 上建置時，UCMS_MODE 必須設為 production。');
  if (config.mode === 'production' || vercel) {
    if (!config.projectId || config.projectId.startsWith('demo-'))
      problems.push('FIREBASE_PROJECT_ID 尚未設定為正式的 Firebase 專案 ID。');
    if (!config.apiKey || config.apiKey === 'local-emulator-key')
      problems.push('FIREBASE_API_KEY 尚未設定為 Firebase 的 Web API Key。');
  }
  return problems;
}

// 回傳 Java 主版本號；找不到 Java 時回傳 0。
export function javaMajor() {
  return new Promise((done) => {
    execFile('java', ['-version'], (error, stdout, stderr) => {
      if (error) return done(0);
      const m = `${stderr}\n${stdout}`.match(/version "(\d+)(?:\.(\d+))?/);
      if (!m) return done(0);
      const major = Number(m[1]) === 1 ? Number(m[2]) : Number(m[1]);
      done(major || 0);
    });
  });
}

export const JAVA_HELP = `需要 JDK ${MIN_JAVA} 以上才能啟動 Firebase Emulator。
  macOS（Homebrew）： brew install --cask temurin@21
  其他系統：        https://adoptium.net/temurin/releases/?version=21
安裝後重新開啟終端機，執行 java -version 確認版本。`;

export function portFree(port, host = '127.0.0.1') {
  return new Promise((done) => {
    const server = createServer();
    server.once('error', () => done(false));
    server.once('listening', () => server.close(() => done(true)));
    server.listen(port, host);
  });
}

export async function reachable(url) {
  try {
    await fetch(url, { signal: AbortSignal.timeout(2000) });
    return true;
  } catch {
    return false;
  }
}

export async function emulatorsUp(config) {
  const [auth, firestore] = await Promise.all([
    reachable(config.authUrl),
    reachable(config.firestoreUrl),
  ]);
  return { auth, firestore, both: auth && firestore };
}

// 專案內的 .emulator-cache/ 若已放好 Firestore 模擬器 jar，就優先使用，
// 讓無法連到 storage.googleapis.com 的環境也能啟動。
export function emulatorCache() {
  const local = join(ROOT, '.emulator-cache');
  const shared =
    process.env.FIREBASE_EMULATORS_PATH || join(homedir(), '.cache', 'firebase', 'emulators');
  const hasJar = (dir) => {
    try {
      return readdirSync(dir).some((f) => /^cloud-firestore-emulator-.*\.jar$/.test(f));
    } catch {
      return false;
    }
  };
  if (hasJar(local)) return { dir: local, cached: true };
  return { dir: shared, cached: hasJar(shared) };
}

export async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export function assertEmulator(config) {
  const local = (url) => /^http:\/\/(127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(url);
  if (config.mode !== 'emulator' || !local(config.authUrl) || !local(config.firestoreUrl))
    throw Error('此指令只能對本機 Firebase Emulator 執行（UCMS_MODE=emulator）。');
  if (!config.projectId.startsWith('demo-'))
    throw Error('模擬器專案 ID 必須以 demo- 開頭，避免誤連正式專案。');
}
