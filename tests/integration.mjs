// 整合測試：npm run test:integration
// 透過與網頁相同的資料層（src/firebase.mjs）對 Firebase Emulator 發出請求，
// 驗證 firestore.rules 的角色權限、跨社團隔離與各功能流程。
// 每次執行都建立獨立的帳號與社團，不會動到示範資料。
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { loadConfig, assertEmulator, emulatorsUp } from '../scripts/lib.mjs';

const config = await loadConfig();
assertEmulator(config);
if (!(await emulatorsUp(config)).both) {
  console.error('連不到模擬器。請執行 npm run test:integration，或先啟動 npm run emulators。');
  process.exit(1);
}
globalThis.UCMS_CONFIG = config;
const db = await import('../src/firebase.mjs');
const { balance, dueState, inventoryNext, localDate } = await import('../src/domain.mjs');
const { workbook } = await import('../src/export.mjs');

const RUN = 'r' + Date.now().toString(36);
const PASSWORD = 'integration-' + RUN; // 只存在於本機模擬器的測試密碼
const A = `${RUN}-a`; // 社團 A：啟用庫存、計時、回饋
const B = `${RUN}-b`; // 社團 B：未啟用專屬模組
const DAY = 86400000;
const users = {};

const stamp = (uid, existing) => ({
  createdAt: existing?.createdAt ?? Date.now(),
  updatedAt: Date.now(),
  createdBy: existing?.createdBy ?? uid,
});
const as = async (name) => {
  if (!name) return db.logout();
  await db.login(users[name].email, PASSWORD);
  return users[name];
};
// 安全規則拒絕時，Firestore 回傳 403 PERMISSION_DENIED。
const denied = (promise, message) =>
  assert.rejects(
    promise,
    (error) => {
      assert.equal(
        error.status,
        403,
        `${message}：預期 403，實際 ${error.status} ${error.message}`,
      );
      return true;
    },
    message,
  );
const rejected = (promise, message) => assert.rejects(promise, message);
const owner = (path, data) =>
  fetch(`${db.base}/${path}`, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: db.encodeFields(data) }),
  }).then((res) => assert.ok(res.ok, `owner 寫入 ${path} 失敗`));

const club = (id, name, modules, uid) => ({
  name,
  description: '整合測試',
  modules,
  ...stamp(uid),
});
const member = (name, role) => ({ name, email: users[name].email, role });

before(async () => {
  for (const name of [
    'admin',
    'coreA',
    'officerA',
    'financeA',
    'memberA',
    'coreB',
    'guest',
    'stranger',
  ]) {
    const email = `${RUN}.${name.toLowerCase()}@ucms.test`;
    const session = await db.register(email, PASSWORD);
    await db.save('users/' + session.uid, { name, email });
    users[name] = { uid: session.uid, email };
  }
  // 系統管理者只能由受信任的後端指定；模擬器以 owner 權限建立。
  await owner('admins/' + users.admin.uid, { createdAt: Date.now() });

  const admin = await as('admin');
  await db.save(
    'clubs/' + A,
    club(A, '測試社團 A', { inventory: true, timer: true, feedback: true }, admin.uid),
  );
  await db.save(
    'clubs/' + B,
    club(B, '測試社團 B', { inventory: false, timer: false, feedback: false }, admin.uid),
  );
  await db.save(`clubs/${A}/members/${users.coreA.uid}`, member('coreA', 'core'));
  await db.save(`clubs/${B}/members/${users.coreB.uid}`, member('coreB', 'core'));

  await as('coreA');
  await db.save(`clubs/${A}/members/${users.officerA.uid}`, member('officerA', 'officer'));
  await db.save(`clubs/${A}/members/${users.financeA.uid}`, member('financeA', 'finance'));
  await db.save(`clubs/${A}/members/${users.memberA.uid}`, member('memberA', 'member'));
});

