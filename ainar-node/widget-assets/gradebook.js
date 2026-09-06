function view(d) {
  const all = d.assessments || [];
  if (!all.length) return '<p class="empty">No assessments counted in this run.</p>';

  const picked = state().picked;
  const current = all.find(a => a.assessment_id === picked) || all[0];

  const tabs = all.map(function (a) {
    return '<button data-pick="' + esc(a.assessment_id) + '" aria-pressed="'
      + (a.assessment_id === current.assessment_id) + '">' + esc(a.title) + '</button>';
  }).join('');

  const s = current.summary || {};
  const stats = [
    ['enrolled', s.enrolled], ['submitted', s.submitted], ['graded', s.graded],
    ['part-graded', s.partially_graded], ['not submitted', s.not_submitted],
    ['exportable', s.exportable], ['mean', pctWhole(s.mean)], ['median', pctWhole(s.median)]
  ].filter(p => p[1] != null && p[1] !== '')
   .map(p => esc(p[0]) + ' ' + esc(p[1])).join(' \u00b7 ');

  const rows = (current.rows || []).map(function (r) {
    const blocked = (r.blocked || []).length
      ? '<ul class="blocked">' + r.blocked.map(b => '<li>' + esc(b) + '</li>').join('')
        + '</ul>' : '';
    return '<tr><td class="name">' + esc(r.student_id) + blocked + '</td>'
      + '<td>' + esc(r.status.replace(/_/g, ' ')) + '</td>'
      + '<td class="n">' + (r.score == null ? '\u00b7' : esc(r.score)) + '</td>'
      + '<td class="n">' + (r.maximum == null ? '' : esc(r.maximum)) + '</td>'
      + '<td class="n">' + (r.percent == null ? '\u00b7' : esc(pctWhole(r.percent))) + '</td>'
      + '<td class="' + (r.exportable ? '' : 'flag') + '">'
      + (r.exportable ? 'yes' : 'no') + '</td></tr>';
  }).join('');

  const crit = (current.criteria || []).map(function (c) {
    return '<tr><td class="name">' + esc(c.title) + '<small>' + esc(c.criterion_id)
      + '</small></td><td class="n">' + esc(c.maximum) + '</td>'
      + '<td>' + esc(c.outcome_id || '\u2014 none, so it yields no evidence') + '</td></tr>';
  }).join('');

  const issues = (current.issues || []).length
    ? '<div class="note"><strong>Issues on this assessment:</strong> '
      + esc(current.issues.join('; ')) + '</div>' : '';

  return '<h1>' + esc(d.run.title) + ' \u2014 gradebook</h1>'
    + '<p class="sub">' + esc(d.run.id) + ' \u00b7 ' + esc(d.generated_by)
    + ' \u00b7 from approved professor decisions only'
    + (d.allow_partial ? ' \u00b7 part-graded rows treated as exportable' : '') + '</p>'
    + '<div class="tabs">' + tabs + '</div>'
    + '<p class="sub">' + esc(current.title) + ' \u00b7 ' + esc(current.type)
    + ' \u00b7 weight ' + esc(current.weight) + ' \u00b7 out of ' + esc(current.maximum)
    + (current.due_at ? ' \u00b7 due ' + esc(current.due_at.slice(0, 10)) : '') + '</p>'
    + '<p class="sub">' + stats + '</p>'
    + issues
    + '<div class="scroll"><table><thead><tr><th>Student</th><th>Status</th>'
    + '<th class="n">Score</th><th class="n">Out of</th><th class="n">%</th>'
    + '<th>Export</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
    + (crit ? '<h2>Criteria</h2><div class="scroll"><table><thead><tr><th>Criterion</th>'
        + '<th class="n">Max</th><th>Outcome</th></tr></thead><tbody>' + crit
        + '</tbody></table></div>' : '')
    + '<div class="note">A blank score is unmarked or not submitted, never a zero. '
    + 'Rows marked <strong>no</strong> under Export say why on the student row. '
    + 'Nothing here is sent anywhere \u2014 <code>ainar lms push</code> is the '
    + 'professor\u2019s command, and this window cannot run it.'
    + '<button class="ask" data-ask="For ' + esc(d.run.id) + ' '
    + esc(current.assessment_id) + ', which rows are blocked from export and what '
    + 'would fix each one?">explain the blocks</button></div>';
}
