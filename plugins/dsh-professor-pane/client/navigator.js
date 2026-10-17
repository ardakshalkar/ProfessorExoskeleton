/**
 * The left sidebar as the course navigator.
 *
 * WHICH SEAT THIS IS, AND WHAT IT DISPLACES
 * -----------------------------------------
 * `sidebar.workspaces` is the region between the New Session button and the
 * Settings row. `ui-workspace` fills it with its WorkspaceBrowser — every
 * registered folder, each with its sessions — at the default priority 0. It is
 * a `single` slot, so this registers at -1 and shadows it, the mechanism
 * `dsh-professor-brand` uses for the mark and `ProfessorPane` for `details`.
 *
 * The browser is not gone: it stays registered, and *Folders and search* at the
 * foot of this region withdraws the navigator so it renders again — search,
 * rename, archive, drag to reorder, add a folder, all of it. A button in the
 * sidebar's footer brings the navigator back. The choice is remembered in the
 * browser, because it is a reading preference and not a fact about the course.
 *
 * Why not draw the browser inside this component: it is composed from its own
 * private store, its locale namespace and its own directory-flow hole, and none
 * of those reach another registrant's props. Rendering it here would mean
 * re-creating its internals; handing the seat back is one disposer.
 *
 * WHAT IT DRAWS
 * -------------
 * The course the current chat stands in, this week, the course's places, and
 * the chats in this course only. The places open in course mode over the
 * centre — the pane owns course mode, so a press here is a request it answers
 * (`requestPlace`), and the pane takes it whether it is mounted already or
 * mounts a moment later.
 *
 * Every figure is one `/api/navigator` carried; this file prints them.
 */

import { h, React } from "./react.js";
import { BASE, PLACE_SHOWN_EVENT, scoped } from "./tabs.js";
import { AREAS, useVersion, useWorkspaceWatch } from "./data.js";

// ------------------------------------------------------------- the request

/** The window event a place press is announced on; `ProfessorPane` listens. */
export const PLACE_EVENT = "professor-pane:place";

/** How long a press waits for a pane that has not mounted yet. */
const PENDING_MS = 4000;

let pendingPlace = null;
let placeCount = 0;

/**
 * Ask the pane to open a place: `{ mode }` for a reading of the weeks,
 * `{ view }` for a course-wide view, `{ tab }` for a tab in the right column.
 *
 * Kept as well as announced. The pane is session-scoped and the details
 * column can be closed, so the press may land while no pane is listening; the
 * pane takes a fresh pending request when it mounts.
 */
function requestPlace(request) {
  placeCount += 1;
  pendingPlace = { ...request, n: placeCount, at: Date.now() };
  window.dispatchEvent(new CustomEvent(PLACE_EVENT, { detail: pendingPlace }));
}

/**
 * Keep a place for the pane of the chat about to open, without announcing it.
 *
 * The pane is session-scoped: opening another chat gives it a new session,
 * and the place open beside the old chat would be gone. Announced, the pane
 * still on the old chat would take the request and clear it; kept quiet, the
 * pane takes it as its session changes (`takePendingPlace`).
 */
function carryPlace(request) {
  placeCount += 1;
  pendingPlace = { ...request, n: placeCount, at: Date.now() };
}

/** The request no pane has answered yet, if it is still fresh; taking it clears it. */
export function takePendingPlace() {
  const found = pendingPlace;
  pendingPlace = null;
  return found !== null && Date.now() - found.at < PENDING_MS ? found : null;
}

// ------------------------------------------------------------------ icons

/** A 16px stroke icon in the sidebar's ink; `d` is one or more path strings. */
function Icon(props) {
  const size = props.size || 16;
  return h(
    "svg",
    {
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 1.75,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true",
    },
    [].concat(props.d).map((d, index) => h("path", { d: d, key: index })),
  );
}