test('1. 登入與帳號', async () => {
  await assert.rejects(db.login(users.coreA.email, 'wrong-password'), /帳號或密碼不正確/);
  await assert.rejects(db.register(users.coreA.email, PASSWORD), /已註冊/);

  const me = await as('memberA');
  assert.equal(db.currentUser().uid, me.uid);
  assert.equal((await db.get('users/' + me.uid)).email, me.email);
  await denied(db.get('users/' + users.coreA.uid), '不能讀取他人的使用者檔案');
  await denied(
    db.save('users/' + users.coreA.uid, { name: 'x', email: me.email }),
    '不能建立他人的使用者檔案',
  );
  await denied(db.save('admins/' + me.uid, { createdAt: 1 }), '不能自行取得系統管理者權限');

  db.logout();
  assert.equal(db.currentUser(), null);
});

test('2. 社團與成員管理權限', async () => {
  const officer = await as('officerA');
  await denied(
    db.save(
      `clubs/${RUN}-x`,
      club('x', '私自建立', { inventory: false, timer: false, feedback: false }, officer.uid),
    ),
    '非系統管理者不能建立社團',
  );
  await denied(
    db.save(`clubs/${A}/members/${users.stranger.uid}`, member('stranger', 'officer')),
    '一般幹部不能加入成員',
  );
  assert.equal((await db.list(`clubs/${A}/members`)).length, 4, '幹部可以查看成員名單');

  const core = await as('coreA');
  const own = await db.get(`clubs/${A}/members/${core.uid}`);
  await denied(
    db.save(`clubs/${A}/members/${core.uid}`, { ...member('coreA', 'member') }, own),
    '核心幹部不能修改自己的角色',
  );
  await denied(db.remove(`clubs/${A}/members/${core.uid}`, own), '核心幹部不能移除自己');
  await denied(
    db.save(`clubs/${A}/members/${users.stranger.uid}`, {
      name: 'x',
      email: 'x@ucms.test',
      role: 'owner',
    }),
    '不接受未定義的角色',
  );
  await denied(
    db.save(`clubs/${A}/members/ghost-${RUN}`, {
      name: 'ghost',
      email: 'g@ucms.test',
      role: 'member',
    }),
    '尚未註冊的 UID 不能加入',
  );

  const a = await db.get('clubs/' + A);
  await db.save('clubs/' + A, { ...a, description: '核心幹部更新', updatedAt: Date.now() }, a);
  assert.equal((await db.get('clubs/' + A)).description, '核心幹部更新');

  await as('memberA');
  await denied(db.list(`clubs/${A}/members`), '社員不能查看成員名單');
  assert.equal(
    (await db.get(`clubs/${A}/members/${users.memberA.uid}`)).role,
    'member',
    '可以讀取自己的成員資料',
  );
});

test('3. 未登入與非成員無法存取內部資料', async () => {
  const officer = await as('officerA');
  const seedTask = db.newId();
  await db.save(`clubs/${A}/tasks/${seedTask}`, {
    title: '內部任務',
    description: '',
    assigneeId: officer.uid,
    dueDate: '2030-01-01',
    status: 'todo',
    meetingId: '',
    ...stamp(officer.uid),
  });

  for (const who of [null, 'stranger']) {
    await as(who);
    const label = who ? '非成員' : '未登入';
    assert.ok(
      (await db.list('clubs')).some((c) => c.id === A),
      `${label}可以看到社團清單`,
    );
    for (const collection of [
      'members',
      'tasks',
      'announcements',
      'meetings',
      'transactions',
      'inventory',
      'inventoryMovements',
      'blindStructures',
    ])
      await denied(db.list(`clubs/${A}/${collection}`), `${label}不能讀取 ${collection}`);
    await denied(db.get(`clubs/${A}/tasks/${seedTask}`), `${label}不能讀取單一任務`);
    await rejected(
      db.save(`clubs/${A}/tasks/${db.newId()}`, {
        title: '入侵',
        description: '',
        assigneeId: officer.uid,
        dueDate: '2030-01-01',
        status: 'todo',
        meetingId: '',
        ...stamp(who ? users[who].uid : 'anon'),
      }),
      `${label}不能建立任務`,
    );
  }
});

