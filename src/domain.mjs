export const ROLE_LABELS = {
  core: '核心幹部',
  officer: '幹部',
  finance: '財務幹部',
  member: '社員',
};
export const STATUS_LABELS = { todo: '待處理', doing: '進行中', done: '已完成' };
export const MODULE_LABELS = { inventory: '器材庫存', timer: '盲注計時', feedback: '活動回饋' };
export const manage = (role) => ['core', 'officer', 'finance'].includes(role);
export const financial = (role) => ['core', 'finance'].includes(role);
// 金額以「分」為單位的整數儲存；顯示為 NT$1,234（必要時到小數兩位）。
export function money(cents) {
  const value = (Number(cents) || 0) / 100;
  const text = new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 2 }).format(Math.abs(value));
  return (value < 0 ? '−' : '') + 'NT$' + text;
}
export function cents(value) {
  const s = String(value).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) throw Error('金額需為非負數，最多兩位小數');
  const n = Math.round(Number(s) * 100);
  if (!Number.isSafeInteger(n) || n > 1e10) throw Error('金額超出範圍');
  return n;
}
export const balance = (rows) =>
  rows.reduce((sum, r) => sum + (r.type === 'income' ? r.amount : -r.amount), 0);
export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function dueState(task, now = new Date()) {
  if (task.status === 'done') return 'done';
  const today = localDate(now);
  if (task.dueDate < today) return 'overdue';
  const near = new Date(now);
  near.setDate(near.getDate() + 3);
  return task.dueDate <= localDate(near) ? 'soon' : 'later';
}
export function toInputDate(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  return (
    localDate(d) +
    'T' +
    String(d.getHours()).padStart(2, '0') +
    ':' +
    String(d.getMinutes()).padStart(2, '0')
  );
}
export function dateTime(ms) {
  return new Intl.DateTimeFormat('zh-TW', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ms));
}
export function validTask(data) {
  if (!data.title?.trim()) throw Error('請填寫任務名稱');
  if (!data.assigneeId) throw Error('請指定負責人');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.dueDate || '')) throw Error('請設定截止日期');
  return data;
}
export function validEvent(data) {
  if (!data.title?.trim()) throw Error('請填寫活動名稱');
  if (!Number.isFinite(data.startAt) || !Number.isFinite(data.endAt) || data.endAt <= data.startAt)
    throw Error('結束時間必須晚於開始時間');
  if (data.registrationDeadline > data.startAt) throw Error('報名截止時間不得晚於活動開始');
  return data;
}
export function inventoryNext(current, delta) {
  if (!Number.isInteger(delta) || delta === 0) throw Error('異動數量需為非零整數');
  const next = current + delta;
  if (!Number.isSafeInteger(next) || next < 0 || next > 1000000)
    throw Error('庫存不可小於零或超過 1,000,000');
  return next;
}
export function parseLevels(text) {
  let number = 0; // 休息不佔級別編號
  const rows = text
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(',').map((s) => s.trim());
      if (parts[0] === '休息') {
        if (parts.length !== 2) return null;
        return {
          label: '休息',
          small: 0,
          big: 0,
          ante: 0,
          seconds: Number(parts[1]) * 60,
          rest: true,
        };
      }
      if (parts.length !== 4) return null;
      const [small, big, ante, minutes] = parts.map(Number);
      number += 1;
      return { label: `第 ${number} 級`, small, big, ante, seconds: minutes * 60, rest: false };
    });
  if (
    !rows.length ||
    rows.length > 50 ||
    rows.some(
      (r) =>
        !r ||
        !Number.isInteger(r.seconds) ||
        r.seconds < 1 ||
        r.seconds > 86400 ||
        [r.small, r.big, r.ante].some((v) => !Number.isInteger(v) || v < 0) ||
        (!r.rest && (r.big < r.small || r.big === 0)),
    )
  )
    throw Error('每行：小盲,大盲,前注,分鐘；休息行：休息,分鐘。請使用有效非負整數盲注與正數時間。');
  return rows;
}
export function advanceTimer(levels, state, now) {
  if (!state.running || state.finished) return state;
  let index = state.index,
    deadline = state.deadline;
  while (now >= deadline) {
    index++;
    if (index >= levels.length)
      return {
        ...state,
        index: levels.length - 1,
        remaining: 0,
        running: false,
        finished: true,
        deadline: 0,
      };
    deadline += levels[index].seconds * 1000;
  }
  return { ...state, index, deadline, remaining: Math.max(0, Math.ceil((deadline - now) / 1000)) };
}
export const timerStart = (levels) => ({
  index: 0,
  remaining: levels[0]?.seconds || 0,
  running: false,
  finished: false,
  deadline: 0,
});
export function xmlEscape(value) {
  return String(value ?? '')
    .replace(
      /[<>&"']/g,
      (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c],
    )
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
}
