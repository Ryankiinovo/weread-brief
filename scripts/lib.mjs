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

function normalizeQuote(value) {
  return String(value || "")
    .replace(/\u200b/g, "")
    .replace(/[“”"'‘’]/g, "")
    .replace(/\s+/g, "")
    .trim();
}

function buildExcerpts(blocks, bookId, title, author) {
  const highlights = blocks.filter((b) => b.kind === "highlight");
  const reviews = blocks.filter((b) => b.kind === "review" && b.thought.trim());
  const reviewByQuote = new Map();
  for (const review of reviews) {
    const key = normalizeQuote(review.quote);
    if (key && !reviewByQuote.has(key)) reviewByQuote.set(key, review);
  }

  const usedNotes = new Set();
  const seenQuotes = new Set();
  const excerpts = [];
  for (const block of highlights) {
    const quoteKey = normalizeQuote(block.quote);
    if (!quoteKey || seenQuotes.has(quoteKey)) continue;
    seenQuotes.add(quoteKey);

    let note = (block.thought || "").trim();
    if (!note) {
      const review = reviewByQuote.get(quoteKey);
      if (review) note = review.thought.trim();
    }
    const noteKey = normalizeQuote(note);
    if (noteKey && usedNotes.has(noteKey)) note = "";
    if (note) usedNotes.add(noteKey);

    excerpts.push({
      id: sha1(bookId + "|" + quoteKey),
      bookId,
      book: title,
      author,
      chapter: block.chapter,
      date: block.time.slice(0, 10),
      text: block.quote,
      note,
      noteOnly: false,
      quoteHash: sha1(block.quote),
      quoteLength: [...block.quote].length,
    });
  }

  // A thought can exist only in the review section (no matching highlight).
  // Keep it instead of silently dropping it, with its own quote as context.
  for (const review of reviews) {
    const noteKey = normalizeQuote(review.thought);
    if (!noteKey || usedNotes.has(noteKey)) continue;
    usedNotes.add(noteKey);
    excerpts.push({
      id: sha1(bookId + "|note|" + noteKey),
      bookId,
      book: title,
      author,
      chapter: review.chapter,
      date: review.time.slice(0, 10),
      text: review.quote,
      note: review.thought.trim(),
      noteOnly: true,
      quoteHash: sha1(review.quote),
      quoteLength: [...review.quote].length,
    });
  }

  const thoughts = [];
  const seenNotes = new Set();
  for (const excerpt of excerpts) {
    if (!excerpt.note) continue;
    const key = normalizeQuote(excerpt.note);
    if (seenNotes.has(key)) continue;
    seenNotes.add(key);
    thoughts.push({
      id: sha1(bookId + "|" + key),
      bookId,
      book: title,
      author,
      chapter: excerpt.chapter,
      date: excerpt.date,
      text: excerpt.note,
      quote: excerpt.text,
      quoteHash: excerpt.quoteHash,
      quoteLength: excerpt.quoteLength,
    });
  }

  return { highlights, reviews, excerpts, thoughts };
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
  const { highlights, excerpts, thoughts } = buildExcerpts(blocks, bookId, title, author);

  const chapters = new Map();
  for (const excerpt of excerpts) {
    const item = chapters.get(excerpt.chapter) || { title: excerpt.chapter, highlights: 0, thoughts: 0 };
    item.highlights += 1;
    if (excerpt.note) item.thoughts += 1;
    chapters.set(excerpt.chapter, item);
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
      sourceHighlights: highlights.length,
      highlights: excerpts.length,
      thoughts: thoughts.length,
      chapters: [...chapters.values()],
    },
    thoughts,
    excerpts,
  };
}

export function parseNotesDir(dir) {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
  const books = [];
  const thoughts = [];
  const excerpts = [];
  for (const file of files) {
    const text = fs.readFileSync(path.join(dir, file), "utf8");
    const parsed = parseNote(text, file);
    if (!parsed.book.title) continue;
    books.push(parsed.book);
    thoughts.push(...parsed.thoughts);
    excerpts.push(...parsed.excerpts);
  }
  books.sort((a, b) => (b.lastReadDate || "").localeCompare(a.lastReadDate || ""));
  const bookOrder = new Map(books.map((book, index) => [book.title, index]));
  const chapterOrder = new Map();
  for (const book of books) {
    for (const [index, chapter] of (book.chapters || []).entries()) {
      chapterOrder.set(book.title + "\u0000" + chapter.title, index);
    }
  }
  excerpts.sort((a, b) => {
    const byDate = (b.date || "").localeCompare(a.date || "");
    if (byDate) return byDate;
    const byBook = (bookOrder.get(a.book) || 0) - (bookOrder.get(b.book) || 0);
    if (byBook) return byBook;
    return (chapterOrder.get(a.book + "\u0000" + a.chapter) || 0) -
      (chapterOrder.get(b.book + "\u0000" + b.chapter) || 0);
  });
  return { books, thoughts, excerpts };
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
