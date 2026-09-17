/**
 * How many missing students a row names before the rest go behind the ellipsis.
 *
 * Two, because the row is one line of a table in a narrow pane and a real name
 * is wider than the pseudonym it replaced. This is a display width, not a
 * judgement about how many absences matter — nothing is dropped, and the
 * control beside them opens the rest in place.
 */
const MISSING_NAMED = 2;

/**
 * What to ask the professor for, when a piece of work has no dates.
 *
 * Two dates cannot be looked up, because they do not exist anywhere yet — so
 * the prompt opens by saying so, waives the preset's usual validate-and-inbox
 * sweep on purpose rather than leaving the model to disobey it by accident,
 * and names the record to edit afterwards. A model handed a vaguer version of
 * this spent half a dozen tool calls hunting for an answer that was only ever
 * in the professor's head.
 *
 * `source_file` is resolved by the host, which greps the run's own assessment
 * files for the id rather than guessing a filename. Without a host that does
 * that — a chat client — the prompt says to grep, because naming the wrong
 * file is worse than naming none: the model will helpfully create it.
 */
/**
 * What to ask for when there is nothing to grade a piece of work with.
 *
 * Unlike a date, this is not a question with a two-line answer, so the button
 * does not pretend to fix it — it starts the conversation that does, by name.
 * It does not prescribe WHICH of items or criteria is wanted either: the
 * assessment's type decides that, the model knows the type, and a prompt that
 * demanded a rubric for a multiple-choice quiz would be wrong half the time.
 * What it does pin down are the two things a model gets wrong unprompted —
 * use the outcomes the assessment already declares, and leave a draft.
 */
function gradingPrompt(run, a) {
  return 'Run /design-assessment for ' + a.assessment_id + ' ("' + a.title + '") in '
    + run.id + '. It has no rubric criteria and no items, so nothing can grade it '
    + '— not me and not you. Draft whatever its type needs: items for a quiz or '
    + 'an exam, criteria for work a person reads. Work against the outcomes the '
    + 'assessment already declares, and leave the result as drafts for me to '
    + 'approve rather than writing into courses/.';
}

function datePrompt(run, a) {
  return 'Ask me this now, in your first message, before running any command: '
    + 'what are the open and due dates for ' + a.assessment_id + ' ("' + a.title
    + '")? Skip the usual opening validate and inbox sweep, and do not read any '
    + 'file first: these two dates exist only in my head, so nothing on disk can '
    + 'answer this. Once I have answered, set opens_at and due_at on the '
    + a.assessment_id + ' entry in '
    + (a.source_file || 'the assessment record for ' + run.id
        + ' (grep for the id: the filename is not fixed)')
    + ', and then just confirm what you wrote. Do not work out which week the '
    + 'dates fall in; the Course pane places them itself and shows it.';
}