test('4. 跨社團隔離', async () => {
  const coreB = await as('coreB');
  for (const collection of [
    'members',
    'tasks',
    'announcements',
    'meetings',
    'transactions',
    'inventory',
  ])
    await denied(
      db.list(`clubs/${A}/${collection}`),
      `社團 B 的核心幹部不能讀取社團 A 的 ${collection}`,
    );
  await denied(
    db.save(`clubs/${A}/announcements/${db.newId()}`, {
      title: '跨社團公告',
      body: '',
      pinned: false,
      ...stamp(coreB.uid),
    }),
    '不能在其他社團發布公告',
  );
  await denied(
    db.save(`clubs/${A}/members/${coreB.uid}`, member('coreB', 'core')),
    '不能把自己加入其他社團',
  );
  const a = await db.get('clubs/' + A);
  await denied(
    db.save('clubs/' + A, { ...a, name: '被改名', updatedAt: Date.now() }, a),
    '不能修改其他社團設定',
  );
  await denied(
    db.save(`clubs/${A}/transactions/${db.newId()}`, {
      title: 'x',
      type: 'income',
      amount: 100,
      date: '2026-01-01',
      category: '',
      eventId: '',
      note: '',
      ...stamp(coreB.uid),
    }),
    '不能寫入其他社團帳目',
  );

  // 在自己的社團則可以
  await db.save(`clubs/${B}/announcements/${db.newId()}`, {
    title: 'B 的公告',
    body: '',
    pinned: false,
    ...stamp(coreB.uid),
  });
  assert.equal((await db.list(`clubs/${B}/announcements`)).length, 1);
});

test('5. 公告與已讀狀態', async () => {
  const officer = await as('officerA');
  const id = db.newId();
  await db.save(`clubs/${A}/announcements/${id}`, {
    title: '例會提醒',
    body: '請準時',
    pinned: true,
    ...stamp(officer.uid),
  });
  await db.save(`clubs/${A}/announcements/${id}/reads/${officer.uid}`, { readAt: Date.now() });
  await denied(
    db.save(`clubs/${A}/announcements/${id}/reads/${users.coreA.uid}`, { readAt: Date.now() }),
    '不能替他人標記已讀',
  );

  await as('coreA');
  const reads = await db.list(`clubs/${A}/announcements/${id}/reads`);
  assert.deepEqual(
    reads.map((r) => r.id),
    [officer.uid],
    '可以看到誰已閱讀',
  );

  await as('memberA');
  await denied(db.list(`clubs/${A}/announcements`), '社員不能讀取幹部公告');
});

