/**
 * Integrations → Accounts: the services this computer is signed in to, which
 * every course on it uses.
 *
 * It replaces the Credentials view, which listed variables — five environment
 * names, three files, a field per token — and left the professor to work out
 * which of them meant "Canvas works". Here each service is one row saying who
 * it is connected as, with the form to connect or replace it one press away.
 * The variables and files are still here, folded into "Where these are read
 * from" at the foot, because they are the diagnosis when a row says connected
 * and a push still fails.
 *
 * The rules Credentials held are the same, because the same pieces do the
 * work: no value is ever drawn (`Secret` and `ProviderSetup` clear their
 * boxes on every outcome and nothing pre-fills them), a write the credential
 * store refuses is shown under the row that tried it, and with no store
 * mounted the rows still say what is there and name what to export.
 */

import { Fact, GoogleConnect, Presence, ProviderSetup, Secret } from "./integration-parts.js";
import { h, React } from "./react.js";

/** `https://canvas.example.edu/` → `canvas.example.edu`. */
const bareHost = (url) =>
  String(url || "")
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");

/**
 * One account: its mark, who it is connected as, and a chip; pressing the row's
 * button opens what changes it.
 */
function AccountRow(props) {
  return h(
    "div",
    { className: "pp-acct" + (props.connected ? "" : " pp-acct-off") },
    h(
      "div",
      { className: "pp-chead" },
      h("span", { className: "pp-svc pp-svc-" + props.service, "aria-hidden": "true" }, props.mark),
      h(
        "span",
        { className: "pp-cname" },
        props.name,
        h(
          "span",
          { className: "pp-intwhat" },
          // One dot says connected or not; the words beside it say as whom.
          h("span", { className: "pp-dot" + (props.connected ? " pp-dot-on" : ""), title: props.connected ? "Connected" : "Not connected" }),
          props.status,
        ),
      ),
      props.action
        ? h(
            "button",
            { type: "button", className: "pp-segbtn", "aria-pressed": props.open, onClick: props.onToggle },
            props.open ? "Close" : props.action,
          )
        : null,
    ),
    props.open ? h("div", { className: "pp-acctbody" }, props.children) : null,
    props.error ? h("p", { className: "pp-saveerr" }, props.error) : null,
  );
}

