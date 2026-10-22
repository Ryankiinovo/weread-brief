import test from "node:test";
import assert from "node:assert/strict";
import { parseNote, parseBlocks, parseStats, parseMinutes, formatMinutes } from "../scripts/lib.mjs";

const NL = String.fromCharCode(10);

const NOTE = [
  "---",
  'bookId: "test-book"',
  'title: "测试书"',
  'author: "测试作者"',
  'progress: "42%"',
  'readingTime: "1小时5分钟"',
  'lastReadDate: "2026-10-01"',
  'readingStatus: "2"',
  "---",
  "",
  "# 高亮划线",
  "",
  "## 第一章",
  "",
  "> 📌 引用第一段 ^abc123",
  "    💭 想法一",
  "    ⏱ 2026-10-01 09:00:00",
  "> 📌 引用第二段",
  "    💭 想法二",
  "    ⏱ 2026-10-02 09:00:00",
  "### 第一节",
  "> 📌 引用第三段",
  "    💭 想法三",
  "    ⏱ 2026-10-03 09:00:00",
  "## 第二章",
  "> 📌 引用第四段",
  "    💭 想法一",
  "    ⏱ 2026-10-04 09:00:00",
  "# 读书笔记",
  "",
  "## 前言",
  "### 划线评论",
  "> 📌 引用第五段",
  "    💭 想法四",
  "    ⏱ 2026-10-05 09:00:00"
].join(NL);

test("parseNote 读取 frontmatter、章节与统计", () => {
  const { book, thoughts } = parseNote(NOTE, "测试.md");
  assert.equal(book.id, "test-book");
  assert.equal(book.title, "测试书");
  assert.equal(book.author, "测试作者");
  assert.equal(book.progress, "42%");
  assert.equal(book.readingMinutes, 65);
  assert.equal(book.status, "reading");
  assert.equal(book.highlights, 4);
  assert.equal(thoughts.length, 4);
  const chapters = book.chapters.map((c) => c.title);
  assert.ok(chapters.includes("第一章"));
  assert.ok(chapters.includes("第一节"));
  assert.ok(chapters.includes("第二章"));
  assert.ok(chapters.includes("前言"));
  assert.ok(!chapters.includes("划线评论"));
});

test("标题紧贴上一块时不被吞掉", () => {
  const content = [
    "## 第一章",
    "> 📌 引用一",
    "    💭 想法一",
    "    ⏱ 2026-10-01",
    "## 第二章",
    "> 📌 引用二",
    "    💭 想法二",
    "    ⏱ 2026-10-02"
  ].join(NL);
  const blocks = parseBlocks(content, "highlight");
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].chapter, "第一章");
  assert.equal(blocks[1].chapter, "第二章");
});

test("连续划线块不合并", () => {
  const content = [
    "## 第一章",
    "> 📌 引用一",
    "    💭 想法一",
    "    ⏱ 2026-10-01",
    "> 📌 引用二",
    "    💭 想法二",
    "    ⏱ 2026-10-02"
  ].join(NL);
  const blocks = parseBlocks(content, "highlight");
  assert.equal(blocks.length, 2);
  assert.equal(blocks[1].thought, "想法二");
});

test("相同想法按文本去重，引用不进入公开数据", () => {
  const { thoughts } = parseNote(NOTE, "测试.md");
  const ids = new Set(thoughts.map((t) => t.id));
  assert.equal(ids.size, thoughts.length);
  assert.equal(thoughts.filter((t) => t.text === "想法一").length, 1);
  for (const thought of thoughts) {
    assert.ok(!("quote" in thought));
    assert.equal(thought.quoteHash.length, 12);
    assert.ok(thought.quoteLength > 0);
  }
});

test("阅读状态判定", () => {
  const finished = parseNote(NOTE.replace('progress: "42%"', 'progress: "100%"'), "a.md").book;
  assert.equal(finished.status, "finished");
  const marked = parseNote(NOTE.replace('readingStatus: "2"', 'readingStatus: "4"'), "a.md").book;
  assert.equal(marked.status, "finished");
  const old = parseNote(NOTE.replace('lastReadDate: "2026-10-01"', 'lastReadDate: "2020-01-01"'), "a.md").book;
  assert.equal(old.status, "paused");
});

test("parseMinutes 与 formatMinutes", () => {
  assert.equal(parseMinutes("46小时43分钟"), 2803);
  assert.equal(parseMinutes("7分钟"), 7);
  assert.equal(parseMinutes(""), 0);
  assert.equal(formatMinutes(2803), "46 小时 43 分钟");
  assert.equal(formatMinutes(7), "7 分钟");
});

test("parseStats 解析历年、逐月与总览", () => {
  const stats = [
    "---",
    "updated: 2026-09-15",
    "---",
    "## 📊 历年总览",
    "| 指标 | 数值 |",
    "| --- | --- |",
    "| 注册时间 | 2020-08-06 |",
    "| 累计阅读时长 | 46小时43分钟 |",
    "| 累计阅读天数 | 131 |",
    "| 读过 | 32 |",
    "| 读完 | 16 |",
    "| 笔记 | 501 |",
    "",
    "### 历年阅读时长",
    "| 年份 | 时长 |",
    "| --- | --- |",
    "| 2021 | 1小时9分钟 |",
    "| 2025 | 20小时6分钟 |",
    "",
    "## 📅 逐月",
    "1月 ░░░ 0分钟",
    "2月 ██████ 2小时31分钟"
  ].join(NL);
  const parsed = parseStats(stats);
  assert.equal(parsed.updated, "2026-09-15");
  assert.equal(parsed.lifetime.minutes, 2803);
  assert.equal(parsed.lifetime.booksRead, 32);
  assert.equal(parsed.lifetime.finished, 16);
  assert.equal(parsed.years.length, 2);
  assert.equal(parsed.years[1].minutes, 1206);
  assert.equal(parsed.monthly.length, 2);
  assert.equal(parsed.monthly[1].minutes, 151);
});
