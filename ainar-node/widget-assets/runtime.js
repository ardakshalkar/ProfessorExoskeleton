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
