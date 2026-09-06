/**
 * LaTeX on a slide, turned into text a projector can show.
 *
 * A lecture deck is not a paper. The mathematics that appears on one is almost
 * always a conditional probability, a cost formula, a sum or a ratio — things
 * Unicode can set perfectly well — and typesetting them properly would mean a
 * TeX toolchain or a headless browser running KaTeX, which is a large
 * dependency for a plugin whose other three are optional.
 *
 * So this converts the subset that actually turns up, and is loud about the
 * rest. That second half is the important one: silently emitting a mangled
 * formula is worse than emitting none, because a formula is read as authoritative
 * and nobody proofreads the projector. Anything that survives conversion is
 * reported by name, and the caller stops.
 *
 * What it does not attempt: stacked fractions, matrices, integrals with limits
 * above and below, aligned environments. Those want a real typesetter, and the
 * honest answer for a slide is a picture — draw it, register it as a figure,
 * and the deck carries an image the way it carries any other diagram.
 */

/** `x^2` and friends. Only characters with a real superscript form. */
const SUPERSCRIPT: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴",
  "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
  "+": "⁺", "-": "⁻", "−": "⁻", "=": "⁼", "(": "⁽", ")": "⁾",
  a: "ᵃ", b: "ᵇ", c: "ᶜ", d: "ᵈ", e: "ᵉ", f: "ᶠ", g: "ᵍ", h: "ʰ",
  i: "ⁱ", j: "ʲ", k: "ᵏ", l: "ˡ", m: "ᵐ", n: "ⁿ", o: "ᵒ", p: "ᵖ",
  r: "ʳ", s: "ˢ", t: "ᵗ", u: "ᵘ", v: "ᵛ", w: "ʷ", x: "ˣ", y: "ʸ", z: "ᶻ",
  T: "ᵀ",
};

/** `x_1` and friends. Unicode has fewer of these, which the caller must handle. */
const SUBSCRIPT: Record<string, string> = {
  "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄",
  "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉",
  "+": "₊", "-": "₋", "−": "₋", "=": "₌", "(": "₍", ")": "₎",
  a: "ₐ", e: "ₑ", h: "ₕ", i: "ᵢ", j: "ⱼ", k: "ₖ", l: "ₗ", m: "ₘ",
  n: "ₙ", o: "ₒ", p: "ₚ", r: "ᵣ", s: "ₛ", t: "ₜ", u: "ᵤ", v: "ᵥ", x: "ₓ",
};

/** One-for-one replacements, longest name first so `\le` cannot eat `\leq`. */
const SYMBOLS: Record<string, string> = {
  // structure and spacing
  "\\quad": "  ", "\\qquad": "    ", "\\,": " ", "\\;": " ", "\\:": " ", "\\!": "",
  "\\left": "", "\\right": "", "\\big": "", "\\Big": "",
  // relations
  "\\leq": "≤", "\\le": "≤", "\\geq": "≥", "\\ge": "≥",
  "\\neq": "≠", "\\ne": "≠", "\\equiv": "≡", "\\approx": "≈", "\\sim": "∼",
  "\\propto": "∝", "\\mid": "|", "\\parallel": "∥",
  // operators
  "\\times": "×", "\\cdot": "·", "\\div": "÷", "\\pm": "±", "\\mp": "∓",
  "\\sum": "∑", "\\prod": "∏", "\\int": "∫", "\\partial": "∂", "\\nabla": "∇",
  "\\infty": "∞", "\\surd": "√",
  // sets and logic
  "\\in": "∈", "\\notin": "∉", "\\subset": "⊂", "\\subseteq": "⊆",
  "\\cup": "∪", "\\cap": "∩", "\\emptyset": "∅", "\\varnothing": "∅",
  "\\forall": "∀", "\\exists": "∃", "\\neg": "¬", "\\land": "∧", "\\lor": "∨",
  // arrows
  "\\rightarrow": "→", "\\leftarrow": "←", "\\leftrightarrow": "↔",
  "\\Rightarrow": "⇒", "\\Leftarrow": "⇐", "\\Leftrightarrow": "⇔",
  "\\to": "→", "\\mapsto": "↦",
  // dots
  "\\ldots": "…", "\\dots": "…", "\\cdots": "⋯", "\\vdots": "⋮", "\\ddots": "⋱",
  // greek
  "\\alpha": "α", "\\beta": "β", "\\gamma": "γ", "\\delta": "δ",
  "\\epsilon": "ε", "\\varepsilon": "ε", "\\zeta": "ζ", "\\eta": "η",
  "\\theta": "θ", "\\vartheta": "ϑ", "\\iota": "ι", "\\kappa": "κ",
  "\\lambda": "λ", "\\mu": "μ", "\\nu": "ν", "\\xi": "ξ", "\\pi": "π",
  "\\rho": "ρ", "\\sigma": "σ", "\\tau": "τ", "\\upsilon": "υ",
  "\\phi": "φ", "\\varphi": "φ", "\\chi": "χ", "\\psi": "ψ", "\\omega": "ω",
  "\\Gamma": "Γ", "\\Delta": "Δ", "\\Theta": "Θ", "\\Lambda": "Λ",
  "\\Xi": "Ξ", "\\Pi": "Π", "\\Sigma": "Σ", "\\Phi": "Φ", "\\Psi": "Ψ", "\\Omega": "Ω",
  // named functions
  "\\log": "log", "\\ln": "ln", "\\exp": "exp", "\\max": "max", "\\min": "min",
  "\\argmax": "argmax", "\\argmin": "argmin", "\\softmax": "softmax",
  "\\sin": "sin", "\\cos": "cos", "\\tan": "tan",
};