test('6. 會議決議轉任務、負責人更新狀態', async () => {
  const officer = await as('officerA');
  const meetingId = db.newId();
  await db.save(`clubs/${A}/meetings/${meetingId}`, {
    title: '籌備會議',
    date: localDate(),
    attendees: 'coreA、officerA',
    content: '討論場地',
    decisions: '由 memberA 借場地',
    ...stamp(officer.uid),
  });

  const task = (extra = {}) => ({
    title: '借場地',
    description: '由 memberA 借場地',
    assigneeId: users.memberA.uid,
    dueDate: localDate(new Date(Date.now() + 2 * DAY)),
    status: 'todo',
    meetingId,
    ...stamp(officer.uid),
    ...extra,
  });
  await denied(
    db.save(`clubs/${A}/tasks/${db.newId()}`, task({ assigneeId: users.stranger.uid })),
    '負責人必須是社團成員',
  );
  await denied(
    db.save(`clubs/${A}/tasks/${db.newId()}`, task({ dueDate: '' })),
    '必須設定截止日期',
  );
  await denied(db.save(`clubs/${A}/tasks/${db.newId()}`, task({ title: '' })), '必須有任務名稱');
  const taskId = db.newId();
  await db.save(`clubs/${A}/tasks/${taskId}`, task());

  const me = await as('memberA');
  await denied(db.list(`clubs/${A}/tasks`), '社員不能列出所有任務');
  await denied(db.list(`clubs/${A}/meetings`), '社員不能讀取會議紀錄');
  const mine = await db.query(`clubs/${A}/tasks`, 'assigneeId', me.uid);
  assert.equal(mine.length, 1, '社員可以查到自己的任務');
  assert.equal(mine[0].meetingId, meetingId, '任務保留會議來源');
  assert.equal(dueState(mine[0]), 'soon', '兩天後到期的任務會顯示即將到期');
  await denied(
    db.save(
      `clubs/${A}/tasks/${taskId}`,
      { ...mine[0], title: '改標題', updatedAt: Date.now() },
      mine[0],
    ),
    '負責人只能更新狀態',
  );
  await denied(
    db.save(`clubs/${A}/tasks/${db.newId()}`, task({ createdBy: me.uid })),
    '社員不能建立任務',
  );
  await db.save(
    `clubs/${A}/tasks/${taskId}`,
    { ...mine[0], status: 'done', updatedAt: Date.now() },
    mine[0],
  );

  await as('coreA');
  const all = await db.list(`clubs/${A}/tasks`);
  const done = all.find((t) => t.id === taskId);
  assert.equal(done.status, 'done', '管理者看得到更新後的進度');
  assert.equal(all.filter((t) => t.meetingId === meetingId).length, 1);
});

let eventId;
test('7. 活動報名、簽到與收費', async () => {
  const officer = await as('officerA');
  const event = (extra = {}) => ({
    title: '冬至聚會',
    description: '',
    location: '活動中心',
    startAt: Date.now() + 7 * DAY,
    endAt: Date.now() + 7 * DAY + 7200000,
    registrationDeadline: 0,
    fee: 15000,
    published: true,
    ...stamp(officer.uid),
    ...extra,
  });
  eventId = db.newId();
  const draftId = db.newId(),
    closedId = db.newId();
  await db.save(`clubs/${A}/events/${eventId}`, event());
  await db.save(`clubs/${A}/events/${draftId}`, event({ title: '草稿', published: false }));
  await db.save(
    `clubs/${A}/events/${closedId}`,
    event({ title: '已截止', registrationDeadline: 1 }),
  );
  await denied(
    db.save(`clubs/${A}/events/${db.newId()}`, event({ endAt: 1 })),
    '結束時間必須晚於開始時間',
  );
  await denied(db.save(`clubs/${A}/events/${db.newId()}`, event({ fee: -1 })), '費用不可為負數');

  await as(null);
  assert.equal(
    (await db.get(`clubs/${A}/events/${eventId}`)).title,
    '冬至聚會',
    '未登入可以看公開活動',
  );
  await denied(db.get(`clubs/${A}/events/${draftId}`), '未登入不能看草稿活動');
  const published = await db.query(`clubs/${A}/events`, 'published', true);
  assert.ok(published.every((e) => e.published) && published.length === 2);

  const guest = await as('guest');
  const base = `clubs/${A}/events/${eventId}/registrations/`;
  const registration = (extra = {}) => ({
    name: '參加者',
    email: guest.email,
    studentId: 'B00000000',
    phone: '',
    note: '',
    checkedIn: false,
    paid: false,
    ...stamp(guest.uid),
    ...extra,
  });
  await denied(db.save(base + guest.uid, registration({ paid: true })), '不能自行標記已收費');
  await denied(db.save(base + guest.uid, registration({ checkedIn: true })), '不能自行標記已簽到');
  await denied(db.save(base + guest.uid, registration({ name: '' })), '報名資料不完整時拒絕');
  await denied(
    db.save(base + guest.uid, registration({ email: 'other@ucms.test' })),
    '電子郵件必須是登入帳號',
  );
  await denied(db.save(base + users.stranger.uid, registration()), '不能替他人報名');
  await denied(
    db.save(`clubs/${A}/events/${draftId}/registrations/${guest.uid}`, registration()),
    '草稿活動不能報名',
  );
  await denied(
    db.save(`clubs/${A}/events/${closedId}/registrations/${guest.uid}`, registration()),
    '報名截止後不能報名',
  );
  await db.save(base + guest.uid, registration());
  await rejected(db.save(base + guest.uid, registration()), '不能重複報名');
  await denied(db.list(base.slice(0, -1)), '參加者不能看到整份名單');
  const own = await db.get(base + guest.uid);
  await denied(
    db.save(base + guest.uid, { ...own, paid: true, updatedAt: Date.now() }, own),
    '參加者不能修改收費狀態',
  );

  await as('memberA');
  await denied(db.list(base.slice(0, -1)), '一般社員不能看報名名單');

  await as('officerA');
  let rows = await db.list(base.slice(0, -1));
  assert.equal(rows.length, 1);
  await denied(
    db.save(base + guest.uid, { ...rows[0], name: '被竄改', updatedAt: Date.now() }, rows[0]),
    '幹部只能更新簽到與收費',
  );
  await db.save(base + guest.uid, { ...rows[0], checkedIn: true, updatedAt: Date.now() }, rows[0]);
  rows = await db.list(base.slice(0, -1));
  await db.save(base + guest.uid, { ...rows[0], paid: true, updatedAt: Date.now() }, rows[0]);
  rows = await db.list(base.slice(0, -1));
  assert.deepEqual([rows[0].checkedIn, rows[0].paid], [true, true]);

  // 匯出名單
  const xlsx = await workbook(
    ['姓名', '電子郵件', '簽到', '收費'],
    rows.map((r) => [
      r.name,
      r.email,
      r.checkedIn ? '已簽到' : '未簽到',
      r.paid ? '已收費' : '未收費',
    ]),
  );
  const sheet = await (
    await JSZip.loadAsync(xlsx)
  )
    .file('xl/worksheets/sheet1.xml')
    .async('string');
  assert.match(sheet, /已簽到/);
  assert.match(sheet, /已收費/);

  await as('guest');
  const after = await db.get(base + guest.uid);
  assert.deepEqual([after.checkedIn, after.paid], [true, true], '參加者看得到自己的簽到與收費狀態');
});

