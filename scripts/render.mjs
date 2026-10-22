const REPO = "https://github.com/Ryankiinovo/weread-brief";
const NL = String.fromCharCode(10);

const STATUS_LABEL = { reading: "在读", finished: "已读完", paused: "搁置" };

function esc(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
  });
}

function formatHM(minutes) {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return m + "m";
  return h + "h" + (m < 10 ? "0" + m : String(m)) + "m";
}

function formatLong(minutes) {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return m + " 分钟";
  return h + " 小时 " + (m < 10 ? "0" + m : m) + " 分";
}

function pad2(n) {
  return n < 10 ? "0" + n : String(n);
}

function dotDate(value) {
  if (!value) return "";
  const parts = String(value).split("-");
  if (parts.length !== 3) return String(value);
  return parts.join(".");
}

function ratio(value, max) {
  if (!max) return 0;
  return Math.max(3, Math.round((Number(value) || 0) / max * 100));
}

function yearChart(stats) {
  const years = (stats.years || []).filter(function (row) { return row.minutes > 0; });
  if (!years.length) return "";
  const max = Math.max.apply(null, years.map(function (row) { return row.minutes; }));
  const bars = years.map(function (row) {
    return '<div class="bar"><span class="bar-value">' + formatHM(row.minutes) + '</span>' +
      '<span class="bar-fill" style="--h:' + ratio(row.minutes, max) + '%"></span>' +
      '<span class="bar-year">' + row.year + '</span></div>';
  }).join("");
  const label = years.map(function (row) { return row.year + " 年 " + formatHM(row.minutes); }).join("，");
  return '<div class="bars" role="img" aria-label="历年阅读时长：' + esc(label) + '">' + bars + '</div>';
}

function monthChart(stats) {
  const months = (stats.monthly || []).slice(0, 9);
  if (!months.length) return "";
  const max = Math.max.apply(null, months.map(function (row) { return row.minutes; }));
  const cols = months.map(function (row) {
    return '<div class="spark-col"><span class="spark-fill" style="--h:' + ratio(row.minutes, max) + '%"></span>' +
      '<span class="spark-month">' + row.month + '月</span></div>';
  }).join("");
  return '<div class="spark" role="img" aria-label="2026 年逐月阅读时长">' + cols + '</div>';
}

function heroStats(lifetime) {
  const items = [
    { value: formatHM(lifetime.minutes), label: "累计阅读", note: "2020—2026" },
    { value: String(lifetime.booksRead || 0), label: "读过的书", note: "本" },
    { value: String(lifetime.finished || 0), label: "读完的书", note: "本" },
    { value: String(lifetime.notes || 0), label: "笔记", note: "条" }
  ];
  return items.map(function (item) {
    return '<div class="stat"><p class="stat-value">' + esc(item.value) + '</p>' +
      '<p class="stat-label">' + esc(item.label) + ' <span>' + esc(item.note) + '</span></p></div>';
  }).join("");
}

function bookCards(books) {
  return books.map(function (book, index) {
    const progress = Math.max(0, Math.min(100, parseFloat(book.progress) || 0));
    const status = STATUS_LABEL[book.status] || book.status;
    return '<article class="book" data-status="' + esc(book.status) + '">' +
      '<div class="book-top"><span class="book-no">' + pad2(index + 1) + '</span>' +
      '<span class="pill pill-' + esc(book.status) + '">' + esc(status) + '</span></div>' +
      '<h3 class="book-title">' + esc(book.title) + '</h3>' +
      '<p class="book-author">' + esc(book.author) + '</p>' +
      '<div class="book-progress" aria-label="阅读进度 ' + progress + '%"><span style="width:' + progress + '%"></span></div>' +
      '<div class="book-meta"><span>' + progress + '%</span><span>' + formatHM(book.readingMinutes) + '</span></div>' +
      '<div class="book-counts"><span><b>' + (book.highlights || 0) + '</b> 条摘录</span>' +
      '<span><b>' + (book.thoughts || 0) + '</b> 条批注</span></div></article>';
  }).join("");
}

