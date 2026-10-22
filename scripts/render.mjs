const REPO = "https://github.com/Ryankiinovo/weread-reading-archive";
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
      '<div class="book-counts"><span><b>' + (book.highlights || 0) + '</b> 条划线</span>' +
      '<span><b>' + (book.thoughts || 0) + '</b> 条想法</span></div></article>';
  }).join("");
}

function noteCards(thoughts) {
  return thoughts.map(function (thought) {
    return '<article class="note" data-book="' + esc(thought.book) + '">' +
      '<p class="note-text">' + esc(thought.text) + '</p>' +
      '<footer class="note-foot"><span class="note-book">' + esc(thought.book) + '</span>' +
      '<span class="note-chapter">' + esc(thought.chapter) + '</span>' +
      '<time datetime="' + esc(thought.date) + '">' + dotDate(thought.date) + '</time></footer></article>';
  }).join("");
}

function filterChips(thoughts) {
  const counts = new Map();
  thoughts.forEach(function (thought) {
    counts.set(thought.book, (counts.get(thought.book) || 0) + 1);
  });
  const order = Array.from(counts.keys()).sort(function (a, b) {
    return counts.get(b) - counts.get(a);
  });
  const chips = order.map(function (book) {
    return '<button class="chip" type="button" data-filter="' + esc(book) + '" aria-pressed="false">' +
      esc(book) + ' <span>' + counts.get(book) + '</span></button>';
  }).join("");
  return '<button class="chip is-active" type="button" data-filter="all" aria-pressed="true">全部 <span>' +
    thoughts.length + '</span></button>' + chips;
}

export function renderSite(payload) {
  const meta = payload.meta || {};
  const lifetime = payload.stats.lifetime || {};
  const books = payload.books || [];
  const thoughts = payload.thoughts || [];
  const synced = books.length;
  const highlights = meta.highlights || 0;
  const localThoughts = meta.thoughtsLocal || 0;
  const localMinutes = meta.readingMinutesLocal || 0;
  const yearMinutes = (payload.stats.years || []).reduce(function (sum, row) { return sum + row.minutes; }, 0);
  const generated = String(meta.generatedAt || "").slice(0, 10);
  const finishedCount = books.filter(function (b) { return b.status === "finished"; }).length;
  const readingCount = books.filter(function (b) { return b.status === "reading"; }).length;

  const lines = [
    '<!doctype html>',
    '<html lang="zh-CN">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>阅读档案 · Ryankiin</title>',
    '<meta name="description" content="把微信读书里的划线、想法与阅读统计整理成一份可检索的个人阅读档案：9 本书、724 条划线、60 条想法。">',
    '<meta name="theme-color" content="#f6f1e7">',
    '<meta property="og:type" content="website">',
    '<meta property="og:title" content="阅读档案 · Ryankiin">',
    '<meta property="og:description" content="9 本书、724 条划线、60 条想法：一份可复现的个人阅读档案。">',
    '<link rel="stylesheet" href="./assets/style.css">',
    '</head>',
    '<body>',
    '<a class="skip" href="#main">跳到正文</a>',
    '<header class="site-head">',
    '  <a class="brand" href="#top">阅读档案<span class="brand-sub"> / READING ARCHIVE</span></a>',
    '  <nav class="nav" aria-label="页面导航">',
    '    <a href="#overview">总览</a>',
    '    <a href="#shelf">书架</a>',
    '    <a href="#notes">批注</a>',
    '    <a href="#method">方法</a>',
    '  </nav>',
    '</header>',
    '<main id="main">',
    '  <section class="hero" id="top">',
    '    <div class="wrap hero-grid">',
    '      <div class="hero-main">',
    '        <p class="eyebrow">个人阅读档案 · Ryankiin · 2020—2026</p>',
    '        <h1>把读过的书，<br><em>整理成可检索的档案。</em></h1>',
    '        <p class="lede">把微信读书里的划线、批注和阅读时长导出、解析，做成一份能反复回看的结构化记录。原文留在书里，这里只公开自己的判断。</p>',
    '        <p class="hero-note">已同步 ' + synced + ' 本书 · ' + highlights + ' 条划线 · ' + localThoughts + ' 条想法</p>',
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
    '            <div><dt>划线</dt><dd>' + highlights + '<span> 条</span></dd></div>',
    '            <div><dt>想法</dt><dd>' + localThoughts + '<span> 条</span></dd></div>',
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
    '  <section class="section" id="notes">',
    '    <div class="wrap">',
    '      <div class="section-head">',
    '        <p class="index">03</p>',
    '        <h2>我写下的批注</h2>',
    '        <p class="section-lede">从 ' + localThoughts + ' 条本地想法里挑出 ' + thoughts.length + ' 条公开。只保留自己的判断，不转载书籍原文。</p>',
    '      </div>',
    '      <div class="filters" role="group" aria-label="按书筛选批注">',
    '        ' + filterChips(thoughts),
    '      </div>',
    '      <div class="note-grid" id="note-grid">' + noteCards(thoughts) + '</div>',
    '      <p class="filter-note" id="filter-note" aria-live="polite">显示全部 ' + thoughts.length + ' 条</p>',
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
    '          <li><span class="step-no">04</span><div><h3>校验</h3><p>单元测试覆盖解析边界，隐私检查确认没有原文、Cookie、联系方式进入产物。</p></div></li>',
    '        </ol>',
    '        <div class="method-side">',
    '          <div class="terminal" aria-label="构建命令">',
    '            <div class="terminal-bar"><span></span><span></span><span></span><em>build</em></div>',
    '            <pre><code>WEREAD_DIR=/path/to/WeRead npm run build' + NL + 'node --test tests/' + NL + 'npm run check</code></pre>',
    '          </div>',
    '          <ul class="facts">',
    '            <li><b>0</b><span>运行时依赖</span></li>',
    '            <li><b>2</b><span>个构建脚本</span></li>',
    '            <li><b>0</b><span>条书籍原文</span></li>',
    '          </ul>',
    '        </div>',
    '      </div>',
    '      <div class="principles">',
    '        <div><h3>只公开自己的话</h3><p>划线是书籍内容，只用于统计；公开区域只放原创批注与元数据。</p></div>',
    '        <div><h3>口径写清楚</h3><p>官方统计与本地同步覆盖分开标注，不把 501 条官方笔记等同于这里的 ' + localThoughts + ' 条想法。</p></div>',
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
    '  <div class="wrap foot-fine"><p>只收录原创批注，不转载书籍原文。本站无追踪、无第三方脚本。</p></div>',
    '</footer>',
    '<script src="./assets/app.js"></script>',
    '</body>',
    '</html>'
  ];

  return lines.join(NL) + NL;
}
