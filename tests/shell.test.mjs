import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (name) => readFile(resolve(root, name), "utf8");

async function exists(name) {
  await access(resolve(root, name));
}

test("index.html 引用的本地文件都存在", async () => {
  const html = await read("index.html");
  const refs = [...html.matchAll(/(?:src|href)="([^"#][^"]*)"/g)].map((m) => m[1]);
  const local = refs.filter((ref) => !/^https?:/.test(ref));
  assert.ok(local.length >= 2);
  for (const ref of local) await exists(ref);
});

test("service worker 预缓存清单都真实存在", async () => {
  const sw = await read("sw.js");
  const listed = [...sw.matchAll(/"\.\/([^"]+)"/g)].map((m) => m[1]);
  assert.ok(listed.length >= 5);
  for (const name of listed) await exists(name);
});

test("manifest 是合法 JSON 且有 lang", async () => {
  const manifest = JSON.parse(await read("manifest.webmanifest"));
  assert.equal(manifest.lang, "zh-CN");
  assert.ok(manifest.name);
});

test("页面有免责与红旗说明", async () => {
  const html = await read("index.html");
  assert.match(html, /不替代医生|不是诊断/);
  assert.match(html, /下撤/);
});

test("模块之间没有循环引用", async () => {
  const app = await read("src/app.js");
  const ams = await read("src/ams.js");
  assert.doesNotMatch(ams, /from "\.\/app\.js"/);
  assert.match(app, /from "\.\/ams\.js"/);
});

test("线路海拔都带单位并标注未实测", async () => {
  const routes = await read("src/routes.js");
  assert.match(routes, /未实测/);
  assert.match(routes, /m: \d{3,4}/);
});
