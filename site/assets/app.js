(function () {
  "use strict";

  var bars = document.querySelector(".bars");
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (bars && !reduced && "IntersectionObserver" in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          bars.classList.add("ready");
          observer.disconnect();
        }
      });
    }, { threshold: 0.35 });
    observer.observe(bars);
  } else if (bars) {
    bars.classList.add("ready");
  }

  var excerptGrid = document.getElementById("excerptGrid");
  var excerptFilters = document.getElementById("excerptFilters");
  var excerptMonth = document.getElementById("excerptMonth");
  var excerptChapter = document.getElementById("excerptChapter");
  var excerptCount = document.getElementById("excerptCount");
  var excerptPager = document.getElementById("excerptPager");
  var excerptEmpty = document.getElementById("excerptEmpty");
  var excerptSection = document.getElementById("excerpts");

  if (excerptGrid && excerptFilters) {
    var PAGE_SIZE = 20;
    var allCards = Array.prototype.slice.call(excerptGrid.querySelectorAll(".excerpt-card"));
    var order = new Map(allCards.map(function (card, index) { return [card, index]; }));
    var chips = Array.prototype.slice.call(excerptFilters.querySelectorAll(".chip"));
    var viewButtons = Array.prototype.slice.call(document.querySelectorAll(".view-btn"));
    var state = { view: "time", book: "all", month: "all", chapter: "all", page: 1 };
    var sorted = allCards.slice();

    function formatMonth(value) {
      var match = /^(\d{4})-(\d{2})$/.exec(value || "");
      return match ? match[1] + " 年 " + Number(match[2]) + " 月" : (value || "未标日期");
    }

    function readUrl() {
      var params = new URLSearchParams(window.location.search);
      var view = params.get("view");
      if (view === "time" || view === "book") state.view = view;
      var book = params.get("book");
      if (book && allCards.some(function (card) { return card.dataset.book === book; })) state.book = book;
      var month = params.get("month");
      if (month && excerptMonth && Array.prototype.some.call(excerptMonth.options, function (option) { return option.value === month; })) {
        state.month = month;
      }
      var chapter = params.get("chapter");
      if (chapter) state.chapter = chapter;
      var page = Number(params.get("page"));
      if (Number.isInteger(page) && page > 0) state.page = page;
    }

    function sortCards() {
      sorted.sort(function (a, b) {
        if (state.view === "book") {
          var bookDiff = Number(a.dataset.bookIndex) - Number(b.dataset.bookIndex);
          if (bookDiff) return bookDiff;
          var chapterDiff = Number(a.dataset.chapterIndex) - Number(b.dataset.chapterIndex);
          if (chapterDiff) return chapterDiff;
          if (a.dataset.date !== b.dataset.date) return a.dataset.date < b.dataset.date ? 1 : -1;
        } else {
          if (a.dataset.date !== b.dataset.date) return a.dataset.date < b.dataset.date ? 1 : -1;
          var timeBookDiff = Number(a.dataset.bookIndex) - Number(b.dataset.bookIndex);
          if (timeBookDiff) return timeBookDiff;
          var timeChapterDiff = Number(a.dataset.chapterIndex) - Number(b.dataset.chapterIndex);
          if (timeChapterDiff) return timeChapterDiff;
        }
        return order.get(a) - order.get(b);
      });
      Array.prototype.forEach.call(excerptGrid.querySelectorAll(".excerpt-group"), function (node) {
        node.parentNode.removeChild(node);
      });
      sorted.forEach(function (card) { excerptGrid.appendChild(card); });
    }

    function refreshChapterOptions() {
      if (!excerptChapter) return;
      var counts = new Map();
      if (state.book !== "all") {
        allCards.forEach(function (card) {
          if (card.dataset.book !== state.book) return;
          var key = card.dataset.chapterIndex;
          var row = counts.get(key) || { chapter: card.dataset.chapter || "未分章", count: 0 };
          row.count += 1;
          counts.set(key, row);
        });
      }
      excerptChapter.innerHTML = "";
      var allOption = document.createElement("option");
      allOption.value = "all";
      allOption.textContent = "全部章节";
      excerptChapter.appendChild(allOption);
      Array.from(counts.entries())
        .sort(function (a, b) { return Number(a[0]) - Number(b[0]); })
        .forEach(function (entry) {
          var option = document.createElement("option");
          option.value = entry[0];
          option.textContent = entry[1].chapter + " · " + entry[1].count;
          excerptChapter.appendChild(option);
        });
      excerptChapter.disabled = state.book === "all";
      if (state.chapter !== "all" && !counts.has(state.chapter)) state.chapter = "all";
      excerptChapter.value = state.chapter;
    }

    function syncControls() {
      chips.forEach(function (chip) {
        var active = chip.dataset.filter === state.book;
        chip.classList.toggle("is-active", active);
        chip.setAttribute("aria-pressed", String(active));
      });
      viewButtons.forEach(function (button) {
        var active = button.dataset.view === state.view;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", String(active));
      });
      if (excerptMonth) excerptMonth.value = state.month;
    }

    function setUrl() {
      var url = new URL(window.location.href);
      ["view", "book", "month", "chapter", "page"].forEach(function (key) { url.searchParams.delete(key); });
      if (state.view !== "time") url.searchParams.set("view", state.view);
      if (state.book !== "all") url.searchParams.set("book", state.book);
      if (state.month !== "all") url.searchParams.set("month", state.month);
      if (state.chapter !== "all") url.searchParams.set("chapter", state.chapter);
      if (state.page > 1) url.searchParams.set("page", String(state.page));
      url.hash = "";
      history.replaceState(null, "", url);
    }

    function addPagerButton(label, page, options) {
      var opts = options || {};
      var button = document.createElement("button");
      button.type = "button";
      button.className = "pager-btn";
      button.textContent = label;
      if (opts.title) button.title = opts.title;
      if (opts.active) {
        button.classList.add("is-active");
        button.setAttribute("aria-current", "page");
      }
      button.disabled = !!opts.disabled;
      button.dataset.page = String(page);
      excerptPager.appendChild(button);
    }

    function renderPager(totalPages) {
      excerptPager.innerHTML = "";
      if (totalPages <= 1) return;
      addPagerButton("上一页", state.page - 1, { disabled: state.page === 1 });
      var pages = new Set([1, totalPages, state.page, state.page - 1, state.page + 1]);
      var list = Array.from(pages).filter(function (page) { return page >= 1 && page <= totalPages; }).sort(function (a, b) { return a - b; });
      var previous = 0;
      list.forEach(function (page) {
        if (page - previous > 1) {
          var gap = document.createElement("span");
          gap.className = "pager-gap";
          gap.textContent = "…";
          excerptPager.appendChild(gap);
        }
        addPagerButton(String(page), page, { active: page === state.page });
        previous = page;
      });
      addPagerButton("下一页", state.page + 1, { disabled: state.page === totalPages });
    }

    function render(options) {
      var opts = options || {};
      if (excerptChapter && excerptChapter.value !== state.chapter && !excerptChapter.disabled) {
        excerptChapter.value = state.chapter;
      }
      var filtered = sorted.filter(function (card) {
        if (state.book !== "all" && card.dataset.book !== state.book) return false;
        if (state.month !== "all" && card.dataset.month !== state.month) return false;
        if (state.chapter !== "all" && card.dataset.chapterIndex !== state.chapter) return false;
        return true;
      });
      var totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
      state.page = Math.min(Math.max(1, state.page), totalPages);
      var start = (state.page - 1) * PAGE_SIZE;
      var pageCards = filtered.slice(start, start + PAGE_SIZE);

      allCards.forEach(function (card) { card.hidden = true; });
      pageCards.forEach(function (card) { card.hidden = false; });
      excerptGrid.hidden = filtered.length === 0;
      Array.prototype.forEach.call(excerptGrid.querySelectorAll(".excerpt-group"), function (node) {
        node.parentNode.removeChild(node);
      });

      var currentKey = "";
      var group = null;
      var countNode = null;
      var groupCount = 0;
      pageCards.forEach(function (card) {
        var key = state.view === "time"
          ? card.dataset.month
          : card.dataset.bookIndex + ":" + card.dataset.chapterIndex;
        if (key !== currentKey) {
          currentKey = key;
          groupCount = 0;
          group = document.createElement("div");
          group.className = "excerpt-group";
          var title = document.createElement("span");
          var detail = document.createElement("small");
          if (state.view === "time") {
            title.textContent = formatMonth(card.dataset.month);
          } else {
            title.textContent = card.dataset.chapter || "未分章";
            detail.dataset.book = card.dataset.book;
          }
          group.appendChild(title);
          group.appendChild(detail);
          excerptGrid.insertBefore(group, card);
          countNode = detail;
        }
        groupCount += 1;
        if (countNode) {
          countNode.textContent = state.view === "time"
            ? groupCount + " 条"
            : card.dataset.book + " · " + groupCount + " 条";
        }
      });

      if (excerptEmpty) excerptEmpty.hidden = filtered.length !== 0;
      if (excerptCount) {
        excerptCount.textContent = filtered.length
          ? "共 " + filtered.length + " 条摘录 · 第 " + state.page + " / " + totalPages + " 页"
          : "共 0 条摘录";
      }
      renderPager(totalPages);
      setUrl();
      if (opts.scroll && excerptSection) excerptSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    readUrl();
    syncControls();
    refreshChapterOptions();
    sortCards();
    render();

    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        state.book = chip.dataset.filter || "all";
        state.chapter = "all";
        state.page = 1;
        syncControls();
        refreshChapterOptions();
        render();
      });
    });

    if (excerptMonth) {
      excerptMonth.addEventListener("change", function () {
        state.month = excerptMonth.value;
        state.page = 1;
        render();
      });
    }

    if (excerptChapter) {
      excerptChapter.addEventListener("change", function () {
        state.chapter = excerptChapter.value;
        state.page = 1;
        render();
      });
    }

    viewButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        var view = button.dataset.view;
        if (!view || view === state.view) return;
        state.view = view;
        state.page = 1;
        if (view === "book") {
          state.month = "all";
        } else {
          state.chapter = "all";
        }
        syncControls();
        refreshChapterOptions();
        sortCards();
        render();
      });
    });

    excerptPager.addEventListener("click", function (event) {
      var button = event.target.closest(".pager-btn");
      if (!button || button.disabled) return;
      var page = Number(button.dataset.page);
      if (!Number.isInteger(page) || page < 1) return;
      state.page = page;
      render({ scroll: true });
    });
  }

  var sections = Array.prototype.slice.call(document.querySelectorAll("main section[id]"));
  var links = Array.prototype.slice.call(document.querySelectorAll(".nav a"));
  if (sections.length && links.length && "IntersectionObserver" in window) {
    var navObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var id = entry.target.getAttribute("id");
        links.forEach(function (link) {
          var active = link.getAttribute("href") === "#" + id;
          link.style.color = active ? "var(--ink)" : "";
          link.style.textDecoration = active ? "underline" : "";
          link.style.textUnderlineOffset = active ? "6px" : "";
        });
      });
    }, { rootMargin: "-40% 0px -55% 0px" });
    sections.forEach(function (section) { navObserver.observe(section); });
  }
})();
