// 建置：把 src/ 打包到 dist/，並依 .env 或環境變數（例如 Vercel）產生 dist/config.js。
import { build } from 'esbuild';
import { mkdir, writeFile, copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT, loadConfig, deployProblems } from './lib.mjs';

export async function buildApp() {
  const config = await loadConfig();
  const vercel = Boolean(process.env.VERCEL);
  const problems = deployProblems(config, { vercel });
  if (problems.length)
    throw Error(
      `設定不完整：\n  - ${problems.join('\n  - ')}\n` +
        (vercel
          ? '請到 Vercel 專案的 Settings → Environment Variables 設定後重新部署（見 docs/DEPLOY.md）。'
          : '請在 .env 設定後重新建置（見 docs/DEPLOY.md）。'),
    );
  const dist = join(ROOT, 'dist');
  await mkdir(dist, { recursive: true });
  await build({
    absWorkingDir: ROOT,
    entryPoints: ['src/main.jsx'],
    bundle: true,
    outfile: 'dist/app.js', // 連同 src/styles.css 輸出 dist/app.css
    minify: true,
    sourcemap: false,
    target: ['es2022'],
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"' },
    logLevel: 'warning',
  });
  await copyFile(join(ROOT, 'index.html'), join(dist, 'index.html'));
  // 正式環境只需要專案 ID 與 Web API Key；模擬器位址不寫進正式版。
  const { mode, projectId, apiKey } = config;
  const publicConfig = mode === 'production' ? { mode, projectId, apiKey } : config;
  await writeFile(join(dist, 'config.js'), `window.UCMS_CONFIG=${JSON.stringify(publicConfig)};\n`);
  console.log(`已建置 dist/ — 模式：${config.mode}（專案 ${config.projectId}）`);
}

if (process.argv[1]?.endsWith('build.mjs')) {
  try {
    await buildApp();
  } catch (error) {
    console.error('建置失敗：' + error.message);
    process.exit(1);
  }
}
