// 匯入示範資料：npm run seed（需先啟動模擬器）
// 只會對本機 Firebase Emulator 執行；會清空模擬器內既有的帳號與資料。
// 所有人名、金額與內容皆為示範用途，並非真實社團資料。
import { loadConfig, assertEmulator, emulatorsUp } from './lib.mjs';

const config = await loadConfig();
try {
  assertEmulator(config);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
if (!(await emulatorsUp(config)).both) {
  console.error('連不到模擬器。請先在另一個終端機執行 npm run emulators。');
  process.exit(1);
}
globalThis.UCMS_CONFIG = config;
const { encodeFields } = await import('../src/firebase.mjs');
const { localDate } = await import('../src/domain.mjs');

// 僅供本機模擬器使用的示範密碼；正式環境請各自註冊帳號。
const DEMO_PASSWORD = 'ucms-demo-2026';

const project = config.projectId;
const documents = `${config.firestoreUrl}/v1/projects/${project}/databases/(default)/documents`;
const owner = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };

async function call(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) throw Error(`${options.method || 'GET'} ${url} → ${res.status} ${await res.text()}`);
  return res.json().catch(() => ({}));
}
// 模擬器接受 Bearer owner，略過安全規則，僅用於建立初始資料。
const put = (path, data) =>
  call(`${documents}/${path}`, {
    method: 'PATCH',
    headers: owner,
    body: JSON.stringify({ fields: encodeFields(data) }),
  });

await call(`${config.firestoreUrl}/emulator/v1/projects/${project}/databases/(default)/documents`, {
  method: 'DELETE',
});
await call(`${config.authUrl}/emulator/v1/projects/${project}/accounts`, { method: 'DELETE' });