test('8. 財務收支與結餘', async () => {
  const finance = await as('financeA');
  const row = (title, type, amount) => ({
    title,
    type,
    amount,
    date: localDate(),
    category: '測試',
    eventId: '',
    note: '',
    ...stamp(finance.uid),
  });
  const incomeId = db.newId(),
    expenseId = db.newId();
  await db.save(`clubs/${A}/transactions/${incomeId}`, row('社費', 'income', 1200000));
  await db.save(`clubs/${A}/transactions/${expenseId}`, row('器材', 'expense', 180000));
  await denied(
    db.save(`clubs/${A}/transactions/${db.newId()}`, row('零元', 'income', 0)),
    '金額必須大於零',
  );
  await denied(
    db.save(`clubs/${A}/transactions/${db.newId()}`, row('小數', 'income', 150.5)),
    '金額必須是整數（分）',
  );
  await denied(
    db.save(`clubs/${A}/transactions/${db.newId()}`, row('類型錯誤', 'refund', 100)),
    '類型只能是收入或支出',
  );
  let rows = await db.list(`clubs/${A}/transactions`);
  assert.equal(balance(rows), 1020000, '結餘 = 收入 − 支出');
  await denied(
    db.remove(
      `clubs/${A}/transactions/${expenseId}`,
      rows.find((r) => r.id === expenseId),
    ),
    '財務幹部不能刪除帳目',
  );

  await as('officerA');
  await denied(db.list(`clubs/${A}/transactions`), '一般幹部不能查閱財務');
  await denied(
    db.save(`clubs/${A}/transactions/${db.newId()}`, {
      ...row('越權', 'income', 100),
      createdBy: users.officerA.uid,
    }),
    '一般幹部不能登記收支',
  );

  await as('coreA');
  rows = await db.list(`clubs/${A}/transactions`);
  await db.remove(
    `clubs/${A}/transactions/${expenseId}`,
    rows.find((r) => r.id === expenseId),
  );
  assert.equal(
    balance(await db.list(`clubs/${A}/transactions`)),
    1200000,
    '核心幹部刪除後結餘更新',
  );
});

