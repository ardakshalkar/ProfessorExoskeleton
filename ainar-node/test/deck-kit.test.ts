import { strict as assert } from "node:assert";
import { test } from "node:test";
import { C, H, W, fs, px } from "../src/deck-kit.ts";

/**
 * The port's whole risk is arithmetic.
 *
 * `deck_kit.py` positions in EMU and this positions in inches, so a coordinate
 * copied out of one of the seven build scripts means the same thing only if the
 * two conversions agree exactly. They are not approximations of each other —
 * 9525 EMU per pixel and 914400 EMU per inch are the same statement — and these
 * assertions are that claim written down, so a "tidier" constant cannot be
 * substituted for one of them without a failure.
 *
 * The drawing itself is checked by building a deck with every primitive on it
 * and looking at the render; that is not something a test can assert usefully,
 * and the file it produces is not worth checking in.
 */

/** What `deck_kit.py`'s `px()` returns, in EMU. */
const emu = (slidePixels: number): number => Math.round(slidePixels * 9525);
const EMU_PER_INCH = 914400;

test("a slide-pixel is the same distance in EMU and in inches", () => {
  for (const value of [0, 1, 24, 42, 154, 720, 1196, 1280]) {
    assert.equal(
      px(value),
      emu(value) / EMU_PER_INCH,
      `${value} slide-pixels should be the same length under both kits`,
    );
  }
});

test("the canvas is 1280x720 slide-pixels, which is 13.333 by 7.5 inches", () => {
  assert.equal(W, 1280);
  assert.equal(H, 720);
  // pptxgenjs's own LAYOUT_WIDE, which is why a deck built with this kit opens
  // at the same size as one rendered from markdown.
  assert.equal(Number(px(W).toFixed(3)), 13.333);
  assert.equal(px(H), 7.5);
});

test("a font size is slide-pixels turned into points at three quarters", () => {
  // 96 px/in against 72 pt/in. `size: 24` is 18pt in the Python kit and must be
  // 18pt here, or every deck rebuilt with this one reflows.
  assert.equal(fs(24), 18);
  assert.equal(fs(47), 35.25);
  assert.equal(fs(13), 9.75);
  for (const value of [13, 15, 17, 18, 22, 24, 25, 47, 60]) {
    assert.equal(fs(value), (value * 96) / 128, "the ratio should be 72/96");
  }
});

test("the palette is the same eleven values, in the form pptxgenjs wants", () => {
  // Same names as `deck_kit.py`'s `C`, so a build script's `C.muted` still
  // resolves; same values, so nothing shifts hue on the way across; no `#`,
  // because pptxgenjs rejects it.
  assert.deepEqual(
    { ...C },
    {
      ink: "111111",
      muted: "59636E",
      line: "B8BCC4",
      panel: "EDEDED",
      pale: "EAF5FB",
      accent: "3D8DFF",
      accent2: "6DCBF4",
      draft: "8C3518",
      white: "FFFFFF",
      code_bg: "F4F4F4",
    },
  );
  for (const [name, value] of Object.entries(C)) {
    assert.match(value, /^[0-9A-F]{6}$/, `${name} should be six hex digits and no hash`);
  }
});
