// 首次設定：npm run setup
// 建立 .env（若不存在），再執行環境檢查。
import { copyFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { ROOT, exists } from './lib.mjs';

const env = join(ROOT, '.env');
if (await exists(env)) console.log('.env 已存在，保留現有設定。');
else {
  await copyFile(join(ROOT, '.env.example'), env);
  console.log('已從 .env.example 建立 .env（預設使用本機模擬器）。');
}

const doctor = spawn(process.execPath, [join(ROOT, 'scripts', 'doctor.mjs')], { stdio: 'inherit' });
doctor.on('exit', (code) => {
  if (!code)
    console.log(
      '\n下一步：\n  1. npm run emulators   啟動模擬器（保持開啟）\n  2. npm run seed        匯入示範資料（另開終端機，第一次執行即可）\n  3. npm run dev         開啟 http://127.0.0.1:5173',
    );
  process.exit(code ?? 1);
});
