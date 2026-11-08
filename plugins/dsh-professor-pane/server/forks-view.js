/**
 * Students · Forks: a homework's forks for the whole class — whose each one
 * is, how many commits the student added, and when.
 *
 * Reads only what is on disk: `forks.json` and `fork-activity.json` beside
 * the submissions (ainar-node/src/forks.ts, fork-activity.ts), the run's
 * submissions and the roster store's recorded accounts. Opening the page never
 * reaches GitHub; *Analyze forks* does, as a background job
 * (`homework-forks`, server/job-kinds.js), and the page redraws when it ends.
 *
 * Who is whose is `studentsByLogin`, the same match the Students list uses: a
 * recorded account first, then the links students handed in, and an account
 * two students share is nobody's. *Match* records an account for a student in
 * the roster store (`matchAccount`), so it holds for every later homework.
 * The page only suggests — a login that looks like a name — and never records
 * on its own.
 *
 * The weeks count from the homework's `opens_at`. Without one, the page counts
 * from the term's start and asks for the date rather than deriving it.
 */

import { assessmentsOf, enrolledIn, runById } from "@ainar/core/src/bundle.ts";
import { activityPath, readActivity, weekOf, weekly } from "@ainar/core/src/fork-activity.ts";
import { forksPath, githubLogin, readForks, recordedLogins, studentsByLogin } from "@ainar/core/src/forks.ts";
import { recordedRepo } from "@ainar/core/src/homework.ts";
import { RosterStore } from "@ainar/core/src/roster.ts";
import { submissionsDir } from "@ainar/core/src/scans.ts";

import { escapeAttribute, escapeText } from "./markdown.js";
import { documentPage, stamp } from "./page.js";
import { loadedRun, rosterPeople } from "./workspace.js";

const WEEK = 7 * 24 * 60 * 60 * 1000;
/** No homework runs half a year; a strip past this is unreadable anyway. */
const MOST_WEEKS = 20;

/**
 * Record (or with `login` null, clear) the GitHub account of one student in
 * the roster store, as `ainar roster github` does. `{ ok, output }`, or
 * `{ error }` for an account GitHub would not accept or a student the store
 * does not hold.
 */
export const matchAccount = (directory, studentId, login) => {
  const store = RosterStore.load(directory);
  const person = store.whois(studentId);
  if (person === null) return { error: `${studentId} is not in the local roster, so an account cannot be kept for them.` };
  if (login === null) {
    if (person.github) {
      delete person.github;
      store.save();
    }
    return { ok: true, output: `${studentId} github —` };
  }
  const clean = githubLogin(login);
  if (!clean) return { error: `"${login}" is not a GitHub account.` };
  const taken = Object.entries(store.people).filter(
    ([other, entry]) => other !== studentId && typeof entry.github === "string" && entry.github.toLowerCase() === clean.toLowerCase(),
  );
  person.github = clean;
  store.save();
  return {
    ok: true,
    output: `${studentId} github ${clean}`,
    note: taken.length
      ? `${taken.map(([other]) => other).join(", ")} has the same account recorded; until one is corrected, its forks are offered to neither.`
      : null,
  };
};

/**
 * Several accounts at once, in one save: `{ ok, matched: [{ student, login }],
 * refused: [{ student, login, error }], note }`. Each pair is checked as
 * `matchAccount` checks one; a refused pair does not stop the others.
 */
export const matchAccounts = (directory, pairs) => {
  const store = RosterStore.load(directory);
  const matched = [];
  const refused = [];
  for (const pair of pairs) {
    const student = String(pair?.student ?? "");
    const login = githubLogin(String(pair?.login ?? ""));
    const person = /^STUDENT-[A-Z0-9][A-Z0-9-]*$/.test(student) ? store.whois(student) : null;
    if (!person) refused.push({ student, login: pair?.login ?? null, error: `${student} is not in the local roster` });
    else if (!login) refused.push({ student, login: pair?.login ?? null, error: `"${pair?.login}" is not a GitHub account` });
    else {
      person.github = login;
      matched.push({ student, login });
    }
  }
  if (matched.length) store.save();
  // An account now recorded for two students is offered to neither.
  const holders = new Map();
  for (const [student, person] of Object.entries(store.people)) {
    if (typeof person.github !== "string") continue;
    const key = person.github.toLowerCase();
    holders.set(key, [...(holders.get(key) ?? []), student]);
  }
  const doubled = matched.filter((pair) => (holders.get(pair.login.toLowerCase()) ?? []).length > 1);
  return {
    ok: matched.length > 0,
    matched,
    refused,
    error: matched.length ? null : refused[0]?.error ?? "Nothing matched.",
    note: doubled.length
      ? doubled.map((pair) => `${pair.login} is now recorded for ${holders.get(pair.login.toLowerCase()).join(" and ")}`).join("; ") +
        " — until one is corrected, its forks are offered to neither."
      : null,
  };
};

