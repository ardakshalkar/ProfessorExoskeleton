/**
 * Routes: integrations. Moved out of index.js's handler as they were; see
 * server/router.js for the table they join and what `c` carries.
 */

import {
  addConnection,
  canvasWhoAmI,
  connectionNameFor,
  githubWhoAmI,
  moodleWhoAmI,
  spreadsheetIdFrom,
  telegramWhoAmI,
} from "../connections.js";
import { readBody, sendJson } from "../http.js";
import {
  canvasSettings,
  CREDENTIAL_REF,
  credentialRefsIn,
  integrationsAnswer,
  integrationsDocument,
  registryConnections,
  resolveCredential,
} from "../integrations.js";
import { writeRunLmsValue } from "../lms-writes.js";

export const routes = [
  {
    paths: ["/api/integrations"],
    handle(c) {
      const { res, runId, workspace, root, credentials } = c;
      if (!runId) return sendJson(res, 200, { error: "No run chosen." });
      return integrationsAnswer(workspace, root, runId, credentials)
        .then((answer) => sendJson(res, 200, answer))
        .catch((error) => sendJson(res, 200, { error: String(error?.message ?? error) }));
    },
  },
  /**
   * The credential write. POST only, and the only route in this plugin that
   * accepts a secret.
   *
   * Three properties it has to keep, and each is a line below:
   *
   * **It only ever writes.** No GET returns a value, the response is the
   * redrawn document with presence in it, and nothing is logged. A pane that
   * could read a token back would be a pane that shows one on a screen that
   * gets shared.
   *
   * **It writes only variables the registry names.** Anything else would
   * make this a general-purpose secret writer for any environment variable
   * on the machine, reachable from a browser. The registry's `tokenEnv`
   * values are the whole allowed set.
   *
   * **It refuses rather than pretends.** The seam rejects a write under a
   * shadowing read-only layer, and that rejection is passed through with its
   * reason instead of being turned into a success the professor would
   * discover was a lie the next time a push failed.
   */
  {
    paths: ["/api/credentials"],
    handle(c) {
      const { req, res, runId, workspace, root, credentials } = c;
      if (req.method !== "POST") {
        return sendJson(res, 405, { error: "setting a credential is POST only" });
      }
      if (!runId) return sendJson(res, 200, { error: "No run chosen." });
      if (!credentials.service) {
        return sendJson(res, 200, {
          error:
            "No credential provider is mounted in this composition, so there is nowhere " +
            "to save a token. Export it in the environment instead — `ainar connections " +
            "show NAME` prints which variable.",
        });
      }

      return readBody(req)
        .then(async (text) => {
          let body;
          try {
            body = JSON.parse(text || "{}");
          } catch {
            return sendJson(res, 200, { error: "The credential body is not JSON." });
          }

          const ref = String(body.ref ?? "").trim();
          const document = integrationsDocument(workspace, root, runId);
          if (!CREDENTIAL_REF.test(ref) || !credentialRefsIn(document).includes(ref)) {
            return sendJson(res, 200, {
              error:
                `'${ref}' is not a variable any connection in this run names. This route ` +
                "writes only those, so that it cannot be used to set anything else on the machine.",
            });
          }
          // A Google sign-in is made by signing in, not by pasting. A value
          // typed here would be a token Google never issued to this client.
          if (
            document.registry.connections.some(
              (connection) => connection.credential === "oauth" && connection.tokenEnv === ref,
            )
          ) {
            return sendJson(res, 200, {
              error: `${ref} holds a Google sign-in. Use Connect Google or Disconnect instead.`,
            });
          }

          // A value that is only whitespace is a clearing, not a credential.
          // The seam treats an empty stored value as absent everywhere, so
          // writing one would leave a record that reads as unconfigured —
          // removing it says the same thing without the litter.
          const value = String(body.value ?? "");
          try {
            if (value.trim()) await credentials.service.set(ref, value.trim());
            else await credentials.service.unset(ref);
          } catch (error) {
            return sendJson(res, 200, { error: String(error?.message ?? error) });
          }

          // Presence only, never the value.
          return sendJson(
            res,
            200,
            await integrationsAnswer(workspace, root, runId, credentials, {
              saved: { ref, cleared: !value.trim() },
            }),
          );
        })
        .catch((error) => sendJson(res, 200, { error: String(error?.message ?? error) }));
    },
  },
  /**
   * Set an integration up from nothing, or fill in the half that is missing.
   *
   * One route for every provider rather than one each, because the shape is
   * the same for all of them and the differences are three lines apiece:
   * what identifies the destination, where that fact belongs, and what
   * question proves the credential works.
   *
   * The two halves always go to two different places, which is the point of
   * the registry. What identifies the destination is configuration — a host,
   * a channel, a spreadsheet — and lands in the connections registry or the
   * run record. The token is a credential and goes through the seam into the
   * harness's store. Neither lands in this repository.
   *
   * Ordered destination-then-token-then-check, and the order matters. The
   * destination first means a professor who mistypes the token still has the
   * rest recorded and only retries the half that failed. The check last is
   * what lets the answer say "Telegram answered as @course_bot" rather than
   * "saved" — a host with a typo and a token that is fine look identical in
   * a config file and differ the moment something asks.
   */
  {
    paths: ["/api/integrations/setup"],
    handle(c) {
      const { req, res, runId, fail, workspace, root, credentials } = c;
      if (req.method !== "POST") {
        return sendJson(res, 405, { error: "setting an integration up is POST only" });
      }
      if (!runId) return sendJson(res, 200, { error: "No run chosen." });

      return readBody(req)
        .then(async (text) => {
          let body;
          try {
            body = JSON.parse(text || "{}");
          } catch {
            return sendJson(res, 200, { error: "The setup body is not JSON." });
          }

          const provider = String(body.provider ?? "").trim();
          const token = String(body.token ?? "").trim();
          const baseUrl = String(body.baseUrl ?? "").trim();
          const chatId = String(body.chatId ?? "").trim();
          const sheetId = spreadsheetIdFrom(body.sheetId);

          if (!["canvas", "telegram", "moodle", "sheets", "github"].includes(provider)) {
            return sendJson(res, 200, { error: `'${provider}' is not an integration this pane sets up.` });
          }

          // ---- the destination ------------------------------------------
          let connectionName = null;
          if (provider === "github") {
            // GitHub has no address to type: api.github.com, and repositories
            // land under the token's own account. A token is the whole setup,
            // so one is required — a connection with none would only make
            // `ainar` skip the signed-in gh CLI and then fail.
            if (!token) return sendJson(res, 200, { error: "A GitHub token is needed." });
            const existing = registryConnections().connections.find((entry) => entry.type === "github");
            connectionName = existing?.name ?? "github";
            if (!existing) {
              const added = await addConnection(root, { name: connectionName, type: "github", makeDefault: true });
              if (added.error) return sendJson(res, 200, { error: added.error });
            }
          } else if (provider === "sheets") {
            if (sheetId) {
              const written = writeRunLmsValue(workspace, root, runId, "sheet_id", sheetId);
              if (written.error) return sendJson(res, 200, written);
            }
          } else {
            const identifier = provider === "telegram" ? chatId : baseUrl;
            if (!identifier) {
              return sendJson(res, 200, {
                error:
                  provider === "telegram"
                    ? "A channel is needed — the @name the bot posts to, or its numeric id."
                    : `A ${provider} address is needed — the one you open it at.`,
              });
            }
            connectionName =
              provider === "telegram"
                ? `telegram-${chatId.replace(/^@/, "").toLowerCase()}`
                : connectionNameFor(provider, baseUrl);
            const added = await addConnection(root, {
              name: connectionName,
              type: provider,
              baseUrl: provider === "telegram" ? null : baseUrl,
              chatId: provider === "telegram" ? chatId : null,
              // The first of a type is the one every command should reach
              // without being told. A second one has to be named.
              makeDefault: true,
            });
            if (added.error) return sendJson(res, 200, { error: added.error });
          }

          // ---- the credential -------------------------------------------
          const variable = {
            canvas: "AINAR_CANVAS_TOKEN",
            telegram: "AINAR_TELEGRAM_BOT_TOKEN",
            moodle: "AINAR_MOODLE_TOKEN",
            sheets: "AINAR_SHEETS_TOKEN",
            github: "AINAR_GITHUB_TOKEN",
          }[provider];

          if (token) {
            if (!credentials.service) {
              return sendJson(res, 200, {
                error:
                  "The rest was saved, but no credential provider is mounted, so the " +
                  `token could not be. Export ${variable} instead.`,
              });
            }
            try {
              await credentials.service.set(variable, token);
            } catch (error) {
              return sendJson(res, 200, {
                error: `The rest was saved, but the token was not: ${String(error?.message ?? error)}`,
              });
            }
          }

          // ---- the check ------------------------------------------------
          let answered = null;
          let checkFailed = null;
          const live = await resolveCredential(credentials.service, variable);
          const fresh = canvasSettings();
          if (live) {
            try {
              if (provider === "canvas" && fresh.host) {
                answered = await canvasWhoAmI(fresh.host, live);
              } else if (provider === "telegram") {
                answered = await telegramWhoAmI(live);
              } else if (provider === "moodle" && baseUrl) {
                answered = await moodleWhoAmI(baseUrl, live);
              } else if (provider === "github") {
                answered = await githubWhoAmI(live);
              }
              // Sheets is not checked here, deliberately: proving a Google
              // token means reading a spreadsheet, and a green tick that
              // stands for nothing is worse than an honest silence.
            } catch (error) {
              checkFailed = String(error?.message ?? error);
            }
          }

          return sendJson(
            res,
            200,
            await integrationsAnswer(workspace, root, runId, credentials, {
              setup: {
                provider,
                connection: connectionName,
                answered,
                checkFailed,
                tokenSaved: Boolean(token),
                checked: provider !== "sheets",
              },
            }),
          );
        })
        .catch((error) => sendJson(res, 200, { error: String(error?.message ?? error) }));
    },
  },
];
