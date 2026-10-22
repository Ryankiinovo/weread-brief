(function () {
  "use strict";

  var chips = Array.prototype.slice.call(document.querySelectorAll(".chip"));
  var notes = Array.prototype.slice.call(document.querySelectorAll(".note"));
  var noteLabel = document.getElementById("filter-note");
  var total = notes.length;

  chips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      var filter = chip.getAttribute("data-filter");
      chips.forEach(function (other) {
        var active = other === chip;
        other.classList.toggle("is-active", active);
        other.setAttribute("aria-pressed", active ? "true" : "false");
      });
      var shown = 0;
      notes.forEach(function (note) {
        var match = filter === "all" || note.getAttribute("data-book") === filter;
        note.hidden = !match;
        if (match) shown += 1;
      });
      if (noteLabel) {
        noteLabel.textContent = filter === "all"
          ? "显示全部 " + total + " 条"
          : "显示 " + shown + " 条 / 共 " + total + " 条";
      }
    });
  });

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