const ICONS = {
  weeks: ["M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v12a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5z", "M4 10h16", "M8 3v4", "M16 3v4"],
  tasks: ["M9 6h11", "M9 12h11", "M9 18h11", "M4 6l1 1 2-2", "M4 12l1 1 2-2", "M4 18l1 1 2-2"],
  students: ["M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z", "M3 20a6 6 0 0 1 12 0", "M16 4.5a3.5 3.5 0 0 1 0 6.5", "M18 14.5a6 6 0 0 1 3 5.5"],
  gradebook: ["M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5z", "M4 10h16", "M4 15h16", "M10 4v16"],
  concepts: ["M12 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6z", "M5 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6z", "M19 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6z", "M10.5 8.5l-4 7", "M13.5 8.5l4 7"],
  materials: ["M7 3.5h7l4 4v12a1.5 1.5 0 0 1-1.5 1.5h-9.5A1.5 1.5 0 0 1 5.5 19.5v-14.5A1.5 1.5 0 0 1 7 3.5z", "M14 3.5v4h4", "M9 13h6", "M9 17h6"],
  settings: ["M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z", "M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"],
  files: ["M4 7.5A1.5 1.5 0 0 1 5.5 6H10l2 2h6.5A1.5 1.5 0 0 1 20 9.5v8a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z"],
  plug: ["M9 7V3", "M15 7V3", "M7 7h10v4a5 5 0 0 1-10 0z", "M12 16v5"],
  folders: ["M4 7.5A1.5 1.5 0 0 1 5.5 6H10l2 2h6.5A1.5 1.5 0 0 1 20 9.5v8a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z", "M10.5 14.5a2 2 0 1 0 0-.01", "M12 15.5l2 2"],
  plus: ["M12 5v14", "M5 12h14"],
  chevron: ["M8 10l4 4 4-4"],
  course: ["M12 4l9 4-9 4-9-4z", "M7 10v5c0 1.5 2.5 3 5 3s5-1.5 5-3v-5"],
};

/**
 * The course's places, in the order a professor reaches for them.
 *
 * Weeks opens on Planning because that is where the gaps it counts are drawn;
 * Teaching is what *This week* opens. The rest are course mode's own views.
 */
const PLACES = [
  { id: "weeks", label: "Weeks", hint: "The term, week by week — what is planned and what is missing", request: { mode: "planning" } },
  { id: "tasks", label: "Tasks", hint: "What is waiting for you, what is ready, what has not gone out", request: { view: "tasks" } },
  { id: "students", label: "Students", hint: "The class list, by subgroup", request: { view: "students" } },
  { id: "gradebook", label: "Gradebook", hint: "Every mark by assessment", request: { view: "gradebook" } },
  { id: "concepts", label: "Concepts", hint: "The class, by concept", request: { view: "concepts" } },
  { id: "materials", label: "Materials", hint: "Assessments, slides, exams, the grading policy, the student's outline", request: { view: "materials" } },
  { id: "files", label: "Files", hint: "Scans and recordings: where they are, each pile", request: { view: "files" } },
];

/** The foot's place: opened twice a term, so kept out of the list above. */
const SETTINGS = { id: "settings", label: "Course settings", hint: "Integrations — Canvas, the grade sheet, GitHub — and the preferences the skills assume", request: { view: "settings" } };

/**
 * Which place course mode is showing, from its announcement; null while it is
 * closed. Weeks is current under any reading of the weeks (`view` null).
 */
function useShownPlace() {
  const [shown, setShown] = React.useState(null);
  React.useEffect(() => {
    const onShown = (event) => setShown(event.detail || null);
    window.addEventListener(PLACE_SHOWN_EVENT, onShown);
    return () => window.removeEventListener(PLACE_SHOWN_EVENT, onShown);
  }, []);
  return shown;
}

const isShown = (shown, entry) =>
  shown !== null && (entry.request.view ? shown.view === entry.request.view : shown.view === null);

// ---------------------------------------------------------------- reading

