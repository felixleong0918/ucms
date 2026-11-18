// 總覽頁的大標題：每次開啟 UCMS 隨機挑一句，且不會和上一次重複。
// 想增減句子直接改這個清單即可；維持「短、兩段式、句號收尾」的語氣。
export const GREETINGS = [
  '一起，把事情做好。',
  '今天，也往前一步。',
  '好點子，值得被完成。',
  '大家到齊，事情就成。',
  '把想法，變成活動。',
  '分工清楚，合作輕鬆。',
  '下一步，從這裡開始。',
  '一點一點，把它完成。',
  '每個人，都算數。',
  '小事做好，大事就成。',
  '有人接手，就能安心。',
  '社團的日常，都在這裡。',
];

const KEY = 'ucms-greeting';

// previous：上一次顯示的索引；random：可注入以便測試。
export function nextGreetingIndex(previous, random = Math.random) {
  const count = GREETINGS.length;
  const valid = Number.isInteger(previous) && previous >= 0 && previous < count;
  if (!valid) return Math.floor(random() * count) % count;
  // 從其餘句子中挑選，保證與上一次不同。
  return (previous + 1 + (Math.floor(random() * (count - 1)) % (count - 1))) % count;
}

export function pickGreeting() {
  let previous = null;
  try {
    const stored = localStorage.getItem(KEY);
    previous = stored === null ? null : Number(stored);
  } catch {}
  const index = nextGreetingIndex(previous);
  try {
    localStorage.setItem(KEY, String(index));
  } catch {}
  return GREETINGS[index];
}
