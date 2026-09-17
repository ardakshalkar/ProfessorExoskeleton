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

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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

  /** `quiz` as `Quiz`. The enum is the record's spelling, not the reader's. */
  function titled(word) {
    const text = String(word || '');
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
  }

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
  /**
   * What a piece of graded work says, for the panel behind its chip.
   *
   * The chip has always been able to name the work and, when a brief existed as
   * a file, to open it. Most assessments have no such file — the brief is the
   * record's own `description` — so the chip named something the reader could
   * not then read. This is that text, plus the facts a professor asks in the
   * same breath: when it is due, what it is worth, what is handed in, and
   * whether anything has been written down about how it will be marked.
   *
   * An empty `brief_id` is the request NOT to open anything, and it is the
   * honest answer for work whose description nobody has written yet: a button
   * that opens an empty sheet is worse than a label, because the reader has to
   * press it to learn there is nothing there. The chip stays a label in that
   * case, exactly as before.
   *
   * The text is split on blank lines and returned as paragraphs rather than as
   * one string with newlines in it. The template language escapes every
   * interpolation and has no raw construct, so a `<br>` could not be smuggled
   * through anyway — paragraphs are how a shape survives the crossing.
   */
  function brief(w, a, type) {
    const text = String(a.description == null ? '' : a.description).trim();
    if (!text) return { brief_id: '' };

    const facts = [];
    const opens = shortDate(a.opens_on);
    const due = shortDate(a.due_on);
    if (opens) facts.push({ k: 'Opens', v: opens });
    if (due) facts.push({ k: 'Due', v: due });
    // Said once, plainly, rather than by the absence of two rows. A dateless
    // assessment is a real state in this model and the week card already draws
    // it; the sheet should not make the reader infer it from a gap.
    if (!opens && !due) facts.push({ k: 'Dates', v: 'not scheduled' });
    facts.push({ k: 'Weight', v: pct(a.weight) || 'not set' });
    if (a.maximum_score || a.maximum_score === 0) {
      facts.push({ k: 'Out of', v: String(a.maximum_score) });
    }
    const handed = (a.submission_type || []).join(', ');
    if (handed) facts.push({ k: 'Handed in as', v: handed });
    const outcomes = (a.outcomes || []).join(', ');
    if (outcomes) facts.push({ k: 'Outcomes', v: outcomes });
    // The count, not the criteria. `assessment_rubric` is the tool that answers
    // what a rubric says, and repeating it here would be a second copy of the
    // marking scheme to fall out of step with the first.
    facts.push({
      k: 'Rubric',
      v: a.criteria
        ? a.criteria + (a.criteria === 1 ? ' criterion' : ' criteria')
        : 'none yet',
    });

    return {
      // Unique within the document: one assessment appears in the week it opens
      // AND the week it is due, and two panels sharing an id would open the
      // first one twice.
      brief_id: 'brief-' + w.week + '-' + (a.assessment_id || type),
      // Where a host that can frame a page should open this instead.
      //
      // Empty on every surface but the pane, and that is the capability test
      // doing its job: the published page and a chat client have no route that
      // serves a brief, so they keep the disclosure written into the markup.
      // The pane supplies the address, exactly as it already does for a deck.
      //
      // THE DOCUMENT WINS when the assessment names one. A brief written as a
      // file is the real thing — the sheet students are handed, several pages
      // of it — and `description` is a paragraph summarising it for the term
      // plan. Opening the summary while the record knows where the brief is
      // would be showing the worse of two answers on purpose.
      //
      // Only when the host can actually paint it: `viewable` is false for a
      // `.docx`, which the overlay cannot frame, and that keeps the composed
      // page rather than opening a download.
      brief_url: (a.viewable && safeUrl(a.url)) || safeUrl(a.brief_url) || '',
      // Which of the two the address points at, because the host sandboxes a
      // frame by extension: a markdown brief is rendered to HTML by `/file`,
      // a PDF one is painted by the browser's own viewer.
      brief_format: (a.viewable && a.url ? a.format : 'html') || 'html',
      brief_kind: titled(ASSESS_WORD[type] || type),
      brief_title: a.title || titled(type),
      brief_facts: facts,
      brief_text: text.split(/\n{2,}/)
        .map(function (p) { return p.replace(/\s+/g, ' ').trim(); })
        .filter(Boolean),
    };
  }

  function indicators(w) {
    const main = [];
    const extra = [];
    for (const m of w.meetings || []) {
      for (const r of m.resources || []) {
        const deck = r.kind === 'slides';
        (deck ? main : extra).push({
          label: deck ? 'Slides' : r.title,
          // Built here, or brought in finished.
          //
          // Only on a deck, and only when the record says. A week may carry
          // two of these — one rendered from its own markdown, one somebody
          // else's imported whole — and they are different claims about what
          // the file is: one names a source to edit, the other names a reading
          // of something this course did not write. Two chips that both say
          // "Slides" and nothing else is the state this replaces.
          //
          // Empty is drawn as empty rather than assumed to be "generated". An
          // artefact that declares no origin has not been through the one
          // place materials are supposed to come from, and should look like
          // it.
          origin: deck ? (r.origin || '') : '',
          // How an imported outline was obtained — text, ocr or vlm. A deck
          // read by OCR is a weaker claim than one read from its own text, and
          // the difference should be on screen rather than guessed.
          read_by: deck ? (r.read_by || '') : '',
          // Where the host serves what was read out of this deck. Empty unless
          // the record actually carries a plan, so the badge is a label where
          // there is nothing to open and a control where there is — a chip
          // never offers a page that would render empty.
          outline_url: deck ? safeUrl(r.outline_url) || '' : '',
          icon: RES_ICON[r.kind] || 'doc',
          tone: deck ? 'deck' : 'x',
          kind: r.kind,
          name: r.title,
          href: safeUrl(r.url),
          // What the host would title an overlay of this material, and by
          // being empty, the request not to open one: a format the browser
          // would only download says nothing here, and so does every payload
          // from a host that has no route to the file. See `openMaterial`.
          view: r.viewable ? r.title : '',
          format: r.format || '',
          formats: (r.formats || [])
            .map(function (f) {
              return {
                label: f.label,
                href: safeUrl(f.url),
                view: f.viewable ? r.title + ' · ' + f.label : '',
                format: f.format || '',
              };
            })
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
        main.push(Object.assign(brief(w, a, type), {
          label: titled(ASSESS_WORD[type] || type),
          icon: ASSESS_ICON[type] || 'doc',
          tone: verb === 'due' ? 'due' : 'task',
          kind: type,
          name: a.title,
          href: safeUrl(a.url),
          // The brief students read, when the payload knows where it is and
          // the host has a route to it. Empty `view` is the request NOT to
          // open an overlay — a format the browser would only download, or a
          // chat client with no file route at all — and the link then behaves
          // as the tab it always was. Same contract as a deck's; see the
          // resources above.
          view: a.viewable ? a.title : '',
          format: a.format || '',
          formats: [],
        }));
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
      main.push(Object.assign(brief(w, a, type), {
        label: titled(ASSESS_WORD[type] || type),
        icon: ASSESS_ICON[type] || 'doc',
        tone: 'todo',
        kind: type,
        name: a.title,
        draft: isDraft(a.assessment_id),
        href: safeUrl(a.url),
        view: a.viewable ? a.title : '',
        format: a.format || '',
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
      }));
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
      // `01`, the way the mockup writes it: two digits keep the left column a
      // fixed width from week 9 to week 10.
      week_label: w.week < 10 ? '0' + w.week : String(w.week),
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
          return [titled(m.type), at, m.duration_minutes ? m.duration_minutes + ' min' : '']
            .filter(Boolean)
            .join(' · ');
        })
        .concat(
          // The module's own identifier and hours, which used to head the topic
          // block. The title moved into the header, so these follow it rather
          // than repeating the title underneath.
          (w.modules || []).map(function (m) { return m.module_id; }),
        )
        .filter(Boolean)
        .join(' · '),
      // The row exists when there is anything at all to put in it: a week of
      // readings with no deck and no graded work still has materials.
      has_items: ind.items.length > 0 || ind.extras.length > 0,
      items: ind.items,
      // What the card does not have room for, behind the ··· control.
      //
      // Only things that are NOT already on the card: the week's full span
      // rather than its first day, the module's own hours, where the meeting
      // happens, and what each piece of graded work is worth. A panel that
      // repeated the chips would be a control that costs a press and returns
      // what was already on screen.
      details: (function () {
        const out = [];
        if (w.starts_on) {
          out.push({
            k: 'Dates',
            v: shortDate(w.starts_on) + (w.ends_on ? ' \u2013 ' + shortDate(w.ends_on) : ''),
          });
        }
        for (const m of w.modules || []) {
          out.push({
            k: 'Module',
            v: [m.module_id, m.estimated_hours ? m.estimated_hours + ' h' : '']
              .filter(Boolean).join(' \u00b7 '),
          });
        }
        for (const m of w.meetings || []) {
          out.push({
            k: titled(m.type || 'meeting'),
            v: [m.title, m.location].filter(Boolean).join(' \u00b7 ') || '\u2014',
          });
        }
        for (const [list, verb] of [[w.opens, 'opens'], [w.due, 'due']]) {
          for (const a of list || []) {
            out.push({ k: a.title, v: pct(a.weight) || 'no weight set' });
          }
        }
        return out;
      })(),
      prep: (w.meetings || []).map(function (m) { return m.preparation; }).filter(Boolean),
      extras: ind.extras,
      extras_count: ind.extras_count,
      // "+ 4 resources", not "4 more": a count with no noun makes the reader
      // press the button to find out what was counted.
      extras_word: ind.extras_count === 1 ? '1 resource' : ind.extras_count + ' resources',
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

  // Which sections this surface wants, defaulting to all of them.
  //
  // The standalone widget is the whole course page and must keep every section:
  // a chat client drawing `course_outline` has no tabs to put the rest behind,
  // so a payload that says nothing gets everything. The professor's pane does
  // have tabs, and once Assessments and Grading policy became two of them the
  // week view was showing their contents above the weeks — a table and a policy
  // note between the professor and the thing they opened the tab for.
  //
  // `!== false` rather than a truthiness test, so a payload that omits the key
  // and one that sets it to null both mean "all", and only an explicit `false`
  // takes a section away.
  const sections = d.sections || {};

  return {
    // The pane's run picker already names the course and the term, so the
    // title block is three lines of duplication in a three-hundred-pixel
    // column. The standalone page has no picker and keeps it.
    show_header: sections.header !== false,
    // `complete` is the model's own verdict on whether the weights add up. The
    // figure beside it is the same one either way — this only decides whether
    // it is drawn as a fact or as a fault.
    weights_short: grading.complete !== true,
    show_assessments: sections.assessments !== false && (d.assessments || []).length > 0,
    show_grading_note: sections.grading !== false && Boolean(grading.note),
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
      return {
        title: r.title,
        kind: r.kind,
        href: safeUrl(r.url),
        view: r.viewable ? r.title : '',
        format: r.format || '',
      };
    }),
    stranded: stranded,
    placement: d.placement,
  };
}

function view(d) {
  return tmpl(TEMPLATE, model(d));
}