const SYMBOL_NAMES = Object.keys(SYMBOLS).sort((a, b) => b.length - a.length);

/**
 * The contents of the brace group starting at `open`, and where it ends.
 * Nested braces are counted, so `\frac{a_{1}}{b}` does not end at the first `}`.
 */
function group(source: string, open: number): { body: string; end: number } | null {
  if (source[open] !== "{") return null;
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    else if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return { body: source.slice(open + 1, index), end: index };
    }
  }
  return null;
}

/** The argument after `_` or `^`: a brace group, or the single next character. */
function argument(source: string, at: number): { body: string; end: number } | null {
  const braced = group(source, at);
  if (braced) return braced;
  const character = source[at];
  if (!character || character === "\\") return null;
  return { body: character, end: at };
}

/** Every character mapped, or null — a partial mapping is worse than none. */
function script(body: string, table: Record<string, string>): string | null {
  let out = "";
  for (const character of body) {
    const mapped = table[character];
    if (mapped === undefined) return null;
    out += mapped;
  }
  return out;
}

export interface MathConversion {
  text: string;
  /** LaTeX commands that had no equivalent, in the order they appeared. */
  unconverted: string[];
}

/**
 * One LaTeX fragment as Unicode text.
 *
 * `x^2` becomes `x²` and `x_{t-1}` becomes `xₜ₋₁`. Where Unicode has no
 * subscript for a character — most capitals, and several lower-case letters —
 * the script is written the way a person would type it, `x_(t-1)`, rather than
 * dropped or half-converted.
 */
