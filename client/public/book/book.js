/* waznexpress.com/book — the three things the page has to do.
   This file is separate because production runs no inline script. */
(function () {
  "use strict";

  /* ── 1 · one language at a time ───────────────────────────────── */
  var LANG_KEY = "wazn.book.lang";
  var bar = document.getElementById("lang");

  function setLang(lang, remember) {
    var ku = lang === "ku";
    document.body.classList.toggle("lang-ku", ku);
    document.documentElement.lang = ku ? "ckb" : "ar";
    var buttons = bar.querySelectorAll("button");
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].setAttribute("aria-pressed", String(buttons[i].dataset.lang === lang));
    }
    if (remember) { try { localStorage.setItem(LANG_KEY, lang); } catch (e) { /* private window */ } }
  }

  bar.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-lang]");
    if (b) setLang(b.dataset.lang, true);
  });

  // A Kurdish reader who came back, or anyone whose phone asks for Kurdish.
  var saved = null;
  try { saved = localStorage.getItem(LANG_KEY); } catch (e) { /* private window */ }
  if (!saved && /^(ckb|ku)\b/i.test(navigator.language || "")) saved = "ku";
  if (saved === "ku") setLang("ku", false);

  /* ── 2 · share the link ───────────────────────────────────────── */
  var toast = document.getElementById("toast");
  var toastTimer;

  function say() {
    toast.classList.add("on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove("on"); }, 2200);
  }

  document.getElementById("share").addEventListener("click", function () {
    var url = location.origin + location.pathname;
    var data = { title: document.title, text: document.title, url: url };
    if (navigator.share) {
      navigator.share(data).catch(function () { /* the sheet was dismissed */ });
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(say, function () { /* no permission */ });
    }
  });

  /* ── 3 · the text stays on the page ───────────────────────────────
     Casual copying is turned off: no selection, no long-press menu, no
     right-click, no drag, no Ctrl+C.  This stops a passer-by lifting the
     wording; it cannot stop a screenshot or "view source", and it is not
     meant to.  The phone and address are links, so they still work. */
  ["copy", "cut", "contextmenu", "dragstart", "selectstart"].forEach(function (type) {
    document.addEventListener(type, function (e) { e.preventDefault(); });
  });
})();