async function account(email, name) {
  const data = await call(
    `${config.authUrl}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=${config.apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: DEMO_PASSWORD, returnSecureToken: true }),
    },
  );
  await put(`users/${data.localId}`, { name, email });
  return { uid: data.localId, email, name };
}

const DAY = 86400000;
const now = Date.now();
const at = (days, hour = 19, minute = 0) => {
  const d = new Date(now + days * DAY);
  d.setHours(hour, minute, 0, 0);
  return d.getTime();
};
const date = (days) => localDate(new Date(now + days * DAY));
const stamp = (by, days = -7) => ({
  createdAt: at(days, 10),
  updatedAt: at(days, 10),
  createdBy: by.uid,
});

const admin = await account('admin@ucms.test', '示範系統管理者');
await put(`admins/${admin.uid}`, { createdAt: now });
const guest = await account('guest@ucms.test', '示範參加者');

async function club(id, name, description, modules, people) {
  const members = {};
  for (const [key, label, role] of people) {
    const user = await account(`${id}.${key}@ucms.test`, label);
    members[key] = user;
    await put(`clubs/${id}/members/${user.uid}`, { name: label, email: user.email, role });
  }
  await put(`clubs/${id}`, { name, description, modules, ...stamp(admin, -30) });
  return members;
}

// ---------- 台大撲克競技社：器材庫存＋盲注計時 ----------
const poker = await club(
  'poker',
  '台大撲克競技社',
  '推廣德州撲克競技活動。（示範資料）',
  { inventory: true, timer: true, feedback: false },
  [
    ['core', '示範社長', 'core'],
    ['officer', '示範公關長', 'officer'],
    ['finance', '示範財務', 'finance'],
    ['member', '示範社員', 'member'],
  ],
);
// ---------- 台大港澳會：活動回饋 ----------
const hkmo = await club(
  'hkmo',
  '台大港澳會',
  '港澳學生的交流與互助社群。（示範資料）',
  { inventory: false, timer: false, feedback: true },
  [
    ['core', '示範會長', 'core'],
    ['officer', '示範秘書', 'officer'],
    ['finance', '示範財務', 'finance'],
    ['member', '示範會員', 'member'],
  ],
);

async function common(id, m, text) {
  const p = `clubs/${id}`;
  await put(`${p}/announcements/a1`, {
    title: text.pinned,
    body: '請各組在會前更新自己的任務狀態，並把要討論的事項寫進會議紀錄。',
    pinned: true,
    ...stamp(m.core, -2),
  });
  await put(`${p}/announcements/a2`, {
    title: '社辦鑰匙借用方式調整',
    body: '即日起借用社辦鑰匙請先在群組登記，歸還後回報。',
    pinned: false,
    ...stamp(m.officer, -5),
  });
  await put(`${p}/meetings/m1`, {
    title: text.meeting,
    date: date(-3),
    attendees: Object.values(m)
      .slice(0, 3)
      .map((u) => u.name)
      .join('、'),
    content: text.content,
    decisions: text.decisions,
    ...stamp(m.officer, -3),
  });
  await put(`${p}/meetings/m0`, {
    title: '學期初幹部會議',
    date: date(-20),
    attendees: Object.values(m)
      .slice(0, 3)
      .map((u) => u.name)
      .join('、'),
    content: '確認本學期活動方向與分工。',
    decisions: '每兩週召開一次幹部會議。',
    ...stamp(m.core, -20),
  });
  const tasks = [
    ['t1', text.tasks[0], m.officer, -1, 'todo', 'm1'],
    ['t2', text.tasks[1], m.core, 2, 'doing', 'm1'],
    ['t3', text.tasks[2], m.finance, 6, 'todo', 'm1'],
    ['t4', text.tasks[3], m.member, 1, 'todo', ''],
    ['t5', text.tasks[4], m.officer, -6, 'done', ''],
    ['t6', '更新社團介紹文字', m.core, 12, 'todo', ''],
  ];
  for (const [tid, title, who, due, status, meetingId] of tasks)
    await put(`${p}/tasks/${tid}`, {
      title,
      description: meetingId ? '來自會議決議，完成後請更新狀態。' : '',
      assigneeId: who.uid,
      dueDate: date(due),
      status,
      meetingId,
      ...stamp(m.core, -3),
    });
}

await common('poker', poker, {
  pinned: '週五例行賽前請確認器材',
  meeting: '期中賽事籌備會議',
  content: '討論期中錦標賽的場地、器材數量與盲注結構。',
  decisions: '1. 借用活動中心 201 室。\n2. 補購兩副撲克牌。\n3. 盲注每級 15 分鐘，第三級後休息。',
  tasks: [
    '借用活動中心場地',
    '確認盲注結構與賽制',
    '編列賽事預算',
    '協助賽前場地佈置',
    '清點籌碼數量',
  ],
});
await common('hkmo', hkmo, {
  pinned: '下次幹部會議前請更新任務進度',
  meeting: '冬至聚會籌備會議',
  content: '討論冬至聚會的場地、餐點與報名方式。',
  decisions: '1. 場地使用學生活動中心。\n2. 報名費每人 NT$150，現場繳交。\n3. 活動後發送回饋表單。',
  tasks: [
    '預約學生活動中心',
    '設計報名與宣傳文案',
    '整理報名費收支',
    '協助活動當天簽到',
    '彙整迎新活動回饋',
  ],
});

async function event(id, eid, by, data) {
  await put(`clubs/${id}/events/${eid}`, { ...data, ...stamp(by, -10) });
}
async function register(id, eid, user, extra = {}) {
  await put(`clubs/${id}/events/${eid}/registrations/${user.uid}`, {
    name: user.name,
    email: user.email,
    studentId: '',
    phone: '',
    note: '',
    checkedIn: false,
    paid: false,
    ...extra,
    ...stamp(user, -4),
  });
}

// 撲克社活動
await event('poker', 'e1', poker.officer, {
  title: '期中錦標賽',
  description: '社內德州撲克錦標賽，採積分制，不涉及金錢投注。',
  location: '活動中心 201 室',
  startAt: at(9, 18, 30),
  endAt: at(9, 22, 0),
  registrationDeadline: at(7, 23, 59),
  fee: 10000,
  published: true,
});
await event('poker', 'e2', poker.officer, {
  title: '新手教學之夜',
  description: '從規則到基本策略的入門課。',
  location: '社辦',
  startAt: at(-12, 19, 0),
  endAt: at(-12, 21, 0),
  registrationDeadline: 0,
  fee: 0,
  published: true,
});
await event('poker', 'e3', poker.core, {
  title: '期末聯誼賽（籌備中）',
  description: '',
  location: '待定',
  startAt: at(40, 18, 30),
  endAt: at(40, 22, 0),
  registrationDeadline: 0,
  fee: 0,
  published: false,
});
await register('poker', 'e1', poker.member, { studentId: 'B00000001' });
await register('poker', 'e1', guest, { note: '第一次參加' });

// 港澳會活動
await event('hkmo', 'e1', hkmo.officer, {
  title: '冬至聚會',
  description: '一起煮湯圓、聊近況。歡迎帶朋友參加。',
  location: '學生活動中心',
  startAt: at(14, 18, 0),
  endAt: at(14, 21, 0),
  registrationDeadline: at(12, 23, 59),
  fee: 15000,
  published: true,
});
await event('hkmo', 'e2', hkmo.officer, {
  title: '迎新茶會',
  description: '認識新朋友與幹部團隊。',
  location: '社辦',
  startAt: at(-9, 18, 0),
  endAt: at(-9, 20, 30),
  registrationDeadline: 0,
  fee: 0,
  published: true,
});
await register('hkmo', 'e1', guest);
await register('hkmo', 'e2', hkmo.member, { checkedIn: true });
await register('hkmo', 'e2', guest, { checkedIn: true });
await put('clubs/hkmo/events/e2/forms/feedback', {
  title: '迎新茶會回饋',
  questions: ['最喜歡哪個環節？', '下次希望增加什麼內容？'],
  open: true,
  ...stamp(hkmo.officer, -9),
});
await put(`clubs/hkmo/events/e2/responses/${hkmo.member.uid}`, {
  rating: 5,
  comment: '氣氛很好。',
  answers: { 0: '自我介紹遊戲', 1: '可以多一點分組聊天時間' },
  ...stamp(hkmo.member, -8),
});

// 財務（金額以「分」為單位儲存：NT$1 = 100）
const money = [
  [
    'poker',
    poker,
    [
      ['社費收入', 'income', 1200000, -25, '社費'],
      ['購買撲克牌', 'expense', 180000, -18, '器材'],
      ['新手教學之夜茶點', 'expense', 65000, -12, '活動'],
      ['學校社團補助', 'income', 500000, -6, '補助'],
    ],
  ],
  [
    'hkmo',
    hkmo,
    [
      ['會費收入', 'income', 900000, -28, '會費'],
      ['迎新茶會餐點', 'expense', 240000, -9, '活動'],
      ['場地清潔費', 'expense', 30000, -9, '活動'],
    ],
  ],
];
for (const [id, m, rows] of money)
  for (const [i, [title, type, amount, days, category]] of rows.entries())
    await put(`clubs/${id}/transactions/x${i + 1}`, {
      title,
      type,
      amount,
      date: date(days),
      category,
      eventId: '',
      note: '',
      ...stamp(m.finance, days),
    });

// 器材庫存與異動紀錄（撲克社）
const items = [
  [
    'i1',
    '撲克牌',
    '副',
    '社辦鐵櫃',
    [
      [12, '學期初盤點'],
      [-2, '牌面磨損報廢'],
    ],
  ],
  ['i2', '籌碼組（500 枚）', '組', '社辦鐵櫃', [[4, '學期初盤點']]],
  [
    'i3',
    '莊家鈕',
    '個',
    '社辦抽屜',
    [
      [6, '學期初盤點'],
      [-1, '借給友社'],
    ],
  ],
  ['i4', '牌桌墊', '張', '活動中心倉庫', [[3, '學期初盤點']]],
];
for (const [iid, name, unit, location, moves] of items) {
  let quantity = 0,
    last = '';
  for (const [n, [delta, reason]] of moves.entries()) {
    last = `${iid}-m${n + 1}`;
    await put(`clubs/poker/inventoryMovements/${last}`, {
      itemId: iid,
      before: quantity,
      after: quantity + delta,
      delta,
      reason,
      ...stamp(poker.officer, -20 + n * 5),
    });
    quantity += delta;
  }
  await put(`clubs/poker/inventory/${iid}`, {
    name,
    unit,
    location,
    quantity,
    note: '',
    lastMovementId: last,
    ...stamp(poker.officer, -20),
  });
}
await put('clubs/poker/blindStructures/b1', {
  title: '社內例行賽（15 分鐘）',
  text: '25,50,0,15\n50,100,0,15\n75,150,0,15\n休息,10\n100,200,200,15\n150,300,300,15\n200,400,400,15',
  ...stamp(poker.officer, -15),
});

console.log(`已匯入示範資料到模擬器專案 ${project}。`);
console.log('示範帳號（密碼見 scripts/seed.mjs 的 DEMO_PASSWORD 與 README）：');
for (const u of [admin, ...Object.values(poker), ...Object.values(hkmo), guest])
  console.log(`  ${u.email.padEnd(26)} ${u.name}`);