/** The chats a person would see: no subagents, no archived, no stale blanks. */
const visibleSession = (session, current, archived) =>
  session !== undefined &&
  session.origin !== "subagent" &&
  !archived.has(session.id) &&
  (!session.blank || session.id === current);

/** "now", "5m", "3h", "2d", "3w" — the stock list's buckets, in English. */
export const ago = (updatedAt, now) => {
  const minutes = Math.floor((now - updatedAt) / 60000);
  if (!Number.isFinite(minutes) || minutes < 1) return "now";
  if (minutes < 60) return minutes + "m";
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + "h";
  const days = Math.floor(hours / 24);
  return days < 14 ? days + "d" : Math.floor(days / 7) + "w";
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** `2026-10-20` as "Tue 20 Oct", read as a calendar date with no time zone. */
const navDate = (iso) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return DAYS[date.getDay()] + " " + date.getDate() + " " + MONTHS[date.getMonth()];
};

/** The short words before an assessment title: "HW4 - Three routes…" → "HW4". */
const shortTitle = (title) => {
  const text = String(title || "");
  const cut = text.split(/\s[-–—:]\s/)[0];
  return cut.length <= 28 ? cut : text.slice(0, 28) + "…";
};

const capital = (word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : "");

/** The workspace remembered between page loads, read and written defensively. */
const REMEMBERED = "professor-pane:navigator-workspace";
const remembered = () => {
  try {
    return window.localStorage.getItem(REMEMBERED);
  } catch {
    return null;
  }
};
const remember = (workspaceId) => {
  try {
    window.localStorage.setItem(REMEMBERED, workspaceId);
  } catch {
    // A private window: the navigator still works, it just forgets.
  }
};

/**
 * The navigator's payload, with the last answer kept while the next loads —
 * the sidebar is on every screen, and blanking it on each revision would
 * flicker the whole left edge of the app.
 */
function useNavigatorData(sessionId) {
  // The pane's own watcher when the pane is open (client/data.js shares one
  // per session); its own while the navigator is the only thing showing.
  useWorkspaceWatch(sessionId);
  const revision = useVersion(AREAS.everything);
  const [state, setState] = React.useState({ sessionId: null, value: null });
  React.useEffect(() => {
    if (!sessionId) return undefined;
    let live = true;
    fetch(scoped(BASE + "/api/navigator", sessionId) + "&r=" + revision, { headers: { accept: "application/json" } })
      .then((response) => response.json())
      .then((value) => {
        if (live) setState({ sessionId: sessionId, value: value });
      })
      .catch((error) => {
        if (live) setState({ sessionId: sessionId, value: { error: String(error.message || error) } });
      });
    return () => {
      live = false;
    };
  }, [sessionId, revision]);
  return state.value;
}

// ------------------------------------------------------------------ parts

function Row(props) {
  return h(
    "button",
    {
      type: "button",
      className: "pp-nav-row",
      title: props.hint,
      "aria-current": props.current ? "true" : undefined,
      onClick: props.onClick,
    },
    props.icon ? h(Icon, { d: ICONS[props.icon] }) : null,
    props.dot ? h("span", { className: "pp-nav-dot", title: "Working" }) : null,
    h("span", { className: "pp-nav-text" }, props.label),
    props.badge ? h("span", { className: "pp-nav-badge", title: props.badgeHint }, props.badge) : null,
    props.meta ? h("span", { className: "pp-nav-meta" }, props.meta) : null,
  );
}

