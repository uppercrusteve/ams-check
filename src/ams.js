// 纯计算，无 DOM。所有阈值与判定集中在这里，方便单测。

export const SYMPTOMS = [
  { key: "headache", label: "头痛" },
  { key: "gut", label: "恶心、呕吐、食欲差" },
  { key: "fatigue", label: "疲乏、虚弱" },
  { key: "dizzy", label: "头晕、走路发飘" },
];

export const SCORES = [
  { value: 0, label: "无" },
  { value: 1, label: "轻" },
  { value: 2, label: "中" },
  { value: 3, label: "重" },
];

// 睡眠海拔每日上升的通用建议线（WMS / CDC：海拔 2500 m 以上，睡眠海拔 +500 m/日，
// 每 1000 m 安排一天适应）。只是通用建议，不是个人处方。
export const RULES = { watch: 500, fast: 1000, floor: 2500 };

export const RED_FLAGS = [
  { key: "breath", label: "躺着也喘，平静时呼吸明显费力" },
  { key: "cough", label: "干咳不停，或咳出粉红色泡沫痰" },
  { key: "gait", label: "走路不稳，像喝醉，需要人扶" },
  { key: "confusion", label: "说话糊涂、嗜睡、叫不太醒" },
  { key: "rest", label: "休息一晚完全没有好转，甚至更重" },
];

export function ascentLevel(prevSleep, todaySleep) {
  if (!Number.isFinite(prevSleep) || !Number.isFinite(todaySleep)) return "unknown";
  const delta = todaySleep - prevSleep;
  if (todaySleep < RULES.floor && prevSleep < RULES.floor) return "below";
  if (delta <= 0) return "down";
  if (delta <= RULES.watch) return "ok";
  if (delta <= RULES.fast) return "fast";
  return "too-fast";
}

export const ASCENT_TEXT = {
  unknown: { tone: "muted", title: "先填海拔", note: "两个海拔都要填才能算净上升。" },
  below: { tone: "ok", title: "在 2500 m 以下", note: "这个高度上升限制通常放宽，照常走。" },
  down: { tone: "ok", title: "没有净上升", note: "下撤或持平，负担不增加。" },
  ok: { tone: "ok", title: "上升幅度正常", note: "睡眠海拔上升不超过 500 m，符合通用建议。" },
  fast: {
    tone: "watch",
    title: "上升偏快",
    note: "超过 500 m/日。今晚如果头痛，明天就地停一天，别再抬睡眠海拔。",
  },
  "too-fast": {
    tone: "alert",
    title: "上升过快",
    note: "超过 1000 m/日。今晚按海拔低一档的地方睡，或者明天安排适应日。",
  },
};

export function lakeLouise(scores) {
  const headache = clamp(scores.headache);
  const total =
    headache + clamp(scores.gut) + clamp(scores.fatigue) + clamp(scores.dizzy);
  const value = { total, headache, verdict: "none" };
  if (total >= 6) value.verdict = "severe";
  else if (headache >= 1 && total >= 3) value.verdict = "ams";
  return value;
}

function clamp(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(3, Math.max(0, Math.round(number)));
}

export const VERDICT_TEXT = {
  none: {
    tone: "ok",
    title: "按量表不像高原病",
    note: "头痛为 0 或总分不到 3 分。继续观察，别在同一天再抬睡眠海拔。",
  },
  ams: {
    tone: "watch",
    title: "符合急性高原反应（AMS）",
    note: "头痛 + 总分 ≥3。停止上升，原地休息补水；24 小时内不缓解就下降。",
  },
  severe: {
    tone: "alert",
    title: "中重度，考虑下撤",
    note: "总分 ≥6。今天就下降至少 500 m，别等第二天。",
  },
};

export function advice({ scores, flags = [], prevSleep, todaySleep }) {
  const { verdict } = lakeLouise(scores || {});
  const ascent = ascentLevel(prevSleep, todaySleep);
  const raised = flags.length > 0;
  const items = [];

  if (raised) {
    items.push({
      tone: "alert",
      text: "有红旗项：立即下撤到低处并就医，不要原地过夜。",
    });
  }
  if (verdict === "severe") {
    items.push({ tone: "alert", text: "今天下降 500 m 以上，下降后症状通常明显缓解。" });
  } else if (verdict === "ams") {
    items.push({ tone: "watch", text: "取消今天的爬升，多喝水，别喝酒，别用力。" });
    items.push({ tone: "watch", text: "24 小时内没好转、或出现红旗项，就下撤。" });
  } else {
    items.push({ tone: "ok", text: "可以继续，但今晚睡眠海拔别比昨晚高 500 m 以上。" });
  }
  if (ascent === "too-fast" || ascent === "fast") {
    items.push({ tone: "watch", text: "上升偏快：明天加一天适应，或回到低处睡。" });
  }
  items.push({ tone: "muted", text: "评分只是自评，不替代医生判断。" });
  return items;
}

export function toText(entry) {
  const { total, verdict } = lakeLouise(entry.scores || {});
  const lines = [
    `时间：${entry.at}`,
    `海拔：昨晚睡 ${entry.prevSleep} m → 今天到 ${entry.todaySleep} m`,
    `Lake Louise 总分：${total}（${VERDICT_TEXT[verdict].title}）`,
  ];
  if (entry.flags?.length) lines.push(`红旗：${entry.flags.join("、")}`);
  return lines.join("\n");
}