function monthLabel(value) {
  const match = /^(\d{4})-(\d{2})$/.exec(value || "");
  return match ? match[1] + " 年 " + Number(match[2]) + " 月" : "未标日期";
}

function excerptRows(excerpts, books) {
  const bookIndex = new Map(books.map(function (book, index) { return [book.title, index]; }));
  const chapterIndex = new Map();
  books.forEach(function (book, index) {
    (book.chapters || []).forEach(function (chapter, chapterNo) {
      chapterIndex.set(book.title + "\u0000" + chapter.title, chapterNo);
    });
  });
  return excerpts.map(function (item) {
    const bi = bookIndex.has(item.book) ? bookIndex.get(item.book) : books.length;
    const key = item.book + "\u0000" + item.chapter;
    return {
      item: item,
      bookIndex: bi,
      chapterIndex: chapterIndex.has(key) ? chapterIndex.get(key) : 9999,
      month: String(item.date || "").slice(0, 7)
    };
  }).sort(function (a, b) {
    if ((b.item.date || "") !== (a.item.date || "")) return (b.item.date || "").localeCompare(a.item.date || "");
    if (a.bookIndex !== b.bookIndex) return a.bookIndex - b.bookIndex;
    return a.chapterIndex - b.chapterIndex;
  });
}

function excerptCards(rows) {
  return rows.map(function (row, index) {
    const item = row.item;
    const note = item.note
      ? '<p class="excerpt-note"><span class="excerpt-label">批注</span>' + esc(item.note) + '</p>'
      : '';
    return '<article class="excerpt-card" data-book="' + esc(item.book) + '" data-book-index="' + row.bookIndex +
      '" data-chapter="' + esc(item.chapter) + '" data-chapter-index="' + row.chapterIndex +
      '" data-month="' + esc(row.month) + '" data-date="' + esc(item.date) + '"' + (index >= 20 ? ' hidden' : '') + '>' +
      '<blockquote class="excerpt-quote"><span class="excerpt-label">原文</span>' + esc(item.text) + '</blockquote>' +
      note +
      '<footer class="excerpt-foot"><span class="excerpt-book">' + esc(item.book) + '</span>' +
      '<span class="excerpt-chapter">' + esc(item.chapter) + '</span>' +
      '<time datetime="' + esc(item.date) + '">' + dotDate(item.date) + '</time></footer></article>';
  }).join("");
}

function filterChips(excerpts) {
  const counts = new Map();
  excerpts.forEach(function (item) {
    counts.set(item.book, (counts.get(item.book) || 0) + 1);
  });
  const order = Array.from(counts.keys()).sort(function (a, b) {
    return counts.get(b) - counts.get(a);
  });
  const chips = order.map(function (book) {
    return '<button class="chip" type="button" data-filter="' + esc(book) + '" aria-pressed="false">' +
      esc(book) + ' <span>' + counts.get(book) + '</span></button>';
  }).join("");
  return '<button class="chip is-active" type="button" data-filter="all" aria-pressed="true">全部 <span>' +
    excerpts.length + '</span></button>' + chips;
}

function monthOptions(rows) {
  const counts = new Map();
  rows.forEach(function (row) { counts.set(row.month, (counts.get(row.month) || 0) + 1); });
  const options = Array.from(counts.keys()).sort().reverse().map(function (month) {
    return '<option value="' + esc(month) + '">' + esc(monthLabel(month)) + ' · ' + counts.get(month) + ' 条</option>';
  }).join("");
  return '<option value="all">全部时间</option>' + options;
}