function view(d) {
  const run = d.run || {};

  // A student as a person, where the host could say who that is.
  //
  // `people` maps pseudonym to name and is present ONLY on the professor's own
  // pane, which resolves it against the private roster on the same machine and
  // serves the document over loopback. The MCP payload has no such field, so a
  // chat client running this same view falls back to the pseudonym — which is
  // what the course record holds and what `whois`, the gradebook and a bug
  // report all use.
  const people = d.people || {};
  const who = function (id) { return people[id] || id; };
  const pending = d.pending_evaluations || {};
  const parts = [];

  const byAssessment = (pending.by_assessment || []).map(function (a) {
    return '<tr><td class="name">' + esc(a.title) + '<small>' + esc(a.assessment_id)
      + '</small></td><td class="n">' + esc(a.pending) + '</td>'
      + '<td class="n">' + esc(a.low_confidence) + '</td>'
      + '<td><button class="ask" data-ask="For ' + esc(run.id) + ' '
      + esc(a.assessment_id) + ', show me what is still to grade with the '
      + 'pending_judgements tool.">show</button></td></tr>';
  }).join('');
  parts.push('<h2>Awaiting your decision</h2>' + (byAssessment
    ? '<div class="scroll"><table><thead><tr><th>Assessment</th><th class="n">Pending</th>'
      + '<th class="n">Low confidence</th><th></th></tr></thead><tbody>'
      + byAssessment + '</tbody></table></div>'
    : '<p class="empty">Nothing pending.</p>'));

  // Work that cannot run yet, and what each piece is short of.
  //
  // First, above grading, because it is the only thing on this page blocking
  // students rather than waiting on a judgement: an assignment with no date has
  // not been set, and one with no rubric cannot be marked by anybody.
  //
  // The Checklist counts these too, and that is not the same answer twice. The
  // Checklist is a survey of what the whole course is still missing and offers
  // no action; these rows carry the controls. What a control cannot honestly
  // close, it does not claim to: a date is one question and the button asks it,
  // a rubric is a piece of work and the button starts it, and a weight is
  // neither — it is a property of the whole scheme, so it is reported here and
  // fixed on the Grading policy tab.
  //
  // "Nothing to grade with" is BOTH counts at zero, never one of them. Ten of
  // this course's quizzes carry eight items and no rubric, which is exactly
  // right for a quiz — reporting them as unfinished would have been the same
  // class of mistake as telling a professor their class was late for a deadline
  // nobody had set.
  //
  // `=== 0` rather than `!`: a payload from an older server carries neither
  // field, and a blank is not a zero. Better to say nothing about how a thing
  // is marked than to invent a hole in it.
  const nothingToGradeWith = function (a) { return a.criteria === 0 && a.items === 0; };
  const unready = (d.assessments || []).filter(function (a) {
    return !a.due_at || a.weight == null || nothingToGradeWith(a);
  });
  if (unready.length) {
    const rows = unready.map(function (a) {
      const gaps = [];
      if (!a.due_at) gaps.push('no date');
      if (a.weight == null) gaps.push('no weight');
      if (nothingToGradeWith(a)) gaps.push('nothing to grade with');
      const buttons = [];
      if (!a.due_at) {
        buttons.push('<button class="ask" data-ask="' + esc(datePrompt(run, a))
          + '">set dates</button>');
      }
      if (nothingToGradeWith(a)) {
        buttons.push('<button class="ask" data-ask="' + esc(gradingPrompt(run, a))
          + '">design</button>');
      }
      return '<tr><td class="name">' + esc(a.title)
        + '<small>' + esc(a.assessment_id) + (a.type ? ' · ' + esc(a.type) : '')
        + '</small></td>'
        + '<td><small class="flag">' + gaps.map(esc).join(' · ') + '</small></td>'
        + '<td>' + buttons.join(' ') + '</td></tr>';
    }).join('');
    parts.push('<h2>Not ready to run</h2>'
      + '<div class="scroll"><table><thead><tr><th>Assessment</th><th>Missing</th>'
      + '<th></th></tr></thead><tbody>' + rows + '</tbody></table></div>');
  }

  // Undated work is deliberately not here. It has its own section above, and a
  // piece of work nobody has assigned cannot have submissions outstanding —
  // listing it as `0 / 74` said the class was behind on something it had never
  // been given.
  const missing = (d.assessments || []).filter(a => a.status !== 'undated'
    && ((a.missing || []).length || a.submissions_received < a.enrolled));
  if (missing.length) {
    const rows = missing.map(function (a) {
      // Who is missing, without the row growing to hold a class.
      //
      // Thirty pseudonyms of fourteen characters is four hundred characters in
      // one cell, and it was the widest thing on the page in a pane six hundred
      // pixels across — every other assessment pushed off the bottom by the
      // one nobody had handed in. The count in the next column already answers
      // "how many"; what the names add is WHICH, and the first few answer that
      // as well as all of them do.
      //
      // The rest stay in the tooltip rather than behind a control: the full
      // list is real data the payload carries, an inbox is read at a glance,
      // and a widget with no state of its own has nowhere to put an expanded
      // row. Hovering is the cheapest thing that does not lose it.
      const gone = (a.missing || []).map(who);
      const rest = gone.slice(MISSING_NAMED);
      const late = gone.length
        ? '<small class="flag">missing: '
          + esc(gone.slice(0, MISSING_NAMED).join(', '))
          // The rest are in the document, hidden, rather than fetched on press:
          // the payload already carries them, the widget has no way to ask for
          // more, and a control that cannot fail is worth the few hundred bytes.
          //
          // The button comes BEFORE the tail and the tail opens as its own
          // block, so the control does not move when it is pressed. It was the
          // other way round first — the tail inline, the button after it — and
          // opening a class of thirty pushed the way to close it three lines
          // down and off to the right, which makes an expand a one-way door.
          + (rest.length
              ? '<button class="rest" type="button" data-restbtn'
                + ' aria-expanded="false" title="show all '
                + esc(gone.length) + '">…</button>'
                + '<span data-rest hidden>' + esc(rest.join(', ')) + '</span>'
              : '')
          + '</small>'
        : '';
      return '<tr><td class="name">' + esc(a.title) + '<small>' + esc(a.assessment_id)
        + '</small>' + late + '</td><td>' + esc(a.status) + '</td>'
        + '<td class="n">' + esc(a.submissions_received) + ' / ' + esc(a.enrolled) + '</td>'
        + '<td class="n">' + (a.due_at ? esc(a.due_at.slice(0, 10)) : '\u2014') + '</td></tr>';
    }).join('');
    parts.push('<h2>Submissions outstanding</h2><div class="scroll"><table><thead><tr>'
      + '<th>Assessment</th><th>Status</th><th class="n">In</th><th class="n">Due</th>'
      + '</tr></thead><tbody>' + rows + '</tbody></table></div>');
  }

  const signals = (d.open_signals || []).map(function (s) {
    return '<tr><td class="name">' + esc(s.description) + '<small>' + esc(s.signal_id)
      + ' \u00b7 ' + esc(s.type) + '</small></td>'
      + '<td class="' + (s.severity === 'high' ? 'sev-high' : '') + '">'
      + esc(s.severity) + '</td><td>' + esc(who(s.student_id)) + '</td>'
      + '<td><button class="ask" data-ask="In ' + esc(run.id) + ', what should I do '
      + 'about signal ' + esc(s.signal_id) + ' for ' + esc(s.student_id)
      + '?">advise</button></td></tr>';
  }).join('');
  if (signals) {
    parts.push('<h2>Open signals</h2><div class="scroll"><table><thead><tr>'
      + '<th>Signal</th><th>Severity</th><th>Student</th><th></th></tr></thead><tbody>'
      + signals + '</tbody></table></div>');
  }

  const interventions = (d.interventions_awaiting_approval || []).map(function (i) {
    return '<li>' + esc(i.intervention_id || i.id || '') + ' \u2014 '
      + esc(i.description || i.summary || i.type || '') + '</li>';
  }).join('');
  if (interventions) {
    parts.push('<h2>Interventions to approve</h2><ul class="blocked">'
      + interventions + '</ul>');
  }

  return '<h1>' + esc(run.title) + ' \u2014 what needs you</h1>'
    + '<p class="sub">' + esc(run.id) + ' \u00b7 as of ' + esc(d.as_of)
    + ' \u00b7 ' + esc(run.enrolled_students) + ' students \u00b7 '
    + esc(pending.total || 0) + ' judgement(s) pending</p>'
    + parts.join('')
    + '<div class="note"><strong>Approval is yours.</strong> This window reads the '
    + 'course model and cannot approve, grade or send anything. When a draft is '
    + 'ready, the command is '
    + '<code>ainar approve work/' + esc(run.id) + ' --as USER-ARD-A01</code>.'
    + '</div>';
}
