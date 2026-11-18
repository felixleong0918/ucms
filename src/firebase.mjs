// Firebase's documented REST APIs. Tokens are refreshed; Firestore Security Rules
// are enforced identically to SDK calls. No privileged credential in the browser.
// 瀏覽器由 dist/config.js 提供 UCMS_CONFIG；Node（種子資料、整合測試）可在
// 匯入本模組前設定 globalThis.UCMS_CONFIG。
const config = globalThis.UCMS_CONFIG || {
  mode: 'emulator',
  projectId: 'demo-ucms',
  apiKey: 'local-emulator-key',
  authUrl: 'http://127.0.0.1:9099',
  firestoreUrl: 'http://127.0.0.1:8080',
};
export { config };
export const base =
  config.mode === 'emulator'
    ? `${config.firestoreUrl}/v1/projects/${config.projectId}/databases/(default)/documents`
    : `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents`;
const authBase =
  config.mode === 'emulator'
    ? `${config.authUrl}/identitytoolkit.googleapis.com/v1`
    : 'https://identitytoolkit.googleapis.com/v1';
let session = null;
try {
  session = JSON.parse(sessionStorage.getItem('ucms-session') || 'null');
} catch {}
const watchers = new Set();
function setSession(s) {
  session = s;
  try {
    s
      ? sessionStorage.setItem('ucms-session', JSON.stringify(s))
      : sessionStorage.removeItem('ucms-session');
  } catch {}
  watchers.forEach((f) => f(s));
}
export const currentUser = () => session;
export function onSession(fn) {
  watchers.add(fn);
  return () => watchers.delete(fn);
}
export function logout() {
  setSession(null);
}
const errors = {
  INVALID_LOGIN_CREDENTIALS: '帳號或密碼不正確',
  EMAIL_EXISTS: '這個電子郵件已註冊',
  WEAK_PASSWORD: '密碼至少需要 6 個字元',
  INVALID_EMAIL: '電子郵件格式不正確',
  PERMISSION_DENIED: '你沒有此操作的權限，或資料未符合規則',
  FAILED_PRECONDITION: '資料狀態已變更，請重新整理後再試',
  UNAUTHENTICATED: '登入已失效，請重新登入',
  EMAIL_NOT_FOUND: '找不到此帳號',
  INVALID_PASSWORD: '帳號或密碼不正確',
  TOO_MANY_ATTEMPTS_TRY_LATER: '嘗試次數過多，請稍後再試',
  USER_DISABLED: '這個帳號已被停用',
  // 以下是正式環境設定不完整時會遇到的錯誤，處理方式見 docs/DEPLOY.md。
  CONFIGURATION_NOT_FOUND: '這個 Firebase 專案尚未啟用 Authentication',
  OPERATION_NOT_ALLOWED: '這個 Firebase 專案尚未啟用「電子郵件／密碼」登入',
  API_KEY_INVALID: '網站設定的 Firebase Web API Key 無效，請檢查 FIREBASE_API_KEY',
  DATABASE_MISSING: '這個 Firebase 專案尚未建立 Firestore 資料庫',
};
// 沒有專屬代碼、只能從訊息內容辨識的設定錯誤。
const patterns = [
  [/API key not valid/i, 'API_KEY_INVALID'],
  [/database \(default\) does not exist/i, 'DATABASE_MISSING'],
];
async function request(url, options = {}) {
  let res;
  try {
    res = await fetch(url, { ...options, signal: options.signal || AbortSignal.timeout(15000) });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw Error(
      config.mode === 'emulator'
        ? '無法連接本機服務。請確認 Firebase Emulator 已啟動（npm run emulators）。'
        : '網路連線失敗，請稍後重試。',
    );
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Auth 的錯誤代碼放在 message（例如 "WEAK_PASSWORD : ..."），Firestore 的放在 status。
    const message = body.error?.message || '';
    const code = message.split(' : ')[0];
    const key =
      patterns.find(([pattern]) => pattern.test(message))?.[1] ||
      (errors[code] ? code : body.error?.status || code);
    const error = Error(errors[key] || body.error?.message || `請求失敗（${res.status}）`);
    error.status = res.status;
    error.code = key;
    throw error;
  }
  return body;
}
export async function login(email, password) {
  const data = await request(`${authBase}/accounts:signInWithPassword?key=${config.apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  setSession({
    uid: data.localId,
    email: data.email,
    idToken: data.idToken,
    refreshToken: data.refreshToken,
    expires: Date.now() + Number(data.expiresIn) * 1000,
  });
  return session;
}
export async function register(email, password) {
  const data = await request(`${authBase}/accounts:signUp?key=${config.apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  setSession({
    uid: data.localId,
    email: data.email,
    idToken: data.idToken,
    refreshToken: data.refreshToken,
    expires: Date.now() + Number(data.expiresIn) * 1000,
  });
  return session;
}
let refreshing;
async function token() {
  if (!session) return null;
  if (session.expires > Date.now() + 60000) return session.idToken;
  if (!refreshing) {
    const old = session;
    refreshing = (async () => {
      const url =
        config.mode === 'emulator'
          ? `${config.authUrl}/securetoken.googleapis.com/v1/token`
          : 'https://securetoken.googleapis.com/v1/token';
      const data = await request(`${url}?key=${config.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: old.refreshToken }),
      });
      if (session?.uid === old.uid)
        setSession({
          ...old,
          idToken: data.id_token,
          refreshToken: data.refresh_token,
          expires: Date.now() + Number(data.expires_in) * 1000,
        });
      return data.id_token;
    })()
      .catch((e) => {
        logout();
        throw e;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}
export function encode(value) {
  if (value === null) return { nullValue: null };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number')
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (typeof value === 'string') return { stringValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
  return { mapValue: { fields: encodeFields(value) } };
}
export const encodeFields = (obj) =>
  Object.fromEntries(
    Object.entries(obj)
      .filter(([k, v]) => !k.startsWith('_') && k !== 'id' && v !== undefined)
      .map(([k, v]) => [k, encode(v)]),
  );
export function decode(value) {
  if ('nullValue' in value) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decode);
  if ('mapValue' in value) return decodeFields(value.mapValue.fields || {});
  return value.timestampValue || null;
}
export const decodeFields = (fields) =>
  Object.fromEntries(Object.entries(fields || {}).map(([k, v]) => [k, decode(v)]));
export const docData = (d) => ({
  ...decodeFields(d.fields),
  id: d.name.split('/').pop(),
  _updateTime: d.updateTime,
});
async function api(path, options = {}) {
  const idToken = await token();
  return request(`${base}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    },
  });
}
export async function get(path) {
  try {
    return docData(await api('/' + path));
  } catch (e) {
    if (e.status === 404 && e.code !== 'DATABASE_MISSING') return null;
    throw e;
  }
}
export async function list(path) {
  let result = [],
    pageToken = '';
  do {
    const data = await api(
      '/' +
        path +
        '?pageSize=200' +
        (pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : ''),
    );
    result.push(...(data.documents || []).map(docData));
    pageToken = data.nextPageToken || '';
  } while (pageToken);
  return result;
}
export async function query(path, field, value) {
  const split = path.lastIndexOf('/');
  const parent = split < 0 ? '' : path.slice(0, split),
    collectionId = path.slice(split + 1);
  const data = await api((parent ? '/' + parent : '') + ':runQuery', {
    method: 'POST',
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId }],
        where: { fieldFilter: { field: { fieldPath: field }, op: 'EQUAL', value: encode(value) } },
      },
    }),
  });
  return data.filter((r) => r.document).map((r) => docData(r.document));
}
export const newId = () => crypto.randomUUID();
export const fullName = (path) =>
  `projects/${config.projectId}/databases/(default)/documents/${path}`;
export function write(path, data, existing) {
  return {
    update: { name: fullName(path), fields: encodeFields(data) },
    ...(existing
      ? { currentDocument: { updateTime: existing._updateTime } }
      : { currentDocument: { exists: false } }),
  };
}
export async function commit(writes) {
  return api(':commit', { method: 'POST', body: JSON.stringify({ writes }) });
}
export async function save(path, data, existing) {
  await commit([write(path, data, existing)]);
  return path.split('/').pop();
}
export async function remove(path, existing) {
  await commit([
    {
      delete: fullName(path),
      ...(existing ? { currentDocument: { updateTime: existing._updateTime } } : {}),
    },
  ]);
}
