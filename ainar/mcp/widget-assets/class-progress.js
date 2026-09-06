function view(d) {
  const students = d.students || [];
  const totals = d.totals || {};
  const head = students.map(s => '<th class="cell">' + esc(s) + '</th>').join('');

  const rows = (d.concepts || []).map(function (c) {
    const cells = (c.cells || []).map(function (cell) {
      const shown = pct(cell.proportion);
      const tip = shown == null
        ? 'never assessed \u2014 not a low score'
        : cell.evidence + ' piece(s) of evidence';
      return '<td class="cell ' + band(cell.proportion) + '" title="' + esc(tip) + '">'
        + (shown == null ? '\u00b7' : esc(shown)) + '</td>';
    }).join('');
    const prereqs = (c.prerequisites || []).length
      ? '<small>after ' + esc((c.prerequisites || []).join(', ')) + '</small>' : '';
    const mean = pct(c.class_mean);
    return '<tr><td class="name">' + esc(c.title) + prereqs + '</td>' + cells
      + '<td class="cell"><strong>' + (mean == null ? '\u2014' : esc(mean)) + '</strong></td>'
      + '<td class="n">' + esc(c.coverage) + '</td>'
      + '<td><button class="ask" data-ask="In ' + esc(d.run.id) + ', what does the evidence '
      + 'say about ' + esc(c.title) + '? Use the class_progress and student tools.">why?'
      + '</button></td></tr>';
  }).join('');

  const legend = BANDS.map(function (b, i) {
    const labels = ['strong', 'secure', 'mixed', 'weak', 'very weak'];
    return '<span><i class="swatch ' + b[1] + '"></i>' + labels[i] + '</span>';
  }).join('') + '<span><i class="swatch nil"></i>never assessed</span>';

  const uncovered = totals.concepts_with_no_evidence || [];
  const gap = uncovered.length
    ? '<div class="note"><strong>' + uncovered.length + ' concept(s) with no evidence '
      + 'at all:</strong> ' + esc(uncovered.join(', ')) + '. Nothing has assessed these, '
      + 'so the blank is a gap in the assessment plan rather than in the class.</div>'
    : '';

  const caps = (d.capabilities || []).map(function (cap) {
    const cells = (cap.cells || []).map(c => '<td class="cell">'
      + (c.level == null ? '\u00b7' : esc(c.level)) + '</td>').join('');
    return '<tr><td class="name">' + esc(cap.title)
      + '<small>of ' + esc(cap.max_level) + '</small></td>' + cells + '</tr>';
  }).join('');

  return '<h1>' + esc(d.run.title) + ' \u2014 class progress</h1>'
    + '<p class="sub">' + esc(d.run.id) + ' \u00b7 ' + esc(totals.students)
    + ' students \u00b7 ' + esc(totals.concepts) + ' concepts \u00b7 '
    + esc(totals.evidence) + ' pieces of evidence</p>'
    + '<div class="scroll"><table><thead><tr><th>Concept</th>' + head
    + '<th class="cell">Class</th><th class="n">Covered</th><th></th></tr></thead>'
    + '<tbody>' + rows + '</tbody></table></div>'
    + '<div class="legend">' + legend + '</div>'
    + gap
    + (caps ? '<h2>Capabilities</h2><div class="scroll"><table><thead><tr>'
        + '<th>Capability</th>' + head + '</tr></thead><tbody>' + caps
        + '</tbody></table></div>' : '')
    + '<div class="note">A blank cell means the concept was never assessed for that '
    + 'student, which is <strong>not</strong> a low score. Students are pseudonyms; '
    + 'resolve one with <code>ainar roster whois</code> outside this window.</div>';
}
