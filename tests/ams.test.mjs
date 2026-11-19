import assert from "node:assert/strict";
import { test } from "node:test";

import {
  advice, ascentLevel, lakeLouise, toText,
} from "../src/ams.js";

test("不填海拔返回 unknown", () => {
  assert.equal(ascentLevel(NaN, 3000), "unknown");
  assert.equal(ascentLevel(3000, NaN), "unknown");
});

test("2500 以下不套上升限制", () => {
  assert.equal(ascentLevel(1800, 2400), "below");
});

test("500 m 以内算正常", () => {
  assert.equal(ascentLevel(3300, 3700), "ok");
  assert.equal(ascentLevel(3300, 3800), "ok");
});

test("500 到 1000 算偏快", () => {
  assert.equal(ascentLevel(2200, 3000), "fast");
});

test("超过 1000 算过快", () => {
  assert.equal(ascentLevel(3300, 4400), "too-fast");
});

test("下撤或持平", () => {
  assert.equal(ascentLevel(3700, 3100), "down");
  assert.equal(ascentLevel(3100, 3100), "down");
});

test("头痛为 0 且总分不到 3 不算 AMS", () => {
  assert.equal(lakeLouise({ gut: 1, fatigue: 1 }).verdict, "none");
});

test("头痛加总分 3 判 AMS", () => {
  const value = lakeLouise({ headache: 1, gut: 1, fatigue: 1 });
  assert.equal(value.total, 3);
  assert.equal(value.verdict, "ams");
});

test("总分 6 判中重度", () => {
  assert.equal(lakeLouise({ headache: 2, gut: 2, fatigue: 2 }).verdict, "severe");
});

test("单项封顶 3 分", () => {
  assert.equal(lakeLouise({ headache: 9 }).total, 3);
});

test("空输入不炸", () => {
  assert.equal(lakeLouise({}).verdict, "none");
});

test("红旗项排在最前", () => {
  const items = advice({ scores: {}, flags: ["走路不稳"], prevSleep: 3000, todaySleep: 3100 });
  assert.match(items[0].text, /立即下撤/);
  assert.equal(items[0].tone, "alert");
});

test("中重度给下降距离", () => {
  const items = advice({
    scores: { headache: 3, gut: 3, fatigue: 0, dizzy: 0 },
    prevSleep: 3700,
    todaySleep: 3700,
  });
  assert.ok(items.some((item) => /500 m/.test(item.text)));
});

test("无症状也提醒别再拔高", () => {
  const items = advice({ scores: {}, prevSleep: 3000, todaySleep: 3100 });
  assert.ok(items.some((item) => /500 m 以上/.test(item.text)));
});

test("总带一句免责", () => {
  const items = advice({ scores: {}, prevSleep: 3000, todaySleep: 3100 });
  assert.ok(items.some((item) => /不替代医生/.test(item.text)));
});

test("上升过快额外提醒适应", () => {
  const items = advice({ scores: {}, prevSleep: 2200, todaySleep: 4000 });
  assert.ok(items.some((item) => /适应/.test(item.text)));
});

test("导出文本含海拔与总分", () => {
  const text = toText({
    at: "2026-11-18 08:00",
    prevSleep: 3300,
    todaySleep: 3700,
    scores: { headache: 1, fatigue: 1 },
    flags: [],
  });
  assert.match(text, /3300→3700|3300 m → 今天到 3700 m/);
  assert.match(text, /总分：2/);
});