/** Cyrillic to Latin, enough to see "Аружан" in `aruzhan-dev`. */
const LATIN = {
  а: "a", ә: "a", б: "b", в: "v", г: "g", ғ: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "i", к: "k",
  қ: "k", л: "l", м: "m", н: "n", ң: "n", о: "o", ө: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ұ: "u", ү: "u",
  ф: "f", х: "kh", һ: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sh", ъ: "", ы: "y", і: "i", ь: "", э: "e", ю: "yu", я: "ya",
};
const latin = (text) => [...text.toLowerCase()].map((ch) => LATIN[ch] ?? ch).join("");

/** The name's parts a login might carry: four letters or more, in Latin. */
const nameTokens = (name) =>
  typeof name === "string"
    ? latin(name)
        .split(/[^a-z]+/)
        .filter((token) => token.length >= 4)
    : [];

const looksLike = (login, tokens) => {
  const bare = login.toLowerCase().replace(/[^a-z]/g, "");
  return tokens.some((token) => bare.includes(token) || (bare.length >= 4 && token.includes(bare)));
};

const ago = (iso, now) => {
  if (!iso) return "never";
  const minutes = Math.round((now - Date.parse(iso)) / 60000);
  if (!Number.isFinite(minutes)) return String(iso).slice(0, 10);
  if (minutes < 2) return "just now";
  if (minutes < 60) return minutes + " min ago";
  const hours = Math.round(minutes / 60);
  if (hours < 36) return hours + " h ago";
  return Math.round(hours / 24) + " d ago";
};