export function renderSite(payload) {
  const meta = payload.meta || {};
  const lifetime = payload.stats.lifetime || {};
  const books = payload.books || [];
  const excerpts = payload.excerpts || [];
  const rows = excerptRows(excerpts, books);
  const thoughtCount = excerpts.filter(function (item) { return item.note; }).length;
  const synced = books.length;
  const highlights = meta.highlights || excerpts.length;
  const sourceHighlights = meta.sourceHighlights || highlights;
  const localThoughts = meta.thoughtsLocal || thoughtCount;
  const localMinutes = meta.readingMinutesLocal || 0;
  const yearMinutes = (payload.stats.years || []).reduce(function (sum, row) { return sum + row.minutes; }, 0);
  const generated = String(meta.generatedAt || "").slice(0, 10);
  const finishedCount = books.filter(function (b) { return b.status === "finished"; }).length;
  const readingCount = books.filter(function (b) { return b.status === "reading"; }).length;
  const totalPages = Math.max(1, Math.ceil(excerpts.length / 20));
  const excerptLede = excerpts.length + ' 条摘录全部公开，其中 ' + thoughtCount + ' 条带批注；源文件 ' +
    sourceHighlights + ' 个划线块，按原文去重后为 ' + excerpts.length + ' 条。';
  const lines = [
    '<!doctype html>',
    '<html lang="zh-CN">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>阅读档案 · Ryankiin</title>',
    '<meta name="description" content="把微信读书里的划线、批注与阅读统计整理成一份可检索的个人阅读档案：' + synced + ' 本书、' + excerpts.length + ' 条摘录、' + thoughtCount + ' 条批注。">',
    '<meta name="theme-color" content="#f6f1e7">',
    '<meta property="og:type" content="website">',
    '<meta property="og:title" content="阅读档案 · Ryankiin">',
    '<meta property="og:description" content="' + synced + ' 本书、' + excerpts.length + ' 条摘录、' + thoughtCount + ' 条批注：一份可复现的个人阅读档案。">',
    '<link rel="stylesheet" href="./assets/style.css">',
    '</head>',
    '<body>',
    '<a class="skip" href="#main">跳到正文</a>',
    '<header class="site-head">',
    '  <a class="brand" href="#top">阅读档案<span class="brand-sub"> / READING ARCHIVE</span></a>',
    '  <nav class="nav" aria-label="页面导航">',
    '    <a href="#overview">总览</a>',
    '    <a href="#shelf">书架</a>',
    '    <a href="#excerpts">摘录</a>',
    '    <a href="#method">方法</a>',
    '  </nav>',
    '</header>',
    '<main id="main">',
    '  <section class="hero" id="top">',
    '    <div class="wrap hero-grid">',
    '      <div class="hero-main">',
    '        <p class="eyebrow">个人阅读档案 · Ryankiin · 2020—2026</p>',
    '        <h1>把读过的书，<br><em>整理成可检索的档案。</em></h1>',
    '        <p class="lede">把微信读书里的划线、批注和阅读时长导出、解析，做成一份能反复回看的结构化记录。原文与自己的想法并置，方便对照。</p>',
    '        <p class="hero-note">已同步 ' + synced + ' 本书 · ' + excerpts.length + ' 条摘录 · ' + thoughtCount + ' 条批注</p>',
    '      </div>',
    '      <aside class="hero-aside" aria-label="档案说明">',
    '        <p class="aside-kicker">DATA, NOT DECORATION</p>',
    '        <p class="aside-text">数据来自微信读书官方统计与 Obsidian 同步笔记。前者记录「读了多少」，后者回答「想过什么」。</p>',
    '        <p class="aside-meta">统计截至 ' + esc(meta.statsAsOf || "—") + '</p>',
    '      </aside>',
    '    </div>',
    '    <div class="wrap"><div class="stats">' + heroStats(lifetime) + '</div></div>',
    '  </section>',
    '',
    '  <section class="section" id="overview">',
    '    <div class="wrap">',
    '      <div class="section-head">',
    '        <p class="index">01</p>',
    '        <h2>时间花在哪里</h2>',
    '        <p class="section-lede">官方统计的累计 ' + formatLong(lifetime.minutes) + '，分布在 ' + (lifetime.days || 0) + ' 个阅读日里。' + (yearMinutes ? '2022 与 2025 是两个明显的高峰。' : '') + '</p>',
    '      </div>',
    '      <div class="overview-grid">',
    '        <figure class="chart-card">',
    '          <figcaption class="chart-head"><span>历年阅读时长</span><span class="chart-unit">小时 / 年</span></figcaption>',
    '          ' + yearChart(payload.stats),
    '        </figure>',
    '        <div class="coverage">',
    '          <p class="coverage-kicker">本地同步覆盖</p>',
    '          <dl class="coverage-grid">',
    '            <div><dt>已同步</dt><dd>' + synced + '<span> 本</span></dd></div>',
    '            <div><dt>摘录</dt><dd>' + excerpts.length + '<span> 条</span></dd></div>',
    '            <div><dt>批注</dt><dd>' + thoughtCount + '<span> 条</span></dd></div>',
    '            <div><dt>阅读时长</dt><dd>' + formatHM(localMinutes) + '</dd></div>',
    '          </dl>',
    '          <p class="coverage-note">官方统计是总量，这里只覆盖同步到本地的 ' + synced + ' 本书，两者口径不同，不做相加。</p>',
    '        </div>',
    '      </div>',
    '      <div class="month-card">',
    '        <p class="month-title">2026 年 · 逐月</p>',
    '        ' + monthChart(payload.stats),
    '        <p class="month-note">2 月的 2 小时 31 分是今年最高，之后回落到零散阅读。</p>',
    '      </div>',
    '    </div>',
    '  </section>',
    '',
    '  <section class="section" id="shelf">',
    '    <div class="wrap">',
    '      <div class="section-head">',
    '        <p class="index">02</p>',
    '        <h2>同步到本地的书架</h2>',
    '        <p class="section-lede">按最近一次阅读排序。' + synced + ' 本书里有 ' + finishedCount + ' 本已读完，' + readingCount + ' 本在读。</p>',
    '      </div>',
    '      <div class="book-grid">' + bookCards(books) + '</div>',
    '    </div>',
    '  </section>',
    '',
    '  <section class="section" id="excerpts">',
    '    <div class="wrap">',
    '      <div class="section-head">',
    '        <p class="index">03</p>',
    '        <h2>我的摘录</h2>',
    '        <p class="section-lede">' + excerptLede + '原文只作对照，版权归原作者。</p>',
    '      </div>',
    '      <div class="excerpt-toolbar">',
    '        <div class="view-switch" role="group" aria-label="切换摘录视图">',
    '          <button class="view-btn is-active" type="button" data-view="time" aria-pressed="true">时间线</button>',
    '          <button class="view-btn" type="button" data-view="book" aria-pressed="false">按书</button>',
    '        </div>',
    '        <div class="excerpt-selects">',
    '          <label class="excerpt-field">月份<select class="excerpt-select" id="excerptMonth">' + monthOptions(rows) + '</select></label>',
    '          <label class="excerpt-field">章节<select class="excerpt-select" id="excerptChapter" disabled><option value="all">全部章节</option></select></label>',
    '        </div>',
    '        <p class="excerpt-count" id="excerptCount">共 ' + excerpts.length + ' 条摘录 · 第 1 / ' + totalPages + ' 页</p>',
    '      </div>',
    '      <div class="filters" id="excerptFilters" role="group" aria-label="按书筛选摘录">',
    '        ' + filterChips(excerpts),
    '      </div>',
    '      <div class="excerpt-grid" id="excerptGrid">' + excerptCards(rows) + '</div>',
    '      <p class="excerpt-empty" id="excerptEmpty" hidden>没有符合条件的摘录。</p>',
    '      <nav class="excerpt-pager" id="excerptPager" aria-label="摘录分页"></nav>',
    '      <noscript><p class="excerpt-noscript">本页默认展示前 20 条摘录；启用 JavaScript 后可按时间或书籍章节浏览全部 ' + excerpts.length + ' 条。</p></noscript>',
    '    </div>',
    '  </section>',
    '',
    '  <section class="method" id="method">',
    '    <div class="wrap">',
    '      <div class="section-head section-head-light">',
    '        <p class="index">04</p>',
    '        <h2>这份档案怎么来的</h2>',
    '        <p class="section-lede">不是手工整理的页面，而是一条可重复执行的流水线：换一台机器，只要有笔记目录，就能生成同样的数据与页面。</p>',
    '      </div>',
    '      <div class="method-grid">',
    '        <ol class="pipeline">',
    '          <li><span class="step-no">01</span><div><h3>同步</h3><p>微信读书 → Obsidian。用 obsidian-weread-plugin 把划线、想法、进度和时长同步成本地 Markdown。</p></div></li>',
    '          <li><span class="step-no">02</span><div><h3>解析</h3><p>Node 脚本读取 frontmatter 与正文区块，按书聚合章节，去重、清洗时间，输出 JSON。</p></div></li>',
    '          <li><span class="step-no">03</span><div><h3>生成</h3><p>由 JSON 渲染静态页面，不依赖框架和第三方请求；样式与脚本都是手写的。</p></div></li>',
    '          <li><span class="step-no">04</span><div><h3>校验</h3><p>单元测试覆盖解析边界，隐私检查确认 Cookie、联系方式与本机路径不进入产物；原文只随对应批注出现。</p></div></li>',
    '        </ol>',
    '        <div class="method-side">',
    '          <div class="terminal" aria-label="构建命令">',
    '            <div class="terminal-bar"><span></span><span></span><span></span><em>build</em></div>',
    '            <pre><code>WEREAD_DIR=/path/to/WeRead npm run build' + NL + 'node --test' + NL + 'npm run check</code></pre>',
    '          </div>',
    '          <ul class="facts">',
    '            <li><b>0</b><span>运行时依赖</span></li>',
    '            <li><b>2</b><span>个构建脚本</span></li>',
    '            <li><b>' + excerpts.length + '</b><span>条摘录</span></li>',
    '          </ul>',
    '        </div>',
    '      </div>',
    '      <div class="principles">',
    '        <div><h3>原文只作对照</h3><p>摘录版权归原作者；页面展示个人阅读记录里的短片段，不拼整章、不提供整书内容，也不做原文检索。</p></div>',
    '        <div><h3>口径写清楚</h3><p>官方统计与本地同步覆盖分开标注，不把 501 条官方笔记等同于这里的 ' + thoughtCount + ' 条批注。</p></div>',
    '        <div><h3>可复核</h3><p>每个数字都能由仓库里的脚本和原始 Markdown 重新算出来，页面只是产物。</p></div>',
    '      </div>',
    '    </div>',
    '  </section>',
    '</main>',
    '<footer class="site-foot">',
    '  <div class="wrap foot-grid">',
    '    <div><p class="foot-title">阅读档案</p><p class="foot-text">数据：微信读书官方统计（截至 ' + esc(meta.statsAsOf || "—") + '）+ 本地同步笔记。页面生成于 ' + generated + '。</p></div>',
    '    <div class="foot-links"><a href="' + REPO + '">GitHub 仓库</a><a href="' + REPO + '/blob/main/docs/case-study.md">制作说明</a><a href="#top">回到顶部</a></div>',
    '  </div>',
    '  <div class="wrap foot-fine"><p>原创批注 + 个人摘录片段；书籍原文版权归原作者。本站无追踪、无第三方脚本。</p></div>',
    '</footer>',
    '<script src="./assets/app.js"></script>',
    '</body>',
    '</html>'
  ];

  return lines.join(NL) + NL;
}
