const api = window.openai || {};
const root = document.getElementById('root');

function read(name) {
  const value = api[name];
  return typeof value === 'function' ? value.call(api) : value;
}

function esc(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

// The only two places a number is touched, and both are formatting: `pct` takes
// a proportion the payload already computed, `pctWhole` a value already out of a
// hundred. Every figure a widget shows comes from the payload, so a view that
// needed `Math.round` of its own would be deriving one — which is why the test
// looks for exactly that token in the view sources.
function pct(value) {
  return value == null ? null : Math.round(value * 100) + '%';
}

function pctWhole(value) {
  return value == null ? null : Math.round(value) + '%';
}

// A link the payload asked for, or nothing. Relative paths are how the hosted
// page reaches a material it published beside itself; an absolute one is a
// resource that already lived somewhere. Everything else — `javascript:`,
// `data:`, a root-relative path that means something different depending on
// where the document is served from — becomes null, so the caller renders plain
// text instead of a link: a URL in a course model is data, and this is the one
// place it would be handed to the browser as an instruction.
//
// It returns the value unescaped. Escaping happens once, where the value is
// interpolated — in `tmpl` for a template-driven view — and a string escaped
// here as well would reach the document double-escaped.
function safeUrl(value) {
  const raw = String(value == null ? '' : value).trim();
  if (!raw) return null;
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(raw);
  if (!scheme) return raw.charAt(0) === '/' ? null : raw;
  return /^https?$/i.test(scheme[1]) ? raw : null;
}

function band(value) {
  if (value == null) return 'nil';
  for (const [floor, css] of BANDS) if (value >= floor) return css;
  return 'nil';
}

function ask(question) {
  if (typeof api.sendFollowUpMessage === 'function') {
    api.sendFollowUpMessage({ prompt: question });
  }
}

// Ask the host to show a material without leaving the page, and say whether it
// took the job.
//
// Only a host that offers `openMaterial` has anywhere to put one — a pane
// inside an application window does, a chat client rendering this widget in a
// message does not, and neither does the published page, where the link IS the
// navigation. So this is a capability test rather than a preference: false
// means the click was not handled, and must be left alone to follow its href.
function showMaterial(url, label, format) {
  if (typeof api.openMaterial !== 'function') return false;
  if (!url) return false;
  // `format` is the file's extension, and the host needs it: a PDF and an
  // image are painted by a viewer the browser will not run inside a sandboxed
  // frame, and an HTML handout is a document that must be.
  api.openMaterial({ url: url, label: label, format: format || '' });
  return true;
}

// A piece of graded work, opened over the plan rather than in place.
//
// Not the disclosure the week panel uses, and the difference is the content
// rather than the taste: a brief is several paragraphs, and expanding one
// inside a week card would push every later week down the page, so the
// professor loses their place in the term in order to read one assignment. A
// sheet leaves the plan where it is.
//
// The text is already in the document — the view emits a hidden panel beside
// each chip that has one — so this moves markup it can already see rather than
// fetching anything. `cloneNode` rather than a move, because the same brief can
// be opened twice and a moved node would be gone the second time.
//
// These live outside `paint` deliberately. `paint` replaces `root.innerHTML`,
// so anything it captured in a closure is a detached node one repaint later;
// looking the sheet up at the moment it is used is what makes a handler
// registered once still correct after the payload updates.
var sheetOpener = null;

function sheetNode() { return root.querySelector('[data-sheet]'); }

function closeSheet() {
  const sheet = sheetNode();
  if (!sheet || sheet.hidden) return;
  const body = root.querySelector('[data-sheetbody]');
  sheet.hidden = true;
  if (body) body.textContent = '';
  // Back to the chip that opened it. Dropping focus to the top of the document
  // is the failure that makes a keyboard user walk the whole term again.
  if (sheetOpener && typeof sheetOpener.focus === 'function') sheetOpener.focus();
  sheetOpener = null;
}

function openSheet(panel, button) {
  const sheet = sheetNode();
  const body = root.querySelector('[data-sheetbody]');
  if (!sheet || !body || !panel) return;
  body.textContent = '';
  const copy = panel.cloneNode(true);
  copy.hidden = false;
  copy.removeAttribute('data-briefdoc');
  // The panel is a `<details>` so that it works with no script at all. Inside
  // the sheet the disclosure is beside the point — the press already asked for
  // it — so the copy opens, and the stylesheet drops its summary.
  copy.open = true;
  body.appendChild(copy);
  sheet.hidden = false;
  sheetOpener = button;
  const box = sheet.querySelector('.sheetbox');
  if (box && typeof box.focus === 'function') box.focus();
}

// Escape closes it, from wherever focus happens to be — on the document rather
// than the box, because the pane renders this in a frame and a click on the
// backdrop moves focus out of the dialog.
//
// Bound ONCE for the life of the page. Everything `paint` binds is re-bound on
// every repaint and that costs nothing, because the old nodes are discarded
// with their listeners; the document is not, so a listener added per paint
// would accumulate one copy per payload update and never be collected.
// Guarded, because one caller is not a browser. `bin/prerender-widget.mjs`
// executes these scripts against a stub host that is deliberately not a DOM —
// it offers `document.getElementById('root')` and nothing else — so an
// unguarded call here throws at module load, and the thing that breaks is
// `ainar page`, which is the surface furthest from the one this feature is for.
if (typeof document.addEventListener === 'function') {
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') closeSheet();
  });
}