export function Accounts(props) {
  const data = props.data;
  const refs = (data.credentials && data.credentials.refs) || {};
  const connections = (data.registry && data.registry.connections) || [];
  const [open, setOpen] = React.useState(null);
  const [errors, setErrors] = React.useState({});
  const toggle = (id) => setOpen(open === id ? null : id);
  const saved = (body) => {
    setErrors({});
    if (props.onSaved) props.onSaved(body);
  };
  const failed = (id) => (next) => setErrors((all) => Object.assign({}, all, { [id]: next && next.error ? next.error : null }));
  const configured = (name) => Boolean(name && refs[name] && refs[name].configured);
  const integration = (id) => (data.integrations || []).find((row) => row.id === id) || { id, fields: [] };
  const ofType = (type) => connections.filter((entry) => entry.type === type);
  // Telegram and Moodle may still be in the older publishing profiles.
  const legacy = (type) => ((data.connections && data.connections.profiles) || []).filter((entry) => entry.type === type);
  const secret = (id, name) =>
    h(Secret, {
      name,
      status: refs[name],
      runId: props.runId,
      sessionId: props.sessionId,
      onSaved: saved,
      onStatus: failed(id),
    });

  // ---- Canvas -----------------------------------------------------------
  const canvas = data.canvas || {};
  const canvasToken = configured(canvas.tokenEnv) || canvas.tokenInEnv;
  const canvasRow = h(
    AccountRow,
    {
      service: "canvas",
      mark: "Cv",
      name: "Canvas",
      key: "canvas",
      connected: Boolean(canvas.host) && canvasToken,
      status: canvas.host
        ? bareHost(canvas.host) + " · " + (canvasToken ? "token saved" : "no token")
        : "no address yet",
      action: canvas.host ? (canvasToken ? "Change" : "Add the token") : "Connect",
      open: open === "canvas",
      onToggle: () => toggle("canvas"),
      error: errors.canvas,
    },
    canvas.host
      ? h(
          React.Fragment,
          null,
          h("p", { className: "pp-as" }, (canvasToken ? "Replace the token" : "Paste a token") + " — Canvas → Account → Settings → New Access Token."),
          secret("canvas", canvas.tokenEnv),
          h("p", { className: "pp-factgroup" }, "Or a different Canvas"),
          h(ProviderSetup, { integration: integration("canvas"), runId: props.runId, sessionId: props.sessionId, onSaved: saved }),
        )
      : h(ProviderSetup, { integration: integration("canvas"), runId: props.runId, sessionId: props.sessionId, onSaved: saved }),
  );

  // ---- Google -----------------------------------------------------------
  const google = data.google || {};
  const googleRow = h(
    AccountRow,
    {
      service: "sheets",
      mark: "G",
      name: "Google",
      key: "google",
      connected: Boolean(google.connected),
      status: google.connected
        ? "signed in as " + (google.account || "your Google account") + " · grade sheets are read directly"
        : "not signed in · grade sheets come in as downloads",
      action: google.connected ? "Change" : "Connect",
      open: open === "google",
      onToggle: () => toggle("google"),
    },
    h(GoogleConnect, { google, bare: true, onChanged: props.onRefresh }),
  );

  // ---- GitHub -----------------------------------------------------------
  const github = data.github || { gh: {} };
  const githubRow = h(
    AccountRow,
    {
      service: "github",
      mark: "GH",
      name: "GitHub",
      key: "github",
      connected: Boolean(github.via),
      status:
        github.via === "token"
          ? "token saved" + (github.owner ? " · repositories under " + github.owner : "")
          : github.via === "gh"
            ? "through the gh CLI, signed in as " + github.gh.account
            : github.gh && github.gh.installed
              ? "the gh CLI is installed but not signed in"
              : "no token, and no gh CLI",
      action: github.via === "token" ? "Change" : github.via === "gh" ? "Use a token" : "Connect",
      open: open === "github",
      onToggle: () => toggle("github"),
    },
    h(
      "p",
      { className: "pp-as" },
      github.via === "gh"
        ? "Homework repositories are pushed as " + github.gh.account + ". A token below takes over from the gh CLI, if you would rather use one."
        : "Either sign the gh CLI in — run gh auth login in a terminal, and this row picks it up — or paste a token. A token is tried first.",
    ),
    github.connection
      ? secret("github", github.tokenEnv)
      : h(ProviderSetup, {
          integration: { id: "github", fields: ["token"] },
          runId: props.runId,
          sessionId: props.sessionId,
          onSaved: saved,
        }),
  );

  // ---- Telegram and Moodle ----------------------------------------------
  const announce = (type, mark, name, describe) => {
    const entry = ofType(type)[0] || legacy(type)[0] || null;
    const token = Boolean(entry) && (configured(entry.tokenEnv) || entry.tokenInEnv || entry.tokenInFile);
    return h(
      AccountRow,
      {
        service: type,
        mark,
        name,
        key: type,
        connected: Boolean(entry) && token,
        status: entry ? describe(entry) + " · " + (token ? "token saved" : "no token") : "not set up",
        action: entry ? "Change" : "Connect",
        open: open === type,
        onToggle: () => toggle(type),
        error: errors[type],
      },
      entry && entry.tokenEnv && !token ? secret(type, entry.tokenEnv) : null,
      h(ProviderSetup, { integration: integration(type), runId: props.runId, sessionId: props.sessionId, onSaved: saved }),
    );
  };
  const telegramRow = announce("telegram", "Tg", "Telegram", (entry) => "posts to " + (entry.chatId || "a channel"));
  const moodleRow = announce("moodle", "Md", "Moodle", (entry) => bareHost(entry.baseUrl) || "a Moodle site");

  // ---- Transcription ----------------------------------------------------
  const voices = ofType("transcription");
  const transcriptionRow = h(
    AccountRow,
    {
      service: "file",
      mark: "Tx",
      name: "Transcription",
      key: "transcription",
      connected: voices.some((entry) => configured(entry.tokenEnv) || entry.tokenInEnv),
      status: voices.length
        ? voices
            .map(
              (entry) =>
                entry.name +
                " · " +
                [entry.provider, entry.model].filter(Boolean).join(" ") +
                (entry.pricePerMinute === null ? "" : " · $" + entry.pricePerMinute + "/min") +
                (configured(entry.tokenEnv) || entry.tokenInEnv ? "" : " · no token"),
            )
            .join("; ")
        : "not set up · the defence desk records answers without transcribing them",
      action: voices.length ? "Change" : "How to connect",
      open: open === "transcription",
      onToggle: () => toggle("transcription"),
      error: errors.transcription,
    },
    voices.map((entry) => h("div", { key: entry.name }, secret("transcription", entry.tokenEnv))),
    h(
      "p",
      { className: "pp-as" },
      "A transcription service is added with ainar connections add NAME --type transcription --provider openai|elevenlabs --model M " +
        "--price-per-minute USD; its token is then pasted here.",
    ),
  );

  // ---- everything else the registry names -------------------------------
  const covered = new Set(
    [
      canvas.tokenEnv,
      google.tokenEnv,
      github.tokenEnv,
      ...connections.filter((entry) => ["telegram", "moodle", "transcription"].includes(entry.type)).map((entry) => entry.tokenEnv),
    ].filter(Boolean),
  );
  const others = Object.keys(refs)
    .filter((name) => !covered.has(name) && refs[name] && (refs[name].configured || connections.some((entry) => entry.tokenEnv === name)))
    .sort();

  return h(
    "div",
    { className: "pp-scroll pp-course" },
    h(
      "p",
      { className: "pp-as" },
      "On this computer, for every course on it. A token goes to the credential store and is never shown again — " +
        "this screen gets projected.",
    ),
    data.credentials && data.credentials.available
      ? null
      : h(
          "p",
          { className: "pp-saveerr" },
          "No credential store is mounted, so a token cannot be saved from here. Each row names the variable to export instead.",
        ),
    // Connected first, in their own order; then the rest, under a label, so
    // the services this computer actually uses are the top of the list.
    (() => {
      const all = [canvasRow, googleRow, githubRow, telegramRow, moodleRow, transcriptionRow];
      const on = all.filter((row) => row.props.connected);
      const off = all.filter((row) => !row.props.connected);
      return h(
        React.Fragment,
        null,
        on.length ? h("div", { className: "pp-accts" }, on) : null,
        off.length ? h("p", { className: "pp-factgroup" }, on.length ? "Not connected" : "Nothing connected yet") : null,
        off.length ? h("div", { className: "pp-accts" }, off) : null,
      );
    })(),
    data.setup && data.setup.answered
      ? h("p", { className: "pp-ok" }, data.setup.provider + " answered as " + data.setup.answered + ".")
      : null,
    data.setup && data.setup.checkFailed ? h("p", { className: "pp-saveerr" }, data.setup.checkFailed) : null,
    h(
      "details",
      { className: "pp-cdetails" },
      h("summary", null, "Where these are read from"),
      others.length
        ? h(
            React.Fragment,
            null,
            h("p", { className: "pp-factgroup" }, "Other credentials"),
            others.map((name) => h("div", { key: name }, secret("other", name))),
            errors.other ? h("p", { className: "pp-saveerr" }, errors.other) : null,
          )
        : null,
      h("p", { className: "pp-factgroup" }, "Environment"),
      (data.environment || []).map((variable) =>
        h(Fact, { label: variable.name, note: variable.what, key: variable.name }, h(Presence, { present: variable.present })),
      ),
      h("p", { className: "pp-factgroup" }, "Files"),
      h(
        Fact,
        {
          label: "connections.json",
          note: data.registry.error || data.registry.path + " — the shared registry, ainar connections",
          missing: !data.registry.present || Boolean(data.registry.error),
        },
        data.registry.present
          ? data.registry.error
            ? "unreadable"
            : connections.length + " connection" + (connections.length === 1 ? "" : "s")
          : h(Presence, { present: false, no: "not migrated yet" }),
      ),
      h(
        Fact,
        { label: "lms.toml", note: canvas.configPath, missing: !canvas.host && !canvas.tokenInFile },
        canvas.tokenInFile
          ? h(Presence, { present: true, yes: "host and token" })
          : canvas.host && canvas.hostFrom !== "AINAR_CANVAS_URL"
            ? h(Presence, { present: true, yes: "host only" })
            : h(Presence, { present: false, no: "nothing read" }),
      ),
      h(
        Fact,
        {
          label: "profiles (legacy)",
          note: data.connections.error || data.connections.path,
          missing: !data.connections.present || Boolean(data.connections.error),
        },
        data.connections.present
          ? data.connections.error
            ? "unreadable"
            : data.connections.profiles.length + " profile" + (data.connections.profiles.length === 1 ? "" : "s")
          : h(Presence, { present: false, no: "no file" }),
      ),
      h(
        Fact,
        {
          label: "people.json",
          note: data.roster.path + " — the identity store, outside the repository. The course record holds pseudonyms; the real names are only here",
          missing: !data.roster.present,
        },
        data.roster.present
          ? data.roster.count === null
            ? "unreadable"
            : data.roster.count + " known"
          : h(Presence, { present: false, no: "no roster" }),
      ),
    ),
    // Said outside the fold: a token in a file is a problem to act on, not a
    // fact to look up.
    connections.some((connection) => connection.tokenInFile)
      ? h(
          "p",
          { className: "pp-saveerr" },
          "A connection in the registry holds a literal token, which that file is not supposed to contain at all. " +
            "Revoke it at the provider, paste a fresh one into its row above, and delete the line.",
        )
      : null,
    data.connections.profiles.some((profile) => profile.tokenInFile)
      ? h(
          "p",
          { className: "pp-saveerr" },
          "A legacy profile holds a literal token. It still works, but a token in a file that gets backed up and synced " +
            "should be treated as exposed: ainar connections migrate says what to do about it, and does not copy the token forward.",
        )
      : null,
  );
}