test('9. 器材庫存與異動紀錄', async () => {
  const officer = await as('officerA');
  const itemId = db.newId();
  const item = (extra = {}) => ({
    name: '撲克牌',
    unit: '副',
    location: '社辦',
    quantity: 0,
    note: '',
    lastMovementId: '',
    ...stamp(officer.uid),
    ...extra,
  });
  await denied(
    db.save(`clubs/${A}/inventory/${db.newId()}`, item({ quantity: 5 })),
    '新增器材時數量必須為 0',
  );
  await db.save(`clubs/${A}/inventory/${itemId}`, item());

  // 與介面相同：庫存與異動紀錄在同一次 commit 寫入
  const adjust = async (delta, reason, tamper = {}) => {
    const current = await db.get(`clubs/${A}/inventory/${itemId}`);
    const next = tamper.next ?? inventoryNext(current.quantity, delta);
    const id = db.newId(),
      now = Date.now();
    return db.commit([
      db.write(
        `clubs/${A}/inventory/${itemId}`,
        { ...current, quantity: next, lastMovementId: id, updatedAt: now },
        current,
      ),
      db.write(`clubs/${A}/inventoryMovements/${id}`, {
        itemId,
        before: current.quantity,
        after: next,
        delta: tamper.delta ?? delta,
        reason,
        createdAt: now,
        updatedAt: now,
        createdBy: officer.uid,
      }),
    ]);
  };
  await adjust(10, '入庫');
  await adjust(-3, '報廢');
  let current = await db.get(`clubs/${A}/inventory/${itemId}`);
  assert.equal(current.quantity, 7);
  const moves = (await db.list(`clubs/${A}/inventoryMovements`)).filter((m) => m.itemId === itemId);
  assert.deepEqual(
    moves.map((m) => m.delta).sort((a, b) => a - b),
    [-3, 10],
    '每次異動都有紀錄',
  );

  assert.throws(() => inventoryNext(7, -8), /不可小於零/, '介面先擋下負庫存');
  await denied(adjust(-8, '超領', { next: -1 }), '規則拒絕負庫存');
  await denied(adjust(5, '紀錄不符', { delta: 4 }), '異動紀錄必須與數量變化一致');
  await denied(
    db.save(
      `clubs/${A}/inventory/${itemId}`,
      { ...current, quantity: 99, updatedAt: Date.now() },
      current,
    ),
    '不能略過異動紀錄直接改數量',
  );
  await denied(
    db.save(`clubs/${A}/inventoryMovements/${db.newId()}`, {
      itemId,
      before: 7,
      after: 8,
      delta: 1,
      reason: '偽造',
      ...stamp(officer.uid),
    }),
    '不能單獨新增異動紀錄',
  );
  current = await db.get(`clubs/${A}/inventory/${itemId}`);
  assert.equal(current.quantity, 7, '被拒絕的操作不影響庫存');
  await db.save(
    `clubs/${A}/inventory/${itemId}`,
    { ...current, location: '活動中心', updatedAt: Date.now() },
    current,
  );

  await as('memberA');
  await denied(db.list(`clubs/${A}/inventory`), '社員不能查看庫存');

  const coreB = await as('coreB');
  await denied(
    db.save(`clubs/${B}/inventory/${db.newId()}`, { ...item(), createdBy: coreB.uid }),
    '未啟用庫存模組的社團不能使用',
  );
});