/** The course block, and the menu of the other workspaces under it. */
function CourseBlock(props) {
  const [open, setOpen] = React.useState(false);
  const run = props.run;
  const weekText = run && run.current_week ? "week " + run.current_week + " of " + run.weeks : null;
  const sub = run ? [run.course_id, run.term, weekText].filter(Boolean).join(" · ") : props.subtitle;
  return h(
    "div",
    { style: { position: "relative" } },
    h(
      "button",
      {
        type: "button",
        className: "pp-nav-course",
        "aria-haspopup": "menu",
        "aria-expanded": open,
        title: "Switch course",
        onClick: () => setOpen((value) => !value),
      },
      h(
        "span",
        { className: "pp-nav-coursetitle" },
        h("span", null, run ? run.title : props.fallbackTitle),
        h(Icon, { d: ICONS.chevron, size: 14 }),
      ),
      sub ? h("span", { className: "pp-nav-coursesub" }, sub) : null,
      run && run.current_week && run.weeks
        ? h(
            "span",
            { className: "pp-nav-bar", "aria-hidden": "true" },
            h("i", { style: { width: Math.min(100, Math.round((run.current_week / run.weeks) * 100)) + "%" } }),
          )
        : null,
    ),
    open
      ? h(
          "div",
          { className: "pp-nav-menu", role: "menu", onMouseLeave: () => setOpen(false) },
          props.workspaces.map((workspace) =>
            h(Row, {
              key: workspace.workspaceId,
              icon: "course",
              label: workspace.title || workspace.path,
              current: workspace.workspaceId === props.workspaceId,
              hint: workspace.path,
              onClick: () => {
                setOpen(false);
                props.onPick(workspace.workspaceId);
              },
            }),
          ),
        )
      : null,
  );
}

/** This week: its meetings and what falls due, or when the next thing does. */
function ThisWeek(props) {
  const week = props.week;
  const open = () => requestPlace({ mode: "teaching", run: props.runId });
  if (!week) return null;
  const lines = [];
  for (const meeting of week.meetings) {
    lines.push(
      h(
        "button",
        { type: "button", className: "pp-nav-row pp-nav-line", key: "m" + lines.length, onClick: open, title: meeting.title },
        h("span", { className: "pp-nav-text" }, capital(meeting.type) + " · " + meeting.title),
        meeting.deck ? null : h("span", { className: "pp-nav-badge" }, "no deck"),
        h("span", { className: "pp-nav-meta" }, navDate(meeting.on) || "no date"),
      ),
    );
  }
  for (const work of week.due) {
    lines.push(
      h(
        "button",
        { type: "button", className: "pp-nav-row pp-nav-line", key: "d" + lines.length, onClick: open, title: work.title },
        h("span", { className: "pp-nav-text" }, shortTitle(work.title) + " due"),
        h("span", { className: "pp-nav-meta" }, navDate(work.due_on) || "no date"),
      ),
    );
  }
  if (!week.due.length && props.nextDue) {
    lines.push(h("div", { className: "pp-nav-quiet", key: "next" }, "Nothing due · next in week " + props.nextDue.week));
    for (const work of props.nextDue.due.slice(0, 3)) {
      lines.push(
        h(
          "button",
          { type: "button", className: "pp-nav-row pp-nav-line", key: "n" + lines.length, onClick: open, title: work.title },
          h("span", { className: "pp-nav-text" }, shortTitle(work.title)),
          h("span", { className: "pp-nav-meta" }, navDate(work.due_on) || "no date"),
        ),
      );
    }
  }
  return h(
    React.Fragment,
    null,
    h(
      "div",
      { className: "pp-nav-label" },
      h("span", null, "This week" + (week.modules.length ? " · " + week.modules[0] : "")),
    ),
    h("div", { className: "pp-nav-week" }, lines.length ? lines : h("div", { className: "pp-nav-quiet" }, "Nothing scheduled")),
  );
}