const day = (iso) => {
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? "" : at.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

export const forksDocument = (workspace, root, runId, assessmentId, dark, withNames, runningOn = () => null, now = Date.now()) => {
  const { bundle } = loadedRun(workspace, runId);
  const run = runById(bundle).get(runId) ?? {};
  const homeworks = assessmentsOf(bundle, runId)
    .filter((entry) => recordedRepo(entry))
    .sort((a, b) => String(a.opens_at ?? a.due_at ?? "").localeCompare(String(b.opens_at ?? b.due_at ?? "")));

  if (!homeworks.length) {
    return documentPage(
      "<section><h2>Forks</h2><p class=\"empty\">No homework in this run has a starter repository yet. " +
        "Publishing one (<b>Publish</b> on the homework, or <code>ainar homework publish</code>) records it, " +
        "and students then fork it.</p></section>",
      dark,
    );
  }

  // The one asked for; else the latest that has opened; else the first.
  const opened = homeworks.filter((entry) => entry.opens_at && Date.parse(entry.opens_at) <= now);
  const chosen =
    homeworks.find((entry) => entry.assessment_id === assessmentId) ?? opened[opened.length - 1] ?? homeworks[0];
  const id = chosen.assessment_id;
  const repo = recordedRepo(chosen);
  const title = chosen.title || id;

  const base = submissionsDir(null);
  const listing = readForks(forksPath(base, runId, id));
  const activity = readActivity(activityPath(base, runId, id));

  const runAssessments = new Set(assessmentsOf(bundle, runId).map((entry) => entry.assessment_id));
  const submissions = bundle.submissions.filter((entry) => runAssessments.has(entry.assessment_id));
  const people = rosterPeople() ?? {};
  const recorded = recordedLogins(people);
  const owners = studentsByLogin(submissions, recorded);
  const enrolled = enrolledIn(bundle, runId).map((entry) => String(entry.student_id));
  const enrolledSet = new Set(enrolled);
  const nameOf = (student) =>
    withNames && typeof people[student]?.name === "string" && people[student].name.trim() ? people[student].name.trim() : student;

  // Week 1 is the homework's opening; without one, the term's start, said.
  const start = chosen.opens_at ?? (run.start_date ? run.start_date + "T00:00:00Z" : null);
  // The weeks run to the deadline; once it has passed, what came after is a
  // column of its own rather than folded into the last week.
  const due = chosen.due_at ?? chosen.lock_at ?? null;
  const passed = Boolean(due && Date.parse(due) < now);
  const end = passed ? Date.parse(due) : now;
  const reach = start ? weekOf(new Date(end).toISOString(), start) ?? 1 : 1;
  const weeks = Math.max(1, Math.min(MOST_WEEKS, reach));
  const folded = reach > MOST_WEEKS;
  const until = passed ? due : null;

  // Every fork listed, and every one analysed before that is no longer listed.
  const forks = new Map();
  for (const fork of listing?.forks ?? []) forks.set(fork.repo.toLowerCase(), fork);
  for (const [key, entry] of Object.entries(activity?.forks ?? {})) {
    if (!forks.has(key)) forks.set(key, { owner: entry.owner, repo: entry.repo, url: `https://github.com/${entry.repo}`, pushed_at: entry.pushed_at, deleted: true });
  }

  // Each student's fork: theirs by the match; two under one account, the
  // one pushed to last.
  const theirs = new Map();
  const loose = [];
  for (const fork of forks.values()) {
    const student = owners.get(fork.owner.toLowerCase());
    if (student && enrolledSet.has(student)) {
      const before = theirs.get(student);
      if (!before || String(fork.pushed_at ?? "") > String(before.pushed_at ?? "")) theirs.set(student, fork);
    } else loose.push(fork);
  }
  const withoutFork = enrolled.filter((student) => !theirs.has(student));

  const stats = (fork) => {
    const entry = activity?.forks?.[fork.repo.toLowerCase()];
    return {
      entry,
      seen: start ? weekly(entry, start, weeks, "seen", until) : null,
      claimed: start ? weekly(entry, start, weeks, "date", until) : null,
    };
  };
  const all = [...forks.values()].map((fork) => [fork, stats(fork)]);
  const statOf = new Map(all.map(([fork, value]) => [fork.repo.toLowerCase(), value]));
  // The darkest cell is the class's busiest week, not each row's own.
  const most = Math.max(
    1,
    ...all.flatMap(([, value]) => [...(value.seen?.weeks ?? []), ...(value.claimed?.weeks ?? []), value.seen?.after ?? 0, value.claimed?.after ?? 0]),
  );
  const columns = weeks + 1 + (until ? 1 : 0);

  // Quiet weeks fold together: a week where 95% of the analysed forks have
  // nothing is noise in a strip, and a run of two or more of them becomes one
  // narrow column with their sum, so a stray commit still shows. Decided per
  // reading, since a commit can sit in different weeks by when it was seen
  // and by its own date.
  const analysedForks = all.filter(([, value]) => value.entry && !value.entry.error);
  const groupsFor = (kind) => {
    const quiet = (week) =>
      analysedForks.filter(([, value]) => (value[kind]?.weeks[week] ?? 0) > 0).length <= analysedForks.length * 0.05;
    const groups = [];
    for (let week = 1; week <= weeks; week++) {
      const last = groups[groups.length - 1];
      if (quiet(week) && last && last.quiet && last.to === week - 1) last.to = week;
      else groups.push({ from: week, to: week, quiet: quiet(week) });
    }
    return groups;
  };
  const groupsOf = {
    seen: analysedForks.length ? groupsFor("seen") : Array.from({ length: weeks }, (_, i) => ({ from: i + 1, to: i + 1, quiet: false })),
    claimed: analysedForks.length ? groupsFor("claimed") : Array.from({ length: weeks }, (_, i) => ({ from: i + 1, to: i + 1, quiet: false })),
  };
  const groupLabel = (group) =>
    group.from === group.to ? "W" + group.from + (folded && group.to === weeks ? "+" : "") : "W" + group.from + "–" + group.to;

  const cell = (count, kind, label, late) => {
    const level = count === 0 ? 0 : Math.min(4, Math.ceil((count / most) * 4));
    return (
      '<td class="w ' + kind + " l" + level + (late && count ? " late" : "") + '" title="' +
      escapeAttribute(count + " commit" + (count === 1 ? "" : "s") + ", " + label) + '">' + (count || "") + "</td>"
    );
  };
  const cells = (counted, kind) =>
    cell(counted.weeks[0], kind, "before week 1", false) +
    groupsOf[kind]
      .map((group) => {
        let sum = 0;
        for (let week = group.from; week <= group.to; week++) sum += counted.weeks[week] ?? 0;
        const label =
          group.from === group.to
            ? "week " + group.from + (folded && group.to === weeks ? " and after" : "")
            : "weeks " + group.from + "–" + group.to + " (quiet for nearly everyone)";
        return cell(sum, kind + (group.from !== group.to ? " fold" : ""), label, false);
      })
      .join("") +
    (until ? cell(counted.after, kind, "after the deadline", true) : "");
  const blank = (kind) => '<td class="w ' + kind + '"></td>'.repeat(groupsOf[kind].length + 1 + (until ? 1 : 0));
  const noCells = blank("seen") + blank("claimed");

  const flags = (fork, value) => {
    const out = [];
    const entry = value.entry;
    if (fork.deleted) out.push('<span class="flag">fork deleted</span>');
    if (entry?.error) out.push('<span class="flag bad" title="' + escapeAttribute(entry.error) + '">not read</span>');
    const w = value.seen;
    if (w && w.total) {
      if (w.late_dated) {
        out.push(
          '<span class="flag" title="Dated before an analysis that did not have them yet: pushed late, or the date was changed">' +
            w.late_dated + " dated earlier</span>",
        );
      }
      if (w.gone) out.push('<span class="flag" title="On the fork once, gone after a history rewrite (force-push)">' + w.gone + " rewritten</span>");
      if (w.by_others) out.push('<span class="flag" title="Commits whose author is another GitHub account">' + w.by_others + " by others</span>");
      const last = w.weeks[w.weeks.length - 1];
      if (weeks >= 3 && last / w.total >= 0.8 && w.total >= 3) out.push('<span class="flag" title="Most commits arrived in the last week">last week</span>');
    } else if (entry && !entry.error) out.push('<span class="dim">no commits</span>');
    return out.join(" ");
  };

  // The snapshots: what each analysis found, so the count on any day can be read.
  const history = (value) => {
    const snapshots = value.entry?.snapshots ?? [];
    if (!snapshots.length) return "";
    return (
      '<details class="hist"><summary>' + snapshots.length + " check" + (snapshots.length === 1 ? "" : "s") + "</summary><ol>" +
      snapshots
        .map((snapshot) => "<li>" + escapeText(stamp(snapshot.at)) + " — " + snapshot.ahead_by + " commit" + (snapshot.ahead_by === 1 ? "" : "s") +
          (snapshot.head ? ' <span class="id">' + escapeText(snapshot.head.slice(0, 7)) + "</span>" : "") + "</li>")
        .join("") +
      "</ol></details>"
    );
  };

  const forkCells = (fork) => {
    const value = statOf.get(fork.repo.toLowerCase());
    const total = value?.seen?.total ?? value?.entry?.ahead_by ?? null;
    return {
      total: value?.entry ? String(total ?? 0) : '<span class="dim">—</span>',
      weeks: value?.seen ? cells(value.seen, "seen") + cells(value.claimed, "claimed") : noCells,
      push: fork.pushed_at ? escapeText(ago(fork.pushed_at, now)) : '<span class="dim">—</span>',
      flags: value ? flags(fork, value) + history(value) : "",
      unverified: value?.seen?.unverified ?? 0,
    };
  };

  // The name on the owner's GitHub profile, when an analysis asked for it.
  const profileOf = (fork) => activity?.forks?.[fork.repo.toLowerCase()]?.owner_name ?? null;
  // `beside` goes right after the login (the × that forgets it).
  const account = (fork, beside = "") =>
    '<a href="' + escapeAttribute(fork.url) + '" target="_blank" rel="noopener">' + escapeText(fork.owner) + "</a>" + beside +
    (profileOf(fork) ? '<span class="pn">' + escapeText(profileOf(fork)) + "</span>" : "");

  // Students a loose fork might be given: those with neither a fork nor a
  // recorded account. A suggestion is a login, or the profile's name, that
  // looks like their name.
  const free = withoutFork.filter((student) => !recorded[student]);
  const tokensOf = new Map(free.map((student) => [student, nameTokens(people[student]?.name)]));
  const likelyFor = (fork) => {
    const profile = nameTokens(profileOf(fork));
    return free.filter((student) => {
      const mine = tokensOf.get(student);
      return looksLike(fork.owner, mine) || profile.some((token) => mine.includes(token));
    });
  };
  const likelyOf = new Map(loose.map((fork) => [fork.repo.toLowerCase(), likelyFor(fork)]));
  // A suggestion sure enough for *Match all suggested*: one student for the
  // fork, and that student suggested for no other fork.
  const suggestedCount = new Map();
  for (const likely of likelyOf.values()) for (const student of likely) suggestedCount.set(student, (suggestedCount.get(student) ?? 0) + 1);
  const sureOf = (fork) => {
    const likely = likelyOf.get(fork.repo.toLowerCase()) ?? [];
    return likely.length === 1 && suggestedCount.get(likely[0]) === 1 ? likely[0] : null;
  };
  const picker = (fork) => {
    const likely = likelyOf.get(fork.repo.toLowerCase()) ?? [];
    const rest = free.filter((student) => !likely.includes(student));
    const sure = sureOf(fork);
    const option = (student) =>
      '<option value="' + escapeAttribute(student) + '"' + (student === sure ? " selected" : "") + ">" + escapeText(nameOf(student)) + "</option>";
    return (
      '<select class="pick" aria-label="Whose fork is ' + escapeAttribute(fork.owner) + '">' +
      '<option value="">Whose is it…</option>' +
      (likely.length ? '<optgroup label="Looks like their name">' + likely.map(option).join("") + "</optgroup>" : "") +
      (rest.length ? '<optgroup label="' + (likely.length ? "Everyone else" : "Without a fork") + '">' + rest.map(option).join("") + "</optgroup>" : "") +
      '</select> <button type="button" class="chip" data-match="' + escapeAttribute(fork.owner) + '">Match</button>'
    );
  };

  const head =
    "<tr><th>Student</th><th>Account</th><th class=\"n\">Commits</th>" +
    ["seen", "claimed"]
      .map(
        (kind) =>
          '<th class="w ' + kind + '">pre</th>' +
          groupsOf[kind]
            .map((group) =>
              '<th class="w ' + kind + (group.from !== group.to ? " fold" : "") + '"' +
              (group.from !== group.to ? ' title="Weeks ' + group.from + "–" + group.to + ': 95% or more of the forks have no commits"' : "") +
              ">" + groupLabel(group) + "</th>",
            )
            .join("") +
          (until ? '<th class="w ' + kind + '" title="After the deadline, ' + escapeAttribute(day(until)) + '">late</th>' : ""),
      )
      .join("") +
    "<th>Last push</th><th></th></tr>";

  const matchedRows = [...theirs.entries()]
    .sort(([a], [b]) => nameOf(a).localeCompare(nameOf(b)))
    .map(([student, fork]) => {
      const c = forkCells(fork);
      const how = recorded[student] && recorded[student].toLowerCase() === fork.owner.toLowerCase()
        ? ' <button type="button" class="lnk" data-unmatch="' + escapeAttribute(student) + '" title="Forget this account for ' +
          escapeAttribute(nameOf(student)) + '">×</button>'
        : ' <span class="dim" title="Known from a link they handed in">link</span>';
      return (
        '<tr class="mine" data-student="' + escapeAttribute(student) + '"><td class="who">' + escapeText(nameOf(student)) + "</td><td>" + account(fork, how) + '</td><td class="n">' + c.total + "</td>" +
        c.weeks + "<td>" + c.push + '</td><td class="fl">' + c.flags + "</td></tr>"
      );
    })
    .join("");

  const looseRows = loose
    .sort((a, b) => String(b.pushed_at ?? "").localeCompare(String(a.pushed_at ?? "")))
    .map((fork) => {
      const c = forkCells(fork);
      const shared = owners.has(fork.owner.toLowerCase())
        ? '<span class="dim">another run\'s student</span>'
        : free.length
          ? picker(fork)
          : '<span class="dim">everyone has a fork</span>';
      return (
        '<tr class="loose' + (sureOf(fork) ? " sug" : "") + '" data-login="' + escapeAttribute(fork.owner) + '"><td class="who">' + shared + "</td><td>" + account(fork) + '</td><td class="n">' + c.total + "</td>" +
        c.weeks + "<td>" + c.push + '</td><td class="fl">' + c.flags + "</td></tr>"
      );
    })
    .join("");

  const missingList = withoutFork
    .sort((a, b) => nameOf(a).localeCompare(nameOf(b)))
    .map((student) =>
      '<li data-student="' + escapeAttribute(student) + '">' + escapeText(nameOf(student)) +
      (recorded[student] ? ' <span class="dim">— recorded account ' + escapeText(recorded[student]) + " has no fork of it</span>" : "") + "</li>",
    )
    .join("");

  const sureTotal = loose.filter((fork) => !owners.has(fork.owner.toLowerCase()) && sureOf(fork)).length;

  const tabs =
    '<nav class="hw">' +
    homeworks
      .map((entry) =>
        '<button type="button" class="seg" data-pick="' + escapeAttribute(entry.assessment_id) + '"' +
        (entry.assessment_id === id ? ' aria-pressed="true"' : "") + ">" + escapeText(entry.title || entry.assessment_id) + "</button>",
      )
      .join("") +
    "</nav>";

  const analysed = activity?.analysed_at ?? null;
  const looked = listing?.looked_up_at ?? null;
  const unverified = all.reduce((sum, [, value]) => sum + (value.seen?.unverified ?? 0), 0);
  const status =
    '<p class="status">' +
    (analysed
      ? "Commits analysed " + escapeText(ago(analysed, now)) + " · "
      : looked
        ? "Forks listed " + escapeText(ago(looked, now)) + ", commits not analysed yet · "
        : "Not analysed yet · ") +
    (listing ? listing.forks.length + " fork" + (listing.forks.length === 1 ? "" : "s") + " of " : "") +
    '<span class="id">' + escapeText(repo) + "</span></p>";

  const startNote = !start
    ? '<p class="note">' + escapeText(title) + " has no opening date and the run no start date, so there are no weeks to count yet.</p>"
    : !chosen.opens_at
      ? '<p class="note">' + escapeText(title) + " has no opening date, so week 1 is the term's start (" + escapeText(day(start)) + "). " +
        '<button type="button" class="chip" data-ask="' +
        escapeAttribute("When did " + id + " (" + title + ") open for students? Ask me, then record it as its opens_at.") +
        '">Set when it opened</button></p>'
      : '<p class="dim">Week 1 starts ' + escapeText(day(start)) + (due ? " · due " + escapeText(day(due)) : "") + "</p>";

  const toggle =
    '<span class="by" role="group" aria-label="Count weeks by">' +
    '<button type="button" class="seg" data-by="seen" aria-pressed="true" title="When an analysis first found the commit on GitHub — this side\'s clock">When seen</button>' +
    '<button type="button" class="seg" data-by="claimed" title="The date written in the commit, which the student\'s machine sets">Commit date</button>' +
    "</span>";

  // While an analysis runs on this homework, the button says how far it is.
  const running = runningOn(id);
  const progress = running?.progress;
  const analyzeButton = running
    ? '<button type="button" class="go" disabled>' +
      (running.state === "waiting"
        ? "Waiting…"
        : "Analysing…" + (progress && progress.total !== null ? " " + progress.done + " of " + progress.total : "")) +
      "</button>"
    : '<button type="button" class="go" data-analyze="' + escapeAttribute(id) + '">Analyze forks</button>';

  const body =
    tabs +
    '<header class="top"><div><h1>' + escapeText(title) + "</h1>" + status + startNote + "</div>" +
    '<div class="acts">' + toggle +
    analyzeButton +
    "</div></header>" +
    (analysed && unverified
      ? '<p class="dim small">' + unverified + " commit" + (unverified === 1 ? " was" : "s were") +
        " already there at the first analysis, so they are placed by their own date even under “When seen”. " +
        "Analysing every week or so makes the rest certain.</p>"
      : !analysed
        ? '<p class="dim small">Analyzing compares each fork with the starter — one GitHub read per fork, and only forks pushed since are read again. ' +
          "It runs in the background; the page fills in when it ends.</p>"
        : "") +
    '<div class="wrap"><table class="grid by-seen"><thead>' + head + "</thead>" +
    '<tbody><tr class="sec" id="sec-mine"><th colspan="' + (columns + 5) + '">Matched (<span data-count="mine">' + theirs.size + "</span>)</th></tr>" +
    (matchedRows || '<tr class="nobody"><td colspan="' + (columns + 5) + '" class="dim">Nobody yet.</td></tr>') +
    (loose.length
      ? '<tr class="sec"><th colspan="' + (columns + 5) + '">Forks nobody is matched to (<span data-count="loose">' + loose.length + "</span>)" +
        ' <button type="button" class="chip sure" data-sure' + (sureTotal ? "" : " hidden") + ">Match " + sureTotal + " suggested</button>" +
        "</th></tr>" + looseRows
      : "") +
    "</tbody></table></div>" +
    (withoutFork.length
      ? '<section class="none"><h2>No fork found (<span data-count="none">' + withoutFork.length + "</span>)</h2><ul>" + missingList + "</ul></section>"
      : "");

  const style =
    "<style>" +
    ".hw{display:flex;flex-wrap:wrap;gap:4px;margin:0 0 12px}" +
    ".seg{font:inherit;font-size:12px;padding:3px 10px;border:1px solid var(--line);background:transparent;color:var(--fg);border-radius:999px;cursor:pointer}" +
    ".seg[aria-pressed=true]{background:var(--fg);color:var(--bg,#fff);border-color:var(--fg)}" +
    "@media(prefers-color-scheme:dark){.seg[aria-pressed=true]{color:#111}}" +
    ".top{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap;margin-bottom:6px}" +
    "h1{font-size:17px;margin:0 0 2px}" +
    ".status{margin:0 0 4px;color:var(--dim)}" +
    ".acts{display:flex;gap:10px;align-items:center}" +
    ".by{display:inline-flex;gap:2px}" +
    ".go{font:inherit;font-weight:600;padding:6px 14px;border-radius:6px;border:1px solid #2f6f4f;background:#2f6f4f;color:#fff;cursor:pointer}" +
    ".go[disabled]{opacity:.6;cursor:default}" +
    ".note{background:var(--warnbg);color:var(--warn);padding:6px 10px;border-radius:6px}" +
    ".small{font-size:12px}" +
    ".chip{font:inherit;font-size:12px;padding:2px 9px;border-radius:999px;border:1px solid var(--line);background:transparent;color:var(--fg);cursor:pointer}" +
    ".lnk{font:inherit;border:0;background:none;color:var(--dim);cursor:pointer;padding:0 2px}" +
    ".wrap{overflow-x:auto}" +
    ".grid{border-collapse:collapse;width:100%;margin-top:6px}" +
    ".grid th,.grid td{padding:4px 6px;border-bottom:1px solid var(--line);text-align:left;vertical-align:middle;white-space:nowrap}" +
    ".grid thead th{font-size:11px;color:var(--dim);font-weight:500}" +
    ".grid .n{text-align:right;font-variant-numeric:tabular-nums}" +
    ".grid .sec th{padding-top:14px;font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:var(--dim)}" +
    ".w{width:26px;text-align:center!important;font-size:11px;font-variant-numeric:tabular-nums;padding:2px!important}" +
    "td.w{border:2px solid transparent!important;border-radius:4px}" +
    ".late{box-shadow:inset 0 0 0 2px #c0662b}" +
    "th.fold{font-style:italic;white-space:nowrap}td.fold{background-image:repeating-linear-gradient(135deg,transparent 0 3px,rgba(127,127,127,.12) 3px 5px)}" +
    ".l0{background:rgba(127,127,127,.08)}.l1{background:#cfe8d6}.l2{background:#9fd0ad}.l3{background:#5fae78;color:#fff}.l4{background:#2f6f4f;color:#fff}" +
    ".by-seen .claimed,.by-claimed .seen{display:none}" +
    "a{color:var(--info)}" +
    ".fl{white-space:normal!important;font-size:12px}" +
    ".flag{display:inline-block;padding:0 6px;border-radius:4px;background:var(--warnbg);color:var(--warn);margin:1px 2px 1px 0}" +
    ".flag.bad{background:#fbe9e7;color:#a33}" +
    ".hist{display:inline-block;margin-left:4px}.hist summary{cursor:pointer;color:var(--dim)}.hist ol{margin:4px 0 0;padding-left:18px}" +
    ".pick{font:inherit;font-size:12px;max-width:200px}" +
    ".pn{display:block;font-size:11px;color:var(--dim)}" +
    "tr.sug td.who select{outline:2px solid #9fd0ad;outline-offset:1px;border-radius:3px}" +
    ".sure{margin-left:8px;text-transform:none;letter-spacing:0;font-weight:600;border-color:#2f6f4f;color:#2f6f4f}" +
    "tr.just td{animation:just 1.6s ease-out}@keyframes just{from{background:#cfe8d6}to{background:transparent}}" +
    ".none ul{columns:3 180px;margin:6px 0 0;padding-left:18px}" +
    "</style>";

  // Matching happens in place: the row moves to Matched once the pane says
  // the account is saved, and nothing redraws, so the page does not jump.
  // The scroll is reported up, so a redraw (an analysis ending, ×) comes
  // back where it was (WidgetFrame in client/materials.js).
  const script =
    "<script>(function(){" +
    "function up(m){m.source='professor-pane';parent.postMessage(m,'*');}" +
    "var q=null;addEventListener('scroll',function(){if(q)return;q=setTimeout(function(){q=null;up({kind:'frame-scroll',y:scrollY});},150);});" +
    "function $$(s){return Array.prototype.slice.call(document.querySelectorAll(s));}" +
    "function drop(n){if(n&&n.parentNode)n.parentNode.removeChild(n);}" +
    "function sure(){return $$('tr.loose.sug').filter(function(r){var s=r.querySelector('select.pick');return s&&s.value;});}" +
    "function counts(){var c={mine:$$('tr.mine').length,loose:$$('tr.loose').length,none:$$('.none li').length};" +
    "$$('[data-count]').forEach(function(x){x.textContent=c[x.getAttribute('data-count')];});" +
    "var n=sure().length,b=document.querySelector('[data-sure]');if(b){b.hidden=!n;b.disabled=false;b.textContent='Match '+n+' suggested';}" +
    "if(c.mine)drop(document.querySelector('tr.nobody'));}" +
    "function place(r,student){var s=r.querySelector('select.pick');var o=s&&s.querySelector('option[value=\"'+student+'\"]');" +
    "var name=o?o.textContent:student;var who=r.querySelector('td.who');who.textContent=name;" +
    "var x=document.createElement('button');x.type='button';x.className='lnk';x.setAttribute('data-unmatch',student);" +
    "x.title='Forget this account for '+name;x.textContent='\\u00d7';var a=r.querySelector('td:nth-child(2) a');if(a)a.insertAdjacentElement('afterend',x);" +
    "r.className='mine just';r.setAttribute('data-student',student);" +
    "var mine=$$('tr.mine').filter(function(m){return m!==r;});var after=document.getElementById('sec-mine');" +
    "for(var i=0;i<mine.length;i++){if(mine[i].querySelector('td.who').textContent.localeCompare(name)>0)break;after=mine[i];}" +
    "after.parentNode.insertBefore(r,after.nextSibling);" +
    "$$('select.pick option[value=\"'+student+'\"]').forEach(function(op){var sel=op.closest('select');var was=sel.value===student;drop(op);if(was)sel.value='';});" +
    "$$('.none li[data-student=\"'+student+'\"]').forEach(drop);}" +
    "var pending={},seq=0;" +
    "function match(rows){var pairs=[],seen={},used=[];rows.forEach(function(r){var s=r.querySelector('select.pick');if(!s||!s.value||seen[s.value])return;" +
    "seen[s.value]=1;used.push(r);pairs.push({student:s.value,login:r.getAttribute('data-login')});" +
    "var b=r.querySelector('[data-match]');if(b){b.disabled=true;b.textContent='Saving\\u2026';}});" +
    "if(!pairs.length)return false;var t='m'+(++seq);pending[t]=used;up({kind:'fork-match',pairs:pairs,ticket:t});return true;}" +
    "addEventListener('message',function(e){var d=e.data;if(!d||d.source!=='professor-pane'||d.kind!=='fork-matched')return;" +
    "var rows=pending[d.ticket]||[];delete pending[d.ticket];var done={};(d.matched||[]).forEach(function(p){done[p.login.toLowerCase()]=p.student;});" +
    "rows.forEach(function(r){var st=done[r.getAttribute('data-login').toLowerCase()];if(st)place(r,st);" +
    "else{var b=r.querySelector('[data-match]');if(b){b.disabled=false;b.textContent='Match';}}});" +
    "counts();var said=[];if(d.error&&!(d.matched||[]).length)said.push(d.error);" +
    "(d.refused||[]).forEach(function(p){said.push(p.error);});if(d.note)said.push(d.note);if(said.length)alert(said.join('\\n'));});" +
    "document.addEventListener('change',function(e){if(e.target.matches&&e.target.matches('select.pick'))counts();});" +
    "document.addEventListener('click',function(e){var t=e.target;if(!t.closest)return;" +
    "var b=t.closest('[data-by]');if(b){var g=document.querySelector('.grid');if(g){g.className='grid by-'+b.getAttribute('data-by');}" +
    "document.querySelectorAll('[data-by]').forEach(function(x){x.setAttribute('aria-pressed',x===b?'true':'false');});return;}" +
    "var p=t.closest('[data-pick]');if(p){up({kind:'forks-pick',assessment:p.getAttribute('data-pick')});return;}" +
    "var a=t.closest('[data-analyze]');if(a){a.disabled=true;a.textContent='Analysing\\u2026';up({kind:'homework-forks',assessment:a.getAttribute('data-analyze'),activity:true});return;}" +
    "var all=t.closest('[data-sure]');if(all){if(match(sure()))all.disabled=true;return;}" +
    "var m=t.closest('[data-match]');if(m){var r=m.closest('tr');if(!match([r])){var s=r.querySelector('select.pick');if(s)s.focus();}return;}" +
    "var u=t.closest('[data-unmatch]');if(u){u.disabled=true;up({kind:'fork-match',student:u.getAttribute('data-unmatch'),clear:true});return;}" +
    "var k=t.closest('[data-ask]');if(k){up({kind:'ask',prompt:k.getAttribute('data-ask')});return;}" +
    "});})();</script>";

  return documentPage(style + body + script, dark);
};
