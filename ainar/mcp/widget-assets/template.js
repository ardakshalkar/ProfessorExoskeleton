// A very small template language, so a view's markup is a file rather than a
// function.
//
// The views were string concatenation in JavaScript, which meant the structure
// of the public course page — what sections it has and in what order — was
// readable only by reading code, and editable only by editing code. This makes
// the markup a template a professor can open, and keeps the view as the part
// that prepares values.
//
// It is deliberately not Twig, Handlebars or Nunjucks, and the reason is one
// feature all three have: an unescaped-output construct. `|raw`, `{{{ }}}`,
// `triple-stash` — whichever spelling, it is a way to put payload text into the
// document as markup, on the one surface in this repository written for a URL a
// student can open. `tests/test_page.py` asserts against the rendered bytes that
// nothing in the payload can reach the HTML parser as markup, and an escape
// hatch in the template language would make that assertion a matter of nobody
// having used the hatch yet. So there is no hatch: every interpolation goes
// through `esc`, and `{{{` is a parse error rather than a feature.
//
// What it has, and nothing more:
//
//     {{ path.to.value }}              escaped; empty for null or undefined
//     {% if path %} … {% else %} … {% endif %}
//     {% for item in path %} … {% endfor %}
//     {# a comment #}
//
// A path is dotted names, resolved against the enclosing loop variables first
// and then the model. There are no expressions, no filters, no arithmetic and no
// function calls — a template that could compute could compute a figure, and
// every figure here comes from a command. Formatting belongs in the view, which
// is why the model it passes in carries `weight_text` rather than `weight`.
//
// Whitespace: a block tag on its own line takes the line with it — the
// indentation before it and the newline after it are dropped — so a readable
// template does not produce a document full of blank lines. Text around `{{ }}`
// is left exactly as written, because a space between two inline elements is
// often the difference between "30% of the grade" and "30%of the grade".

const TMPL_CACHE = new Map();

const TMPL_TOKEN =
  /\{\{\s*([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)\s*\}\}|\{%\s*([a-z]+)([^%]*?)\s*%\}|\{#[\s\S]*?#\}/g;

function tmplParse(source) {
  if (source.indexOf('{{{') !== -1) {
    throw new Error('{{{ }}} is not a construct: every value is escaped');
  }

  const root = { body: [], alt: null };
  const stack = [{ kind: 'root', node: root }];
  const top = function () { return stack[stack.length - 1]; };
  const into = function () {
    const frame = top();
    return frame.inElse ? frame.node.alt : frame.node.body;
  };

  let cursor = 0;
  let trimNext = false;
  let match;

  const emit = function (raw, beforeBlock) {
    let value = raw;
    if (trimNext) value = value.replace(/^\n/, '');
    if (beforeBlock) value = value.replace(/(^|\n)[ \t]+$/, '$1');
    if (value) into().push({ kind: 'text', value: value });
  };

  TMPL_TOKEN.lastIndex = 0;
  while ((match = TMPL_TOKEN.exec(source)) !== null) {
    const isBlock = match[2] !== undefined;
    const isComment = match[1] === undefined && match[2] === undefined;
    emit(source.slice(cursor, match.index), isBlock || isComment);
    cursor = match.index + match[0].length;
    trimNext = isBlock || isComment;

    if (isComment) continue;

    if (!isBlock) {
      into().push({ kind: 'value', path: match[1] });
      trimNext = false;
      continue;
    }

    const keyword = match[2];
    const rest = (match[3] || '').trim();

    if (keyword === 'if') {
      const node = { kind: 'if', path: rest, body: [], alt: [] };
      into().push(node);
      stack.push({ kind: 'if', node: node, inElse: false });
    } else if (keyword === 'else') {
      if (top().kind !== 'if') throw new Error('{% else %} outside {% if %}');
      top().inElse = true;
    } else if (keyword === 'endif') {
      if (top().kind !== 'if') throw new Error('{% endif %} without {% if %}');
      stack.pop();
    } else if (keyword === 'for') {
      const parts = /^([A-Za-z_]\w*)\s+in\s+([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)$/.exec(rest);
      if (!parts) throw new Error('{% for %} wants "item in path", got: ' + rest);
      const node = { kind: 'for', name: parts[1], path: parts[2], body: [], alt: null };
      into().push(node);
      stack.push({ kind: 'for', node: node, inElse: false });
    } else if (keyword === 'endfor') {
      if (top().kind !== 'for') throw new Error('{% endfor %} without {% for %}');
      stack.pop();
    } else {
      throw new Error('unknown tag {% ' + keyword + ' %}');
    }
  }

  emit(source.slice(cursor), false);
  if (stack.length !== 1) throw new Error('a block was opened and never closed');
  return root.body;
}

function tmplLookup(scopes, path) {
  const names = path.split('.');
  for (let i = scopes.length - 1; i >= 0; i--) {
    let value = scopes[i];
    let found = true;
    for (const name of names) {
      if (value != null && typeof value === 'object' && name in value) {
        value = value[name];
      } else {
        found = false;
        break;
      }
    }
    if (found) return value;
  }
  return null;
}

// An empty list is false, so `{% if rows %}` is how a section asks whether it
// has anything to show. Everything else is ECMAScript truthiness.
function tmplTruthy(value) {
  return Array.isArray(value) ? value.length > 0 : Boolean(value);
}

function tmplRun(nodes, scopes) {
  let out = '';
  for (const node of nodes) {
    if (node.kind === 'text') {
      out += node.value;
    } else if (node.kind === 'value') {
      out += esc(tmplLookup(scopes, node.path));
    } else if (node.kind === 'if') {
      const branch = tmplTruthy(tmplLookup(scopes, node.path)) ? node.body : node.alt;
      out += tmplRun(branch, scopes);
    } else if (node.kind === 'for') {
      const list = tmplLookup(scopes, node.path);
      if (Array.isArray(list)) {
        for (const item of list) {
          const frame = {};
          frame[node.name] = item;
          scopes.push(frame);
          out += tmplRun(node.body, scopes);
          scopes.pop();
        }
      }
    }
  }
  return out;
}

function tmpl(source, model) {
  let nodes = TMPL_CACHE.get(source);
  if (!nodes) {
    nodes = tmplParse(source);
    TMPL_CACHE.set(source, nodes);
  }
  return tmplRun(nodes, [model || {}]);
}