/** The chats in this course, newest first, six until asked for all. */
function Chats(props) {
  const [all, setAll] = React.useState(false);
  const now = Date.now();
  const shown = all ? props.sessions : props.sessions.slice(0, 6);
  return h(
    React.Fragment,
    null,
    h(
      "div",
      { className: "pp-nav-label" },
      h("span", null, "Chats"),
      h(
        "button",
        { type: "button", className: "pp-nav-icon", title: "New chat in this course", "aria-label": "New chat in this course", onClick: props.onNew },
        h(Icon, { d: ICONS.plus, size: 14 }),
      ),
    ),
    shown.map((session) =>
      h(Row, {
        key: session.id,
        label: session.blank ? "New chat" : session.displayTitle,
        hint: session.blank ? "New chat" : session.displayTitle,
        current: session.id === props.current,
        dot: session.running,
        meta: session.blank ? null : ago(session.updatedAt, now),
        onClick: () => props.onOpen(session.id),
      }),
    ),
    props.sessions.length > shown.length
      ? h(Row, { label: "All " + props.sessions.length + " chats", onClick: () => setAll(true) })
      : null,
    !props.sessions.length ? h("div", { className: "pp-nav-quiet" }, "No chats in this course yet") : null,
  );
}

// -------------------------------------------------------------- the region

/**
 * The region: wide in the open sidebar, a rail of icons when it is collapsed.
 *
 * `useSessions` and `useWorkspaces` are the framework's own selector hooks,
 * the same ones the stock browser reads; the actions arrive through this
 * registration's `inject`.
 */
