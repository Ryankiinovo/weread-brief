import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export const sha1 = (s) => crypto.createHash("sha1").update(s).digest("hex").slice(0, 12);

export function parseMinutes(text) {
  if (!text) return 0;
  const h = /(\d+)\s*小时/.exec(text);
  const m = /(\d+)\s*分钟/.exec(text);
  return (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0);
}

export function formatMinutes(total) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (!h) return m + " 分钟";
  return h + " 小时" + (m ? " " + m + " 分钟" : "");
}

function parseFrontmatter(text) {
  const match = /^---\n([\s\S]*?)\n---/.exec(text);
  const out = {};
  if (!match) return out;
  for (const line of match[1].split("\n")) {
    const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (!kv) continue;
    out[kv[1]] = kv[2].replace(/^"|"$/g, "").trim();
  }
  return out;
}

function splitSections(text) {
  const sections = {};
  const re = /^# (高亮划线|读书笔记|本书评论)\s*$/gm;
  let match;
  let name = null;
  let start = 0;
  while ((match = re.exec(text))) {
    if (name) sections[name] = text.slice(start, match.index);
    name = match[1];
    start = match.index + match[0].length;
  }
  if (name) sections[name] = text.slice(start);
  return sections;
}

export function parseBlocks(content, kind) {
  const lines = content.split("\n");
  const records = [];
  let chapter = "未分章";
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const heading = /^(#{2,3})\s+(.+)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const name = heading[2].trim();
      if (name !== "划线评论") chapter = level === 2 || level === 3 ? name : chapter;
      continue;
    }
    if (!line.startsWith("> 📌")) continue;

    let quote = line.replace(/^> 📌\s*/, "").trim();
    let thought = "";
    let time = "";
    let j = i + 1;
    for (; j < lines.length; j += 1) {
      const raw = lines[j];
      if (raw.trim() === "") break;
      if (/^#{2,3}\s/.test(raw)) break;
      if (raw.startsWith("> 📌")) break;
      const next = raw.trim().replace(/^>\s?/, "");
      if (next.startsWith("💭")) thought = next.replace(/^💭\s*/, "").trim();
      else if (next.startsWith("⏱")) time = next.replace(/^⏱\s*/, "").trim();
    }
    i = j - 1;

    const link = /^\[(.+)\]\(<weread:[^>]+>\)$/.exec(quote);
    if (link) quote = link[1];
    quote = quote.replace(/\s+\^[\w-]+$/, "").trim();

    records.push({ chapter, quote, thought, time, kind });
  }
  return records;
}

function statusOf(frontmatter) {
  if (frontmatter.readingStatus === "4" || frontmatter.progress === "100%") return "finished";
  const last = Date.parse(frontmatter.lastReadDate || "");
  if (Number.isNaN(last)) return "paused";
  const days = (Date.now() - last) / 86400000;
  return days <= 180 ? "reading" : "paused";
}

export function parseNote(text, fileName) {
  const fm = parseFrontmatter(text);
  const bookId = fm.bookId || sha1(fileName);
  const title = fm.title || fileName.replace(/\.md$/, "");
  const author = fm.author || "";
  const sections = splitSections(text);
  const blocks = [
    ...parseBlocks(sections["高亮划线"] || "", "highlight"),
    ...parseBlocks(sections["读书笔记"] || "", "review"),
  ];

  const seen = new Set();
  const thoughts = [];
  for (const block of blocks) {
    if (!block.thought) continue;
    const key = block.thought.replace(/\s+/g, " ").trim();
    if (seen.has(key)) continue;
    seen.add(key);
    thoughts.push({
      id: sha1(bookId + "|" + key),
      bookId,
      book: title,
      author,
      chapter: block.chapter,
      date: block.time.slice(0, 10),
      text: block.thought,
      quote: block.quote,
      quoteHash: sha1(block.quote),
      quoteLength: [...block.quote].length,
    });
  }

  const chapters = new Map();
  for (const block of blocks) {
    const item = chapters.get(block.chapter) || { title: block.chapter, highlights: 0, thoughts: 0 };
    item.highlights += 1;
    if (block.thought) item.thoughts += 1;
    chapters.set(block.chapter, item);
  }

  return {
    book: {
      id: bookId,
      title,
      author,
      progress: fm.progress || "",
      readingTime: fm.readingTime || "",
      readingMinutes: parseMinutes(fm.readingTime),
      lastReadDate: fm.lastReadDate || "",
      status: statusOf(fm),
      highlights: blocks.filter((b) => b.kind === "highlight").length,
      thoughts: thoughts.length,
      chapters: [...chapters.values()],
    },
    thoughts,
  };
}

export function parseNotesDir(dir) {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
  const books = [];
  const thoughts = [];
  for (const file of files) {
    const text = fs.readFileSync(path.join(dir, file), "utf8");
    const parsed = parseNote(text, file);
    if (!parsed.book.title) continue;
    books.push(parsed.book);
    thoughts.push(...parsed.thoughts);
  }
  books.sort((a, b) => (b.lastReadDate || "").localeCompare(a.lastReadDate || ""));
  return { books, thoughts };
}

function tableRows(text, headingPattern) {
  const start = text.search(headingPattern);
  if (start < 0) return [];
  const chunk = text.slice(start).split("\n").slice(1);
  const rows = [];
  for (const line of chunk) {
    if (!line.startsWith("|")) {
      if (rows.length) break;
      continue;
    }
    if (/^\|\s*-+/.test(line)) continue;
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    if (!cells.length) continue;
    rows.push(cells);
  }
  return rows.slice(1);
}

export function parseStats(text) {
  const fm = parseFrontmatter(text);
  const lifetime = {};
  for (const cells of tableRows(text, /## .*历年总览/)) {
    if (cells.length >= 2) lifetime[cells[0]] = cells[1];
  }
  const years = [];
  for (const cells of tableRows(text, /### 历年阅读时长/)) {
    if (cells.length >= 2) years.push({ year: Number(cells[0]), minutes: parseMinutes(cells[1]) });
  }
  const monthly = [];
  for (const line of text.split("\n")) {
    const m = /^(\d+)月\s+[░█]+\s*(.+)$/.exec(line.trim());
    if (m) monthly.push({ month: Number(m[1]), minutes: parseMinutes(m[2]) });
  }
  return {
    updated: fm.updated || "",
    lifetime: {
      since: lifetime["注册时间"] || "",
      minutes: parseMinutes(lifetime["累计阅读时长"] || ""),
      days: parseInt(lifetime["累计阅读天数"] || "0", 10) || 0,
      booksRead: parseInt(lifetime["读过"] || "0", 10) || 0,
      finished: parseInt(lifetime["读完"] || "0", 10) || 0,
      notes: parseInt(lifetime["笔记"] || "0", 10) || 0,
    },
    years,
    monthly,
  };
}