export function latexToUnicode(source: string): MathConversion {
  const unconverted: string[] = [];
  let out = "";
  let index = 0;

  while (index < source.length) {
    const rest = source.slice(index);

    // \frac{a}{b} → a⁄b, with the numerator or denominator bracketed when it is
    // compound, so `\frac{a+b}{c}` cannot be misread as `a + b⁄c`.
    if (rest.startsWith("\\frac") || rest.startsWith("\\dfrac") || rest.startsWith("\\tfrac")) {
      const nameLength = rest.startsWith("\\frac") ? 5 : 6;
      const first = group(source, index + nameLength);
      const second = first ? group(source, first.end + 1) : null;
      if (first && second) {
        // Bracket only a compound term. `x₁` and `10⁶` are single things and
        // reading `(x₁)⁄y` is worse than reading `x₁⁄y`; `a + b` is not, and
        // `a + b⁄c` would be a different formula. Testing for `\w` is not
        // enough — a converted subscript is outside it, so every converted term
        // came out bracketed.
        const wrap = (part: string): string => {
          const converted = latexToUnicode(part);
          unconverted.push(...converted.unconverted);
          const compound = /[\s+\-−×·⁄/=,±]/.test(converted.text);
          return compound ? `(${converted.text})` : converted.text;
        };
        out += `${wrap(first.body)}⁄${wrap(second.body)}`;
        index = second.end + 1;
        continue;
      }
    }

    // \text{…} and its relatives are ordinary words inside mathematics.
    const wordy = /^\\(?:text|mathrm|mathit|mathbf|operatorname|mbox)\{/.exec(rest);
    if (wordy) {
      const braces = group(source, index + wordy[0].length - 1);
      if (braces) {
        out += braces.body;
        index = braces.end + 1;
        continue;
      }
    }

    // \sqrt{x} → √(x); the bar over the radicand cannot be drawn in text, so the
    // brackets carry what the bar would have.
    if (rest.startsWith("\\sqrt")) {
      const braces = group(source, index + 5);
      if (braces) {
        const converted = latexToUnicode(braces.body);
        unconverted.push(...converted.unconverted);
        out += `√(${converted.text})`;
        index = braces.end + 1;
        continue;
      }
    }

    if (source[index] === "^" || source[index] === "_") {
      const raised = source[index] === "^";
      const found = argument(source, index + 1);
      if (found) {
        const converted = latexToUnicode(found.body);
        unconverted.push(...converted.unconverted);
        const mapped = script(converted.text, raised ? SUPERSCRIPT : SUBSCRIPT);
        // A script Unicode cannot set is written as a person would type it,
        // rather than silently flattened into the baseline where `x_1` and `x1`
        // become the same thing.
        out += mapped ?? `${raised ? "^" : "_"}(${converted.text})`;
        index = found.end + 1;
        continue;
      }
    }

    if (source[index] === "\\") {
      const name = SYMBOL_NAMES.find(
        (candidate) =>
          rest.startsWith(candidate) &&
          // `\pi` must not match inside `\pion`; a letter command ends at a
          // non-letter.
          (!/[a-zA-Z]$/.test(candidate) || !/[a-zA-Z]/.test(rest[candidate.length] ?? "")),
      );
      if (name) {
        out += SYMBOLS[name];
        index += name.length;
        continue;
      }
      if (rest.startsWith("\\\\")) {
        out += "\n";
        index += 2;
        continue;
      }
      const unknown = /^\\[a-zA-Z]+/.exec(rest);
      if (unknown) {
        unconverted.push(unknown[0]);
        out += unknown[0];
        index += unknown[0].length;
        continue;
      }
    }

    if (source[index] === "{" || source[index] === "}") {
      index += 1; // grouping braces carry no meaning once the structure is resolved
      continue;
    }

    out += source[index];
    index += 1;
  }

  // `=`, `+` and the relations read as cramped without air around them, which is
  // exactly what a typesetter would have added.
  const spaced = out
    .replace(/\s*([=+≤≥≠≈±⇒→↔∈])\s*/g, " $1 ")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  return { text: spaced, unconverted: [...new Set(unconverted)] };
}

/** Display math: `\[ … \]` or `$$ … $$`, as a whole paragraph. */
const DISPLAY = /^(?:\\\[([\s\S]*)\\\]|\$\$([\s\S]*)\$\$)$/;

export const displayMath = (paragraph: string): string | null => {
  const found = DISPLAY.exec(paragraph.trim());
  if (!found) return null;
  return (found[1] ?? found[2] ?? "").trim();
};

/**
 * Inline math inside ordinary prose: `\( … \)` or `$ … $`.
 *
 * Single-dollar is deliberately conservative — it must not span a line break and
 * must not have a digit immediately after the closing dollar, or every price on
 * a slide ("$0.05 → $30.00") becomes a formula.
 */
export function convertInline(text: string): MathConversion {
  const unconverted: string[] = [];
  const converted = text
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, body: string) => {
      const result = latexToUnicode(body);
      unconverted.push(...result.unconverted);
      return result.text;
    })
    .replace(/(^|[^\\$])\$([^$\n]+)\$(?![\d])/g, (_, before: string, body: string) => {
      const result = latexToUnicode(body);
      unconverted.push(...result.unconverted);
      return `${before}${result.text}`;
    });
  return { text: converted, unconverted: [...new Set(unconverted)] };
}