test('10. 盲注結構儲存', async () => {
  const officer = await as('officerA');
  const id = db.newId();
  await db.save(`clubs/${A}/blindStructures/${id}`, {
    title: '例行賽',
    text: '25,50,0,15\n休息,5\n50,100,0,15',
    ...stamp(officer.uid),
  });
  assert.equal((await db.list(`clubs/${A}/blindStructures`)).length, 1);

  await as('memberA');
  await denied(db.list(`clubs/${A}/blindStructures`), '社員不能讀取盲注結構');
  const coreB = await as('coreB');
  await denied(
    db.save(`clubs/${B}/blindStructures/${db.newId()}`, {
      title: 'x',
      text: '25,50,0,15',
      ...stamp(coreB.uid),
    }),
    '未啟用計時模組的社團不能使用',
  );
});

test('11. 活動回饋表單與回覆', async () => {
  const officer = await as('officerA');
  const base = `clubs/${A}/events/${eventId}`;
  await db.save(`${base}/forms/feedback`, {
    title: '活動回饋',
    questions: ['最喜歡哪個環節？'],
    open: true,
    ...stamp(officer.uid),
  });
  await denied(
    db.save(`${base}/forms/other`, {
      title: 'x',
      questions: [],
      open: true,
      ...stamp(officer.uid),
    }),
    '每場活動只有一份回饋表單',
  );

  const guest = await as('guest');
  const response = (uid, extra = {}) => ({
    rating: 5,
    comment: '很棒',
    answers: { 0: '抽獎' },
    ...stamp(uid),
    ...extra,
  });
  await denied(
    db.save(`${base}/responses/${guest.uid}`, response(guest.uid, { rating: 6 })),
    '評分必須是 1–5',
  );
  await db.save(`${base}/responses/${guest.uid}`, response(guest.uid));
  await rejected(
    db.save(`${base}/responses/${guest.uid}`, response(guest.uid, { rating: 1 })),
    '每人只能提交一次',
  );
  await denied(db.list(`${base}/responses`), '參加者不能看到其他人的回覆');

  const stranger = await as('stranger');
  await denied(
    db.save(`${base}/responses/${stranger.uid}`, response(stranger.uid)),
    '未報名者不能提交回饋',
  );
  await db.save(`${base}/registrations/${stranger.uid}`, {
    name: '第二位',
    email: stranger.email,
    studentId: '',
    phone: '',
    note: '',
    checkedIn: false,
    paid: false,
    ...stamp(stranger.uid),
  });

  await as('officerA');
  let form = await db.get(`${base}/forms/feedback`);
  await db.save(`${base}/forms/feedback`, { ...form, open: false, updatedAt: Date.now() }, form);
  await as('stranger');
  await denied(
    db.save(`${base}/responses/${stranger.uid}`, response(stranger.uid)),
    '表單關閉後不能提交',
  );
  await as('officerA');
  form = await db.get(`${base}/forms/feedback`);
  await db.save(`${base}/forms/feedback`, { ...form, open: true, updatedAt: Date.now() }, form);
  await as('stranger');
  await db.save(
    `${base}/responses/${stranger.uid}`,
    response(stranger.uid, { rating: 3, comment: '' }),
  );

  await as('officerA');
  const responses = await db.list(`${base}/responses`);
  assert.equal(responses.length, 2);
  assert.equal(responses.reduce((n, r) => n + r.rating, 0) / responses.length, 4, '平均評分');

  // 未啟用回饋模組的社團
  const coreB = await as('coreB');
  const eventB = db.newId();
  await db.save(`clubs/${B}/events/${eventB}`, {
    title: 'B 活動',
    description: '',
    location: '',
    startAt: Date.now() + DAY,
    endAt: Date.now() + 2 * DAY,
    registrationDeadline: 0,
    fee: 0,
    published: true,
    ...stamp(coreB.uid),
  });
  await denied(
    db.save(`clubs/${B}/events/${eventB}/forms/feedback`, {
      title: 'x',
      questions: [],
      open: true,
      ...stamp(coreB.uid),
    }),
    '未啟用回饋模組的社團不能建立表單',
  );
});
