import {
  ASCENT_TEXT, RED_FLAGS, SCORES, SYMPTOMS, VERDICT_TEXT,
  advice, ascentLevel, lakeLouise, toText,
} from "./ams.js";
import { ROUTES, ROUTE_VERIFIED } from "./routes.js";

const KEY = "ams-check.log.v1";
const state = { scores: {}, flags: new Set(), prevSleep: NaN, todaySleep: NaN };

const $ = (id) => document.getElementById(id);

function renderSymptoms() {
  const host = $("symptoms");
  host.innerHTML = "";
  for (const symptom of SYMPTOMS) {
    const field = document.createElement("fieldset");
    const legend = document.createElement("legend");
    legend.textContent = symptom.label;
    field.append(legend);
    const group = document.createElement("div");
    group.className = "choices";
    for (const score of SCORES) {
      const id = `${symptom.key}-${score.value}`;
      const label = document.createElement("label");
      label.htmlFor = id;
      const input = document.createElement("input");
      input.type = "radio";
      input.name = symptom.key;
      input.id = id;
      input.value = String(score.value);
      input.ariaLabel = `${symptom.label} ${score.label}分`;
      input.addEventListener("change", () => {
        state.scores[symptom.key] = score.value;
        update();
      });
      label.append(input, document.createTextNode(String(score.value)));
      label.title = score.label;
      group.append(label);
    }
    field.append(group);
    host.append(field);
  }
}

function renderFlags() {
  const host = $("flags");
  for (const flag of RED_FLAGS) {
    const label = document.createElement("label");
    label.className = "flag";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.addEventListener("change", () => {
      if (input.checked) state.flags.add(flag.label);
      else state.flags.delete(flag.label);
      update();
    });
    label.append(input, document.createTextNode(flag.label));
    host.append(label);
  }
}

function renderRoutes() {
  $("routeNote").textContent = `参考值，核实于 ${ROUTE_VERIFIED}，未实测。`;
  const host = $("routes");
  for (const route of ROUTES) {
    const block = document.createElement("div");
    block.className = "route";
    const heading = document.createElement("h3");
    heading.textContent = route.name;
    const note = document.createElement("p");
    note.className = "hint";
    note.textContent = route.note;
    const list = document.createElement("div");
    list.className = "pills";
    for (const point of route.points) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "pill";
      button.textContent = `${point.name} ${point.m} m`;
      button.addEventListener("click", () => {
        const previous = Number($("todaySleep").value);
        if (Number.isFinite(previous) && previous > 0) $("prevSleep").value = String(previous);
        $("todaySleep").value = String(point.m);
        readSleep();
      });
      list.append(button);
    }
    block.append(heading, note, list);
    host.append(block);
  }
}

function readSleep() {
  const previous = Number($("prevSleep").value);
  const today = Number($("todaySleep").value);
  state.prevSleep = $("prevSleep").value && previous > 0 ? previous : NaN;
  state.todaySleep = $("todaySleep").value && today > 0 ? today : NaN;
  update();
}

function setVerdict(node, tone, title, note) {
  node.dataset.tone = tone;
  node.innerHTML = "";
  const strong = document.createElement("strong");
  strong.textContent = title;
  const span = document.createElement("span");
  span.textContent = note;
  node.append(strong, span);
}

function update() {
  const level = ascentLevel(state.prevSleep, state.todaySleep);
  const ascent = ASCENT_TEXT[level];
  const delta = state.todaySleep - state.prevSleep;
  const suffix = level === "unknown" ? "" : `（今天 ${delta >= 0 ? "+" : ""}${delta} m）`;
  setVerdict($("ascentOut"), ascent.tone, ascent.title + suffix, ascent.note);

  const filled = SYMPTOMS.every((s) => Number.isInteger(state.scores[s.key]));
  if (!filled) {
    setVerdict($("scoreOut"), "muted", "还没填", "选完四项会出结论。");
  } else {
    const { total, verdict } = lakeLouise(state.scores);
    const text = VERDICT_TEXT[verdict];
    setVerdict($("scoreOut"), text.tone, `${text.title} · ${total}/12`, text.note);
  }

  const list = $("advice");
  list.innerHTML = "";
  for (const item of advice({
    scores: state.scores,
    flags: [...state.flags],
    prevSleep: state.prevSleep,
    todaySleep: state.todaySleep,
  })) {
    const li = document.createElement("li");
    li.dataset.tone = item.tone;
    li.textContent = item.text;
    list.append(li);
  }
  $("save").disabled = !filled;
}

function loadLog() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

function renderHistory() {
  const entries = loadLog();
  const host = $("history");
  host.innerHTML = "";
  for (const entry of entries.slice(-8).reverse()) {
    const li = document.createElement("li");
    const { total, verdict } = lakeLouise(entry.scores || {});
    li.textContent = `${entry.at} · ${entry.prevSleep}→${entry.todaySleep} m · ${total} 分 · ${VERDICT_TEXT[verdict].title}`;
    host.append(li);
  }
}

function save() {
  const entries = loadLog();
  entries.push({
    at: new Date().toLocaleString("zh-CN", { hour12: false }),
    prevSleep: state.prevSleep,
    todaySleep: state.todaySleep,
    scores: { ...state.scores },
    flags: [...state.flags],
  });
  localStorage.setItem(KEY, JSON.stringify(entries.slice(-200)));
  $("savedMsg").textContent = "已存在本机。";
  renderHistory();
}

function exportLog() {
  const entries = loadLog();
  if (!entries.length) {
    $("savedMsg").textContent = "还没有记录。";
    return;
  }
  const blob = new Blob([entries.map(toText).join("\n\n")], { type: "text/plain;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `ams-${new Date().toISOString().slice(0, 10)}.txt`;
  link.click();
  URL.revokeObjectURL(link.href);
}

renderSymptoms();
renderFlags();
renderRoutes();
$("prevSleep").addEventListener("input", readSleep);
$("todaySleep").addEventListener("input", readSleep);
$("save").addEventListener("click", save);
$("export").addEventListener("click", exportLog);
renderHistory();
update();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
