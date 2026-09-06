// The course outline, as values for `course-outline.tmpl` to arrange.
//
// This file used to hold the markup as well, which made the structure of the
// public page readable only by reading JavaScript. The split is now: the
// template decides what the page has and in what order, this decides what each
// value says. Nothing here emits a tag.
//
// The line between the two is formatting versus structure. `0.3` becomes `30%`
// here, because that is presentation of a figure the payload already computed;
// which cell it lands in is the template's business. A null weight stays null
// all the way to the template, which is what lets the template say "weight not
// set" rather than printing a number nobody set.

function model(d) {
  const run = d.run || {};
  const grading = d.grading || {};

  function labels(list) {
    return (list || []).map(function (entry) {
      return { id: entry.id, label: entry.title || entry.id };
    });
  }

  function marks(list, kind, label) {
    return (list || []).map(function (a) {
      return {
        kind: kind,
        label: label,
        title: a.title,
        assessment_id: a.assessment_id,
        weight: pct(a.weight),
      };
    });
  }

  const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun',
                  'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

  // `2026-09-15` as `sep 15`. Parsed by hand rather than through `Date`, which
  // reads a bare ISO date as UTC and can shift it a day west of here.
  function shortDate(value) {
    const parts = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
    if (!parts) return '';
    return MONTHS[Number(parts[2]) - 1] + ' ' + Number(parts[3]);
  }

  // An identifier still carrying the draft marker.
  //
  // This is the whole of how the pane can tell a proposal from a record: the
  // banner above the frame says the VIEW includes drafts, but says nothing
  // about which row is one. `-DRAFT-` in the id is the model's own signal, put
  // there so a promotion is visible in a diff, and it works just as well here.
  function isDraft(value) {
    return String(value || '').indexOf('-DRAFT-') !== -1;
  }

  // What kind of thing an artefact is, as a glyph and as a word.
  //
  // Two closed enums, both from `model/common.ts`: ResourceKind and
  // AssessmentType. A kind that is not in a table falls back to its own name and
  // the generic page glyph, so adding a kind to the model degrades to plain text
  // rather than to a blank chip.
  const RES_ICON = {
    slides: 'slides', reading: 'book', textbook_chapter: 'book',
    dataset: 'data', notebook: 'code', video: 'play', link: 'link',
    tool: 'tool', other: 'doc',
  };
  const ASSESS_ICON = {
    quiz: 'quiz', exam: 'quiz', assignment: 'doc', project: 'doc',
    presentation: 'slides', oral_defense: 'doc', participation: 'doc',
    other: 'doc',
  };
  // `assignment` is the model's word; `homework` is the professor's, and it is
  // the one on the record titles (HW1) and on the folder the work lives in.
  const ASSESS_WORD = { assignment: 'homework', oral_defense: 'defense' };

  /**
   * The directory a run's assessments live in, as a fallback.
   *
   * The host resolves the actual file and puts it on `source_file`, by looking
   * the identifier up rather than guessing a filename. This is what to say when
   * it could not — a chat client with no filesystem behind it, or an id that
   * appears in no file the loader reads. The directory is true under every
   * layout the loader accepts; the filename inside it is not, which is why this
   * says "grep for the id" instead of naming one.
   *
   * Both parts come from the payload, so a different course or a different term
   * gets its own path and nothing here is pinned to CSS-4007.
   */
  function where(r) {
    return 'courses/' + (r.course_id || '<course>') + '/versions/'
      + (r.term || '<term>') + '/assessments/';
  }

  /**
   * Everything a week offers, split into what a professor is looking for and
   * what is merely also true.
   *
   * The primary row is the deck and the graded work — the four things asked for
   * by name: slides, quiz, homework, and when the homework is due. Readings,
   * notebooks, tools and repositories are real materials but they are not what
   * a Monday-morning scan is for, so they fold behind a count. Extras carry
   * their own title rather than their kind, because `other` and `tool` say
   * nothing: "HW1 template repository" does.
   */
  function indicators(w) {
    const main = [];
    const extra = [];
    for (const m of w.meetings || []) {
      for (const r of m.resources || []) {
        const deck = r.kind === 'slides';
        (deck ? main : extra).push({
          label: deck ? 'slides' : r.title,
          icon: RES_ICON[r.kind] || 'doc',
          tone: deck ? 'deck' : 'x',
          kind: r.kind,
          name: r.title,
          href: safeUrl(r.url),
          formats: (r.formats || [])
            .map(function (f) { return { label: f.label, href: safeUrl(f.url) }; })
            .filter(function (f) { return f.href; }),
          draft: isDraft(r.resource_id) || isDraft(r.document_id),
          slides: deck,
        });
      }
    }
    // Assessments are named by their type, not by "due" or "opens": a professor
    // scanning the term is looking for the quiz, and whether it opens or closes
    // that week is what the date beside it says.
    for (const [list, verb] of [[w.opens, 'opens'], [w.due, 'due']]) {
      for (const a of list || []) {
        const on = shortDate(a.due_on || a.opens_on);
        const type = a.type || 'assessment';
        main.push({
          label: ASSESS_WORD[type] || type,
          icon: ASSESS_ICON[type] || 'doc',
          tone: verb === 'due' ? 'due' : 'task',
          kind: type,
          name: a.title,
          href: safeUrl(a.url),
          when: on ? verb + ' ' + on : '',
          overdue: verb === 'due',
          draft: isDraft(a.assessment_id),
          formats: [],
        });
      }
    }
    // Work that is taught this week and has no deadline at all. It reaches the
    // row because `outline` now places a dateless assessment on its module's
    // week rather than dropping it off the plan — but it must not look like the
    // others, so it carries the gap where the date would be and a button that
    // starts the only conversation that closes it. The prompt names the record,
    // because the model answering it should not have to guess which of eight
    // assessments the professor meant.
    for (const a of w.undated || []) {
      const type = a.type || 'assessment';
      main.push({
        label: ASSESS_WORD[type] || type,
        icon: ASSESS_ICON[type] || 'doc',
        tone: 'todo',
        kind: type,
        name: a.title,
        draft: isDraft(a.assessment_id),
        // The verb first, the reason after, and an explicit floor under the
        // tool use.
        //
        // The earlier wording opened with two sentences of justification and
        // ended with three imperatives — ask, write, report — none of them
        // marked as a stopping point. A model reads that as one job and plans
        // the whole of it before speaking: find the record, work out whether a
        // date belongs in a draft, check the run. Half a dozen tool calls happen
        // before the one question the professor pressed a button to be asked.
        //
        // Two dates cannot be looked up, because they do not exist anywhere
        // yet. Saying so in the prompt is what makes the reading pointless
        // rather than merely slow, and the preset's own opening rule — validate
        // and inbox before asking anything — is named here so it is waived on
        // purpose rather than disobeyed by accident.
        ask: 'Ask me this now, in your first message, before running any '
          + 'command: what are the open and due dates for ' + a.assessment_id
          + ' ("' + a.title + '")? Skip the usual opening validate and inbox '
          + 'sweep, and do not read any file first: these two dates exist only '
          + 'in my head, so nothing on disk can answer this. Once I have '
          + 'answered, set opens_at and due_at on the ' + a.assessment_id
          + ' entry in ' + (a.source_file || where(run) + ' (grep for the id: '
            + 'the filename is not fixed)')
          + ', and then just confirm what you wrote. Do not work out which week '
          + 'the dates fall in; the Course pane places them itself and shows it.',
        formats: [],
      });
    }
    // The deck first, then the graded work in the order the payload placed it —
    // what opens this week before what falls due in it.
    main.sort(function (a, b) { return (a.slides ? 0 : 1) - (b.slides ? 0 : 1); });
    return { items: main, extras: extra, extras_count: extra.length };
  }

  const weeks = (d.weeks || []).map(function (w) {
    const ind = indicators(w);
    return {
      week: w.week,
      classes: w.when + (w.planned ? '' : ' gap'),
      starts_on: w.starts_on,
      // The end date without its year: the row already carries the start in
      // full, and "2026-09-07 – 09-13" is one date read twice.
      ends_on: w.ends_on ? w.ends_on.slice(5) : '',
      is_current: w.week === d.current_week,
      planned: w.planned,
      // The compact header: a 38px marker carrying the week number and the
      // month-and-day it starts, then the module's own title beside it. The
      // old layout gave the left column ninety of the pane's three hundred
      // pixels — a third of the width, on every one of sixteen weeks, to hold
      // two dates and a badge.
      mark: shortDate(w.starts_on),
      title: (w.modules || []).map(function (m) { return m.title; }).join(' · '),
      // The meeting, demoted to a subtitle. One lecture a week does not need a
      // list of its own, and its time is the only part that changes.
      subtitle: (w.meetings || [])
        .map(function (m) {
          const at = m.on
            ? m.on.slice(5) + (m.scheduled_at ? ' ' + m.scheduled_at.slice(11, 16) : '')
            : 'not scheduled';
          return [m.type, at, m.duration_minutes ? m.duration_minutes + ' min' : '']
            .filter(Boolean)
            .join(' · ');
        })
        .concat(
          // The module's own identifier and hours, which used to head the topic
          // block. The title moved into the header, so these follow it rather
          // than repeating the title underneath.
          (w.modules || []).map(function (m) {
            return [m.module_id, m.estimated_hours ? m.estimated_hours + ' h' : '']
              .filter(Boolean)
              .join(' · ');
          }),
        )
        .filter(Boolean)
        .join(' / '),
      // The row exists when there is anything at all to put in it: a week of
      // readings with no deck and no graded work still has materials.
      has_items: ind.items.length > 0 || ind.extras.length > 0,
      items: ind.items,
      extras: ind.extras,
      extras_count: ind.extras_count,
      topics: (w.modules || []).map(function (m) {
        return {
          title: m.title,
          module_id: m.module_id,
          hours: m.estimated_hours,
          concepts: labels(m.concepts),
          outcomes: labels(m.outcomes),
        };
      }),
      source_topics: (w.source_outline || []).map(function (entry) {
        return {
          title: entry.title,
          description: entry.description,
          source_title: entry.source_title,
          document_id: entry.document_id,
        };
      }),
      meetings: (w.meetings || []).map(function (m) {
        return {
          type: m.type,
          title: m.title,
          at: m.on
            ? m.on + (m.scheduled_at ? ' ' + m.scheduled_at.slice(11, 16) : '')
            : 'not scheduled',
          location: m.location,
          minutes: m.duration_minutes,
          preparation: m.preparation,
          // `href` was dropped here while the required-materials list below
          // kept it, so the same resource was a link in one place on the page
          // and plain text in the other. Same mapping now, same `safeUrl`.
          //
          // Split in two: the slides stay on screen, everything else folds
          // behind a count. A lecture has one deck and a tail of readings,
          // tools and repositories, and the deck is the thing a professor opens
          // in the ninety seconds before a class. `formats` carries the same
          // deck's other renders — PPTX and PDF — which the host pairs by
          // filename; a chat client that pairs nothing sends none and the
          // buttons simply do not appear.
          slides: (m.resources || [])
            .filter(function (r) { return r.kind === 'slides'; })
            .map(function (r) {
              return {
                title: r.title,
                href: safeUrl(r.url),
                formats: (r.formats || []).map(function (f) {
                  return { label: f.label, href: safeUrl(f.url) };
                }).filter(function (f) { return f.href; }),
              };
            }),
          others: (m.resources || [])
            .filter(function (r) { return r.kind !== 'slides'; })
            .map(function (r) {
              return { title: r.title, kind: r.kind, href: safeUrl(r.url) };
            }),
          // The template has no arithmetic, so the count is computed here.
          others_count: (m.resources || []).filter(function (r) {
            return r.kind !== 'slides';
          }).length,
        };
      }),
      marks: marks(w.opens, 'opens', 'opens').concat(marks(w.due, 'due', 'due')),
    };
  });

  const unplaced = d.unplaced || {};
  const stranded = (unplaced.modules || []).map(function (m) {
    return {
      id: m.module_id,
      title: m.title,
      note: m.week ? 'week ' + m.week + ', outside this run' : 'no week',
    };
  }).concat((unplaced.meetings || []).map(function (m) {
    return { id: m.activity_id, title: m.title, note: 'no date and no module' };
  })).concat((unplaced.assessments || []).map(function (a) {
    return { id: a.assessment_id, title: a.title, note: 'no dates' };
  }));

  return {
    run: {
      course_id: run.course_id,
      title: run.title,
      term: run.term,
      start_date: run.start_date,
      end_date: run.end_date,
      instructors: (run.instructors || []).join(', '),
      id: run.id,
      description: run.description,
    },
    totals: d.totals || {},
    total_weight: pct(grading.total_weight),
    grading_note: grading.note,
    assessments: (d.assessments || []).map(function (a) {
      return {
        title: a.title,
        assessment_id: a.assessment_id,
        criteria: a.criteria,
        type: a.type,
        weight: pct(a.weight),
        due_on: a.due_on,
        outcomes: (a.outcomes || []).join(', '),
      };
    }),
    weeks: weeks,
    // A material becomes a link only where the payload carries somewhere to go.
    // The hosted page fills these in with the copies it published beside itself;
    // in a chat client most stay plain text, because the file is in the
    // application's object storage and this frame has no route to it. Neither
    // surface invents a path, and `safeUrl` returns null for anything that is
    // not http, https or a relative path.
    materials: (d.required_materials || []).map(function (r) {
      return { title: r.title, kind: r.kind, href: safeUrl(r.url) };
    }),
    stranded: stranded,
    placement: d.placement,
  };
}

function view(d) {
  return tmpl(TEMPLATE, model(d));
}
