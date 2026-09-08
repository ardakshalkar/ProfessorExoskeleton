function view(d) {
  const run = d.run || {};
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

  const missing = (d.assessments || []).filter(a => (a.missing || []).length
    || a.submissions_received < a.enrolled);
  if (missing.length) {
    const rows = missing.map(function (a) {
      const late = (a.missing || []).length
        ? '<small class="flag">missing: ' + esc(a.missing.join(', ')) + '</small>' : '';
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
      + esc(s.severity) + '</td><td>' + esc(s.student_id) + '</td>'
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