function state() { return read('widgetState') || {}; }
function setState(next) {
  if (typeof api.setWidgetState === 'function') api.setWidgetState(next);
}

function paint() {
  const data = read('toolOutput');
  if (!data) {
    root.innerHTML = '<p class="empty">Waiting for the course model\u2026</p>';
    return;
  }
  try {
    root.innerHTML = view(data);
  } catch (error) {
    root.innerHTML = '<p class="empty">This widget could not render: '
      + esc(error && error.message) + '</p>';
    return;
  }
  root.querySelectorAll('[data-ask]').forEach(function (node) {
    node.addEventListener('click', function () { ask(node.dataset.ask); });
  });
  // A material the host can show in place, shown in place.
  //
  // The anchor keeps its href and its `target`, which is the point: a
  // middle-click, a ctrl-click, a right-click "open in new tab" and a host
  // with nowhere to put an overlay all still open the file the old way. Only
  // the plain left click is taken, and only where `showMaterial` says the host
  // accepted it.
  root.querySelectorAll('a[data-view]').forEach(function (link) {
    link.addEventListener('click', function (event) {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (showMaterial(link.getAttribute('href'), link.dataset.view, link.dataset.format)) {
        event.preventDefault();
      }
    });
  });

  root.querySelectorAll('[data-pick]').forEach(function (node) {
    node.addEventListener('click', function () {
      setState(Object.assign({}, state(), { picked: node.dataset.pick }));
      paint();
    });
  });

  // A clipped row of chips, and its `more` button.
  //
  // The button ships hidden and is revealed only where the row actually
  // overflows, because a control that does nothing is worse than no control: a
  // module with two concepts would otherwise offer to expand a line that is
  // already whole. `scrollHeight > clientHeight + 1` is the test, the `+1`
  // absorbing sub-pixel rounding at fractional zoom levels.
  //
  // Measured after layout rather than during it — `requestAnimationFrame` puts
  // this after the browser has laid the row out, so `scrollHeight` is real.
  // Without that the row is unstyled at measuring time and every button shows.
  // The materials fold. Unlike the chip row this needs no measuring: the count
  // is on the button, so a reader knows what is behind it before pressing.
  //
  // Only the label span is rewritten. The button also holds an icon, and
  // setting `textContent` on the button would delete it on the first press.
  root.querySelectorAll('[data-mats]').forEach(function (group) {
    var button = group.querySelector('[data-matbtn]');
    if (!button) return;
    var label = button.querySelector('[data-matlabel]') || button;
    var shut = label.textContent;
    button.addEventListener('click', function () {
      var open = group.hasAttribute('data-open');
      if (open) group.removeAttribute('data-open');
      else group.setAttribute('data-open', '');
      label.textContent = open ? shut : 'hide';
    });
  });

  // The week's details panel. Unlike the chip row this needs no measuring:
  // the panel is built only when there is something in it that the card does
  // not already show, so the control appears exactly when it does something.
  root.querySelectorAll('[data-wkbtn]').forEach(function (button) {
    var card = button.closest('.wk');
    var panel = card ? card.querySelector('[data-wkpanel]') : null;
    if (!panel) return;
    button.addEventListener('click', function () {
      panel.hidden = !panel.hidden;
      button.setAttribute('aria-expanded', panel.hidden ? 'false' : 'true');
      card.classList.toggle('open', !panel.hidden);
    });
  });

  // A piece of graded work, opened over the plan rather than in place.
  //
  // Not the disclosure the week panel uses, and the difference is the content
  // rather than the taste: a brief is several paragraphs, and expanding one
  // inside a week card would push every later week down the page, so the
  // professor loses their place in the term to read one assignment. A sheet
  // leaves the plan where it is.
  //
  // The chip that names a piece of graded work becomes the button that opens
  // it — but only here, where a script is running to answer the press.
  //
  // The template ships the label as a plain span and the brief as an open-able
  // `<details>` beneath it, which is the whole feature on the prerendered public
  // page. This upgrades that pair for a host that can do better: the span
  // becomes a real button and the inline disclosure is folded away.
  //
  // Built rather than merely bound, so the public page carries no control that
  // does nothing — the same rule the `more` button below is written to.
  //
  // Where the press LANDS depends on what the host can do, in the same order of
  // preference a deck's link already uses:
  //
  //   1. `openMaterial` with a page the host serves — the overlay over the
  //      whole window, which is where a PDF and a deck open. This is the pane,
  //      and it is the right answer there: the widget is one frame inside one
  //      column, so a dialog drawn in here is a dialog inside a column, which
  //      is not what "open the homework" should look like.
  //   2. the sheet below, drawn in this document — a host that can run a script
  //      but serves no brief route, which is a chat client rendering the widget
  //      in a message.
  //   3. the `<details>`, untouched, for a host running no script at all.
  root.querySelectorAll('[data-briefkey]').forEach(function (label) {
    var panel = root.querySelector('[data-briefdoc="' + label.dataset.briefkey + '"]');
    if (!panel || typeof document.createElement !== 'function') return;
    panel.hidden = true;
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'itk itbrief';
    button.title = 'What this asks for';
    button.textContent = label.textContent;
    // Read before the swap, not inside the handler: the span is detached a line
    // later, and a closure reaching back into a node the document no longer
    // holds is a thing that happens to keep working rather than a thing meant.
    var href = label.dataset.briefurl || '';
    var name = label.dataset.briefname || label.textContent;
    var fmt = label.dataset.brieffmt || 'html';
    button.addEventListener('click', function () {
      // `showMaterial` is the capability test and reports whether it took the
      // job; only when it did not does the local sheet open.
      if (showMaterial(href, name, fmt)) return;
      openSheet(panel, button);
    });
    label.parentNode.replaceChild(button, label);
  });

  root.querySelectorAll('[data-sheetclose]').forEach(function (node) {
    node.addEventListener('click', closeSheet);
  });

  // The rest of a clipped list, behind the ellipsis standing in for it.
  //
  // Emitted by the view only when something is actually folded, so — like the
  // week panel and unlike the chip row — there is nothing to measure: a control
  // that exists is a control that opens something. `hidden` rather than a class
  // so the tail is invisible before the stylesheet arrives as well as after.
  root.querySelectorAll('[data-restbtn]').forEach(function (button) {
    var rest = button.parentNode.querySelector('[data-rest]');
    if (!rest) return;
    button.addEventListener('click', function () {
      rest.hidden = !rest.hidden;
      button.setAttribute('aria-expanded', rest.hidden ? 'false' : 'true');
      button.textContent = rest.hidden ? '…' : 'less';
    });
  });

  root.querySelectorAll('[data-chips]').forEach(function (group) {
    var row = group.querySelector('.chiprow');
    var button = group.querySelector('[data-more]');
    if (!row || !button) return;
    requestAnimationFrame(function () {
      if (row.scrollHeight <= row.clientHeight + 1) return;
      // How many did not fit, so the control says what it opens. Counted by
      // comparing each chip's top against the first one's: a chip on a lower
      // row is a chip the professor cannot see.
      var first = row.firstElementChild;
      var top = first ? first.offsetTop : 0;
      var hidden = 0;
      row.querySelectorAll('.chip').forEach(function (chip) {
        if (chip.offsetTop > top + 1) hidden += 1;
      });
      var shut = '+ ' + hidden + (hidden === 1 ? ' topic' : ' topics');
      button.textContent = shut;
      button.hidden = false;
      button.addEventListener('click', function () {
        var open = group.hasAttribute('data-open');
        if (open) group.removeAttribute('data-open');
        else group.setAttribute('data-open', '');
        button.textContent = open ? shut : 'less';
      });
    });
  });
}

for (const event of ['openai:set_globals', 'openai:tool_response',
                     'ui:notifications/tool-result']) {
  window.addEventListener(event, paint);
}
paint();
