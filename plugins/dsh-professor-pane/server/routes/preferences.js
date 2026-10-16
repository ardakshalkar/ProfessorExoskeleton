/**
 * Routes: preferences. Moved out of index.js's handler as they were; see
 * server/router.js for the table they join and what `c` carries.
 */

import { readBody, sendJson } from "../http.js";
import { preferencesDocument, writePreferences } from "../preferences.js";

export const routes = [
  {
    paths: ["/api/preferences"],
    handle(c) {
      const { req, res, url, root } = c;
      const course = url.searchParams.get("course") ?? "";
      const term = url.searchParams.get("term") ?? "";

      // A write, and therefore POST only, for `/api/publish`'s reason: a GET
      // that changes a file is one a link, a prefetch or a refresh can fire
      // without anybody having decided to.
      if (req.method === "POST") {
        return readBody(req)
          .then((text) => {
            let body;
            try {
              body = JSON.parse(text || "{}");
            } catch {
              return sendJson(res, 200, { error: "The preferences body is not JSON." });
            }
            const result = writePreferences(
              root,
              String(body.scope ?? ""),
              course,
              term,
              body.values ?? {},
            );
            if (result.error) return sendJson(res, 200, result);
            // The layers as they now are, in the same response. The form is
            // drawn from them, so re-reading here is what makes a Save show
            // the file rather than the browser's memory of it.
            return sendJson(res, 200, {
              ...preferencesDocument(root, course, term),
              saved: result,
            });
          })
          .catch((error) => sendJson(res, 200, { error: String(error?.message ?? error) }));
      }

      return sendJson(res, 200, preferencesDocument(root, course, term));
    },
  },
];
