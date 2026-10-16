/**
 * React, the host's. `react` and `react-dom` are external to the bundle
 * (`build.mjs`): the built file calls `require("react")`, and the module
 * loader's `require` answers it with the copy every other client half uses.
 * A second React in the page would break hooks across the seat boundary.
 *
 * `h` and `Fragment` are also what JSX compiles to here — the classic
 * transform, since the loader offers no `react/jsx-runtime` — so a `.jsx` or
 * `.tsx` module imports them from this file.
 */

import * as React from "react";
// For one thing only: the material overlay. Everything else in this file
// renders inside the column; a deck cannot, so it is portalled to the body.
import * as ReactDOM from "react-dom";

export { React, ReactDOM };
export const h = React.createElement;
export const Fragment = React.Fragment;