export function CourseNavigator(props) {
  const list = props.useSessions((state) => state);
  const workspaces = props.useWorkspaces((state) => state.items) || [];
  const archivedIds = props.useWorkspaces((state) => state.archivedSessionIds);
  const archived = React.useMemo(() => new Set(archivedIds || []), [archivedIds]);
  const current = list.current;

  // The course is the one the open chat stands in; with no chat open, the one
  // last looked at; failing that, the first folder registered.
  const holding = current === undefined ? undefined : workspaces.find((workspace) => workspace.sessionIds.includes(current));
  const workspace =
    holding ||
    workspaces.find((entry) => entry.workspaceId === remembered()) ||
    workspaces[0] ||
    null;
  React.useEffect(() => {
    if (workspace) remember(workspace.workspaceId);
  }, [workspace ? workspace.workspaceId : null]);

  // Any session of the workspace will do for the server: it only turns the id
  // into the folder. The open one when it is here, so a chat switch refetches.
  const sessionId = workspace
    ? holding
      ? current
      : workspace.sessionIds.find((id) => list.byId[id] !== undefined) || null
    : null;
  const data = useNavigatorData(sessionId);
  const shown = useShownPlace();
  const run = data && !data.error ? data.run : null;

  const sessions = React.useMemo(() => {
    if (!workspace) return [];
    return workspace.sessionIds
      .map((id) => list.byId[id])
      .filter((session) => visibleSession(session, current, archived))
      .sort((a, b) => (b.updatedAt !== a.updatedAt ? b.updatedAt - a.updatedAt : a.id < b.id ? -1 : 1));
  }, [workspace, list, current, archived]);

  const pick = (workspaceId) => {
    remember(workspaceId);
    props.startSession(workspaceId);
  };
  const place = (request) => {
    // A place opens over the conversation of THIS course: with no chat of it
    // open, there is no pane on it to open course mode in, so start one.
    if (!holding && workspace) props.startSession(workspace.workspaceId);
    requestPlace({ ...request, run: run ? run.run_id : null });
  };
  // Another chat, with a place open: the place stays. An existing chat comes
  // in beside it, since it has turns to read; a new one has nothing to show
  // yet, so the place keeps the width and its composer takes the first
  // message (`compose`) — the chat comes in beside once there is a turn.
  const carry = (fresh) => {
    if (shown === null) return;
    carryPlace({ mode: shown.mode, view: shown.view, chat: !fresh, compose: Boolean(fresh), run: run ? run.run_id : null });
  };
  const openChat = (sessionId) => {
    if (sessionId !== current) carry(false);
    props.open(sessionId);
  };
  const newChat = () => {
    if (!workspace) return;
    carry(true);
    props.startSession(workspace.workspaceId);
  };
  const pending = data && data.grading ? data.grading.pending : 0;
  const gaps = data && !data.error ? data.gaps : 0;
  const badgeOf = (id) =>
    id === "weeks" && gaps
      ? { badge: gaps + (gaps === 1 ? " gap" : " gaps"), hint: gaps + " weeks have something missing" }
      : id === "tasks" && pending
        ? { badge: String(pending), hint: pending + " suggested marks wait for your decision" }
        : { badge: null, hint: null };

  if (!props.wide) {
    return h(
      "div",
      { className: "pp-nav-rail" },
      h(
        "button",
        { type: "button", className: "pp-nav-mono", title: run ? run.title : "Courses", onClick: props.expandSidebar },
        run ? run.course_id.replace(/[^A-Z]/g, "").slice(0, 3) || "C" : "C",
      ),
      PLACES.map((entry) =>
        h(
          "button",
          {
            type: "button",
            key: entry.id,
            className: "pp-nav-icon",
            title: entry.label,
            "aria-label": entry.label,
            "aria-current": isShown(shown, entry) ? "true" : undefined,
            onClick: () => place(entry.request),
          },
          h(Icon, { d: ICONS[entry.id], size: 18 }),
          badgeOf(entry.id).badge ? h("span", { className: "pp-nav-pip", "aria-hidden": "true" }) : null,
        ),
      ),
      h(
        "button",
        {
          type: "button",
          className: "pp-nav-icon",
          title: "New chat in this course",
          "aria-label": "New chat in this course",
          onClick: newChat,
        },
        h(Icon, { d: ICONS.plus, size: 18 }),
      ),
    );
  }

  const notCourse = data && data.error ? data.error : null;
  return h(
    "div",
    { className: "pp-nav" },
    h(
      "div",
      { className: "pp-nav-scroll" },
      workspaces.length
        ? h(CourseBlock, {
            run: run,
            workspaces: workspaces,
            workspaceId: workspace ? workspace.workspaceId : null,
            fallbackTitle: workspace ? workspace.title || workspace.path : "Courses",
            subtitle: notCourse
              ? "Not a course folder"
              : data
                ? data.run
                  ? null
                  : "No course run in this folder yet"
                : "Reading the course…",
            onPick: pick,
          })
        : h("div", { className: "pp-nav-quiet" }, "Add a course folder with Folders and search, below."),
      run ? h(ThisWeek, { week: data.week, nextDue: data.next_due, runId: run.run_id }) : null,
      run ? h("div", { className: "pp-nav-label" }, h("span", null, "Course")) : null,
      run
        ? PLACES.map((entry) => {
            const badge = badgeOf(entry.id);
            return h(Row, {
              key: entry.id,
              icon: entry.id,
              label: entry.label,
              hint: entry.hint,
              current: isShown(shown, entry),
              badge: badge.badge,
              badgeHint: badge.hint,
              onClick: () => place(entry.request),
            });
          })
        : null,
      workspace
        ? h(Chats, {
            sessions: sessions,
            current: current,
            onOpen: openChat,
            onNew: newChat,
          })
        : null,
    ),
    h(
      "div",
      { className: "pp-nav-foot" },
      run
        ? h(Row, {
            icon: SETTINGS.id,
            label: SETTINGS.label,
            hint: SETTINGS.hint,
            current: isShown(shown, SETTINGS),
            onClick: () => place(SETTINGS.request),
          })
        : null,
      h(Row, {
        icon: "folders",
        label: "Folders and search",
        hint: "The harness's own list: every folder, search, rename, archive",
        onClick: props.showStock,
      }),
    ),
  );
}

/**
 * The way back, in the sidebar's footer while the stock browser has the seat.
 * Rendered only then: `main.js` registers it when it hands the seat back.
 */
export function NavigatorReturn(props) {
  return h(
    "button",
    {
      type: "button",
      className: props.wide ? "pp-nav-row" : "pp-nav-icon",
      title: "Back to the course navigator",
      "aria-label": "Course view",
      onClick: props.showNavigator,
    },
    h(Icon, { d: ICONS.course, size: props.wide ? 16 : 18 }),
    props.wide ? h("span", { className: "pp-nav-text" }, "Course view") : null,
  );
}
