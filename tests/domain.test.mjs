// 單元測試：npm test（不需要模擬器）
import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {
  balance,
  cents,
  money,
  dueState,
  localDate,
  validTask,
  validEvent,
  inventoryNext,
  parseLevels,
  timerStart,
  advanceTimer,
  manage,
  financial,
  xmlEscape,
} from '../src/domain.mjs';
import { workbook, columnName } from '../src/export.mjs';
import { GREETINGS, nextGreetingIndex, pickGreeting } from '../src/greetings.mjs';
import { deployProblems } from '../scripts/lib.mjs';

test('角色：幹部與財務權限', () => {
  assert.deepEqual(['core', 'officer', 'finance', 'member'].map(manage), [true, true, true, false]);
  assert.deepEqual(['core', 'officer', 'finance', 'member'].map(financial), [
    true,
    false,
    true,
    false,
  ]);
  assert.equal(manage(undefined), false);
});

test('任務期限：逾期、三天內到期、之後、已完成', () => {
  const now = new Date(2026, 10, 17, 9, 0);
  const task = (dueDate, status = 'todo') => ({ dueDate, status });
  assert.equal(dueState(task('2026-11-16'), now), 'overdue');
  assert.equal(dueState(task('2026-11-17'), now), 'soon'); // 今天到期不算逾期
  assert.equal(dueState(task('2026-11-20'), now), 'soon');
  assert.equal(dueState(task('2026-11-21'), now), 'later');
  assert.equal(dueState(task('2026-11-01', 'done'), now), 'done');
  assert.equal(localDate(new Date(2026, 0, 5)), '2026-01-05');
});

test('任務驗證：缺負責人或截止日期時提示補齊', () => {
  assert.throws(
    () => validTask({ title: ' ', assigneeId: 'u', dueDate: '2026-11-20' }),
    /任務名稱/,
  );
  assert.throws(() => validTask({ title: 'a', assigneeId: '', dueDate: '2026-11-20' }), /負責人/);
  assert.throws(() => validTask({ title: 'a', assigneeId: 'u', dueDate: '' }), /截止日期/);
  assert.ok(validTask({ title: 'a', assigneeId: 'u', dueDate: '2026-11-20' }));
});

test('活動驗證：時間先後與報名截止', () => {
  const base = { title: '活動', startAt: 2000, endAt: 3000, registrationDeadline: 0 };
  assert.ok(validEvent(base));
  assert.throws(() => validEvent({ ...base, endAt: 2000 }), /結束時間/);
  assert.throws(() => validEvent({ ...base, registrationDeadline: 2500 }), /報名截止/);
  assert.throws(() => validEvent({ ...base, title: '' }), /活動名稱/);
});

test('金額：以分為單位的整數，拒絕負數與多於兩位小數', () => {
  assert.equal(cents('150'), 15000);
  assert.equal(cents('0.1'), 10);
  assert.equal(cents('19.99'), 1999);
  for (const bad of ['-1', '1.234', 'abc', '', '1e3']) assert.throws(() => cents(bad));
  assert.match(money(15000), /150/);
});

test('財務結餘：收入減支出', () => {
  const rows = [
    { type: 'income', amount: 1200000 },
    { type: 'expense', amount: 180000 },
    { type: 'expense', amount: 65000 },
    { type: 'income', amount: 500000 },
  ];
  assert.equal(balance(rows), 1455000);
  assert.equal(balance([]), 0);
  assert.equal(balance([{ type: 'expense', amount: 100 }]), -100);
});

test('庫存異動：不可為零、不可小於零、不可超過上限', () => {
  assert.equal(inventoryNext(10, -3), 7);
  assert.equal(inventoryNext(0, 5), 5);
  assert.throws(() => inventoryNext(2, -3), /不可小於零/);
  assert.throws(() => inventoryNext(2, 0), /非零整數/);
  assert.throws(() => inventoryNext(2, 1.5), /非零整數/);
  assert.throws(() => inventoryNext(1000000, 1));
});

test('盲注結構：解析級別與休息，休息不佔級別編號', () => {
  const levels = parseLevels('25,50,0,15\n休息,5\n100,200,200,20');
  assert.equal(levels.length, 3);
  assert.deepEqual(levels[0], {
    label: '第 1 級',
    small: 25,
    big: 50,
    ante: 0,
    seconds: 900,
    rest: false,
  });
  assert.equal(levels[1].rest, true);
  assert.equal(levels[1].seconds, 300);
  assert.equal(levels[2].label, '第 2 級');
  for (const bad of ['', '50,25,0,15', '25,50,0', '25,50,0,0', '休息', 'a,b,c,d', '0,0,0,10'])
    assert.throws(() => parseLevels(bad), `應拒絕：${bad}`);
});

