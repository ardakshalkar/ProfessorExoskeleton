/**
 * React, from the module loader's `require` — the factory's own, which is why
 * it is a free name here. See `build.mjs`.
 */

export const React = require("react");
// For one thing only: the material overlay. Everything else in this file
// renders inside the column; a deck cannot, so it is portalled to the body.
export const ReactDOM = require("react-dom");
export const h = React.createElement;
