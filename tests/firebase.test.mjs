// 單元測試：資料層的錯誤訊息對應（以假的 fetch 回應測試，不需要模擬器或網路）
import test from 'node:test';
import assert from 'node:assert/strict';
import * as db from '../src/firebase.mjs';

const reply = (status, error) => async () => new Response(JSON.stringify({ error }), { status });

async function failure(action) {
  try {
    await action();
  } catch (error) {
    return error;
  }
  assert.fail('應該要拋出錯誤');
}

test('錯誤訊息：登入錯誤與正式環境設定不完整時，都顯示中文說明', async (t) => {
  const original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  const cases = [
    // Auth 把代碼放在 message，可能帶有說明文字，也可能同時帶有較籠統的 status
    [400, { message: 'INVALID_LOGIN_CREDENTIALS' }, 'INVALID_LOGIN_CREDENTIALS'],
    [
      400,
      { message: 'INVALID_LOGIN_CREDENTIALS', status: 'INVALID_ARGUMENT' },
      'INVALID_LOGIN_CREDENTIALS',
    ],
    [400, { message: 'WEAK_PASSWORD : Password should be at least 6 characters' }, 'WEAK_PASSWORD'],
    // 部署設定不完整
    [
      400,
      { message: 'API key not valid. Please pass a valid API key.', status: 'INVALID_ARGUMENT' },
      'API_KEY_INVALID',
    ],
    [400, { message: 'CONFIGURATION_NOT_FOUND' }, 'CONFIGURATION_NOT_FOUND'],
    [
      400,
      { message: 'OPERATION_NOT_ALLOWED : Password sign-in is disabled.' },
      'OPERATION_NOT_ALLOWED',
    ],
    // Firestore 把代碼放在 status
    [
      403,
      { message: 'Missing or insufficient permissions.', status: 'PERMISSION_DENIED' },
      'PERMISSION_DENIED',
    ],
  ];
  for (const [status, error, code] of cases) {
    globalThis.fetch = reply(status, error);
    const thrown = await failure(() => db.login('someone@example.com', 'password'));
    assert.equal(thrown.code, code);
    assert.equal(thrown.status, status);
    assert.match(thrown.message, /[一-鿿]/, `${code} 應顯示中文訊息`);
  }
  assert.equal(db.currentUser(), null, '登入失敗不會留下登入狀態');

  // 文件不存在是正常情況；整個資料庫不存在則是設定問題，必須讓使用者看到
  globalThis.fetch = reply(404, { message: 'Document not found.', status: 'NOT_FOUND' });
  assert.equal(await db.get('users/nobody'), null);
  globalThis.fetch = reply(404, {
    message: 'The database (default) does not exist for project example.',
    status: 'NOT_FOUND',
  });
  assert.equal((await failure(() => db.get('users/nobody'))).code, 'DATABASE_MISSING');
});
