import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const issues = [];

const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));

const thoughts = readJson("data/thoughts.json");
const excerpts = readJson("data/excerpts.json");
const books = readJson("data/books.json");
const meta = readJson("data/meta.json");
const html = fs.readFileSync(path.join(root, "site/index.html"), "utf8");

const patterns = [
  { name: "手机号", re: /(?<!\d)1[3-9]\d{9}(?!\d)/ },
  { name: "邮箱", re: /[\w.+-]+@[\w-]+\.[\w.-]+/ },
  { name: "身份证号", re: /(?<!\d)\d{17}[\dXx](?!\d)/ },
  { name: "微信读书 Cookie", re: /wr_skey|wr_rt|wr_vid|wr_skey/i },
  { name: "本机绝对路径", re: /\/Users\/[A-Za-z0-9._-]+/ }
];

const excerptText = excerpts.map((item) => [item.book, item.author, item.chapter, item.text, item.note].join("\n")).join("\n");
const targetText = thoughts.map((item) => [item.book, item.chapter, item.text, item.quote].join("\n")).join("\n");

const targets = [
  { file: "data/thoughts.json", text: targetText },
  { file: "data/excerpts.json", text: excerptText },
  { file: "data/books.json", text: JSON.stringify(books, null, 2) },
  { file: "site/index.html", text: html }
];

for (const target of targets) {
  for (const pattern of patterns) {
    if (pattern.re.test(target.text)) issues.push(target.file + " 命中" + pattern.name);
  }
}

for (const thought of thoughts) {
  if (!thought.quote || !thought.quote.trim()) issues.push("想法 " + thought.id + " 缺少原文");
  if (thought.quote && thought.quote.length > 500) issues.push("想法 " + thought.id + " 原文过长");
  if (!thought.text || !thought.text.trim()) issues.push("想法 " + thought.id + " 文本为空");
  if (!/^[0-9a-f]{12}$/.test(thought.quoteHash || "")) issues.push("想法 " + thought.id + " quoteHash 非法");
  if (thought.quote && [...thought.quote].length !== thought.quoteLength) issues.push("想法 " + thought.id + " quoteLength 不一致");
}

for (const excerpt of excerpts) {
  if (!excerpt.text || !excerpt.text.trim()) issues.push("摘录 " + excerpt.id + " 原文为空");
  if (excerpt.text && excerpt.text.length > 500) issues.push("摘录 " + excerpt.id + " 原文过长");
  if (!excerpt.book || !excerpt.chapter) issues.push("摘录 " + excerpt.id + " 缺少书籍或章节");
  if (excerpt.note !== "" && (!excerpt.note || !excerpt.note.trim())) issues.push("摘录 " + excerpt.id + " 批注为空串");
  if (!/^[0-9a-f]{12}$/.test(excerpt.quoteHash || "")) issues.push("摘录 " + excerpt.id + " quoteHash 非法");
  if (excerpt.text && [...excerpt.text].length !== excerpt.quoteLength) issues.push("摘录 " + excerpt.id + " quoteLength 不一致");
}

const noteCount = excerpts.filter((excerpt) => Boolean(excerpt.note)).length;
if (!thoughts.length) issues.push("公开想法为空");
if (!excerpts.length) issues.push("公开摘录为空");
if (meta.thoughtsPublished !== thoughts.length) issues.push("meta.thoughtsPublished 与 thoughts.json 不一致");
if (meta.excerpts !== excerpts.length) issues.push("meta.excerpts 与 excerpts.json 不一致");
if (noteCount !== thoughts.length) issues.push("excerpts 中的批注数与 thoughts.json 不一致");
if (html.includes("📌")) issues.push("页面含有划线标记，可能泄漏原文");
if (html.includes("> 📌")) issues.push("页面含有划线块");
if (/<script[^>]+src="https?:/.test(html)) issues.push("页面引用了第三方脚本");

if (issues.length) {
  console.error("privacy check failed:");
  for (const issue of issues) console.error(" - " + issue);
  process.exit(1);
}

console.log("privacy check passed: " + excerpts.length + " excerpts, " + noteCount + " notes, " + books.length + " books, 0 issues");