test('盲注計時：倒數、切換級別、暫停恢復與結束', () => {
  const levels = parseLevels('25,50,0,1\n休息,1\n50,100,0,1');
  let state = timerStart(levels);
  assert.deepEqual(state, {
    index: 0,
    remaining: 60,
    running: false,
    finished: false,
    deadline: 0,
  });
  assert.equal(advanceTimer(levels, state, 999999), state); // 未開始時不前進

  const t0 = 1_000_000;
  state = { ...state, running: true, deadline: t0 + 60_000 };
  state = advanceTimer(levels, state, t0 + 30_000);
  assert.equal(state.index, 0);
  assert.equal(state.remaining, 30);

  // 暫停 10 分鐘後恢復：剩餘時間不變
  const paused = { ...state, running: false };
  const resumed = { ...paused, running: true, deadline: t0 + 630_000 + paused.remaining * 1000 };
  assert.equal(advanceTimer(levels, resumed, t0 + 630_000).remaining, 30);

  // 時間到自動切到下一級（休息）
  state = advanceTimer(levels, state, t0 + 61_000);
  assert.equal(state.index, 1);
  assert.equal(state.remaining, 59);

  // 分頁在背景停留很久：一次跨過多級，最後結束
  state = advanceTimer(levels, state, t0 + 125_000);
  assert.equal(state.index, 2);
  state = advanceTimer(levels, state, t0 + 999_000);
  assert.equal(state.finished, true);
  assert.equal(state.running, false);
  assert.equal(state.remaining, 0);
});

test('Excel 匯出：產生可解析的 .xlsx，文字經過跳脫', async () => {
  assert.equal(columnName(0), 'A');
  assert.equal(columnName(25), 'Z');
  assert.equal(columnName(26), 'AA');
  assert.equal(xmlEscape('<a & "b">'), '&lt;a &amp; &quot;b&quot;&gt;');

  const data = await workbook(
    ['姓名', '金額', '備註'],
    [
      ['示範參加者', 150, '<script>&'],
      ['=SUM(A1)', 0, ''],
    ],
  );
  const zip = await JSZip.loadAsync(data);
  for (const file of [
    '[Content_Types].xml',
    '_rels/.rels',
    'xl/workbook.xml',
    'xl/_rels/workbook.xml.rels',
    'xl/worksheets/sheet1.xml',
  ])
    assert.ok(zip.file(file), `缺少 ${file}`);
  const sheet = await zip.file('xl/worksheets/sheet1.xml').async('string');
  assert.match(sheet, /<c r="A1" t="inlineStr"><is><t xml:space="preserve">姓名<\/t>/);
  assert.match(sheet, /<c r="B2"><v>150<\/v><\/c>/);
  assert.match(sheet, /&lt;script&gt;&amp;/);
  // 以文字儲存，不會被試算表當成公式執行
  assert.match(sheet, /<c r="A3" t="inlineStr"><is><t xml:space="preserve">=SUM\(A1\)<\/t>/);
  assert.equal((sheet.match(/<row /g) || []).length, 3);
});

test('總覽標題：每次開啟換一句，不與上一次重複', () => {
  assert.ok(GREETINGS.length >= 8);
  assert.equal(new Set(GREETINGS).size, GREETINGS.length, '句子不重複');
  for (const line of GREETINGS) {
    assert.ok(line.endsWith('。'), `以句號收尾：${line}`);
    assert.ok(line.length <= 12, `長度適合大標題：${line}`);
  }
  for (let previous = 0; previous < GREETINGS.length; previous++)
    for (const r of [0, 0.25, 0.5, 0.75, 0.999999]) {
      const next = nextGreetingIndex(previous, () => r);
      assert.notEqual(next, previous);
      assert.ok(next >= 0 && next < GREETINGS.length);
    }
  // 沒有紀錄或紀錄無效時，仍回傳有效索引
  for (const previous of [null, undefined, NaN, -1, 99, 1.5])
    assert.ok(GREETINGS[nextGreetingIndex(previous, () => 0.5)]);
  // 模擬瀏覽器：連續開啟 50 次都不與前一次相同
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, v),
  };
  let last = pickGreeting();
  for (let i = 0; i < 50; i++) {
    const current = pickGreeting();
    assert.notEqual(current, last);
    last = current;
  }
  delete globalThis.localStorage;
});

test('建置設定檢查：正式環境與 Vercel 必須有完整的 Firebase 設定', () => {
  const emulator = { mode: 'emulator', projectId: 'demo-ucms', apiKey: 'local-emulator-key' };
  const production = { mode: 'production', projectId: 'ucms-ntu', apiKey: 'AIzaExampleKey' };
  // 本機模擬器與設定完整的正式環境都可以建置
  assert.deepEqual(deployProblems(emulator), []);
  assert.deepEqual(deployProblems(production), []);
  assert.deepEqual(deployProblems(production, { vercel: true }), []);
  // 在 Vercel 上忘記設定環境變數時要擋下，不能部署出指向本機模擬器的網站
  const missing = deployProblems(emulator, { vercel: true });
  assert.equal(missing.length, 3);
  assert.ok(missing.some((m) => m.includes('UCMS_MODE')));
  assert.ok(missing.some((m) => m.includes('FIREBASE_PROJECT_ID')));
  assert.ok(missing.some((m) => m.includes('FIREBASE_API_KEY')));
  // 正式環境沿用示範專案或模擬器金鑰
  assert.equal(deployProblems({ ...production, projectId: 'demo-ucms' }).length, 1);
  assert.equal(deployProblems({ ...production, apiKey: 'local-emulator-key' }).length, 1);
  assert.equal(deployProblems({ ...production, apiKey: '' }, { vercel: true }).length, 1);
  // 模式拼錯
  assert.ok(deployProblems({ ...production, mode: 'Production' })[0].includes('UCMS_MODE'));
});
