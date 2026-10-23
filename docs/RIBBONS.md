# The ribbons over each place — a review

A UX review, written 2026-10-23, of the bars across the top of course mode:
the **header** (one row, the same on every place) and the **place bar** under
it (the sub-views and toggles of one place). Measured in the running harness
on CSS-4007, at 1440 and 1280 px wide, after E37's Today and Sync landed.
Companion to [`PROFESSOR-JOURNEY.md`](PROFESSOR-JOURNEY.md) §10, whose rule
it applies: every action has one home, and a control belongs where it acts.

---

## 1 · What is there now

The header carries 13 controls on every one of the ten places:

```
[Place title] Planning Teaching Evidence All weeks ··· Record [+ drafts] (Preview as student) [Cv GS GH Tr Canvas: partly set up · more ▾] Publish Upload Chat ×
```

The place bar, under it, differs by place:

| Place | Place bar today | Toggles that act on it | Toggles shown in the header that do **not** |
| --- | --- | --- | --- |
| Today | — | — | readings ×4, Record / + drafts |
| Weeks | — (its readings are in the header) | readings, drafts, Preview as student | — |
| Tasks | Pending · Ready · Checklist · Unpublished · Names | drafts, Names | readings ×4 |
| Students | Names | Names | readings ×4, Record / + drafts |
| Gradebook | — (its own tabs sit inside the body: Last changes · All · Grades · Sheet · Policy) | drafts, **names (no toggle shown)** | readings ×4 |
| Concepts | — | drafts | readings ×4 |
| Materials | Assessments · Slides · Exams · Grading policy · Student's outline | drafts | readings ×4 |
| Files | — | — | readings ×4, Record / + drafts |
| Sync | Names | Names | readings ×4, Record / + drafts |
| Course settings | Integrations · Preferences · Names (Accounts is a button in the body) | Names | readings ×4, Record / + drafts |

---

## 2 · Findings, worst first

**R1 · The header breaks at laptop width.** At 1280 px it wraps to two rows
(79 px): Upload, Chat and × fall under the place title. At 1440 px it fits
with 65 px to spare. Nothing collapses; nothing has a priority. The biggest
item is the connections chip at 248 px. *Severity: high — the close button
and Chat move about.*

**R2 · Names are shown in the Gradebook with no Names / Pseudonyms switch.**
The Gradebook follows the pane's choice (it is passed `names`), but the
switch is not drawn there, so a professor projecting the Gradebook sees full
names (the Last changes list names students) and has to leave the place to
hide them. The `named` list in `client/materials.js` leaves Gradebook out.
Concepts will need the same once it is a concept × student grid (HOME-8).
*Severity: high — privacy in a room with a projector (E13).*

**R3 · The Weeks readings live in the global header.** Planning · Teaching ·
Evidence · All weeks are the sub-views of one place, but sit on all ten. On
Today, Students or Sync they are four unpressed buttons that leave the place
— "the way back to the weeks", as the code says, which the navigator now
does. Materials and Tasks put their sub-views in the place bar; Weeks
should too. *Severity: medium — 300 px of the header spent on one place.*

**R4 · Record / + drafts is shown where it does nothing.** It changes Weeks,
Concepts, Materials, Gradebook and Tasks; on Today, Students, Files, Sync
and Course settings it is a live-looking switch with no effect. It is on by
default, and every place it affects opens with the same paragraph-long
banner. The switch is two buttons for one boolean, and does not say how many
drafts there are (1,660 on CSS-4007). *Severity: medium.*

**R5 · The connections chip says the same thing on every screen.**
"Canvas: partly set up" (8 of 17 assessments linked) is a fact for Course
settings, not a status for the whole session. Since E37, Today's sync strip
and the Sync place say how each service stands; the chip is the third place
to say it, and the widest control in the header. *Severity: medium.*

**R6 · The place bar is not one pattern.** Weeks' sub-views are in the
header; Gradebook's are inside the body as a second tab row; Course
settings' Accounts is a button inside Integrations; Tasks, Materials and
Settings use the place bar. Students and Sync have a place bar holding only
the Names switch, right-aligned. A professor cannot learn where "the other
views of this place" are. *Severity: medium.*

**R7 · Preview as student appears and disappears.** It is drawn only on
Weeks (not under Teaching or Evidence), so the controls to its right shift
by its width between places. *Severity: low — it belongs to Weeks, which
fixes itself under R3.*

**R8 · Publish and Upload look alike, and only one leaves the machine.**
Both are outline buttons, side by side. Publish changes what students see;
Upload brings files in. Upload is most used from Files and an assessment's
scans slot, where it already appears. *Severity: low.*

**R9 · The title repeats the navigator and drops the context.** "Weeks" with
Planning pressed; the composer below says "Weeks · Planning", the header
does not. On Today the header could carry the date and week the band
already knows. *Severity: low.*

**R10 · × closes to an empty chat.** Since E37 an empty chat opens on Today,
so closing course mode in a new chat shows the blank page Today replaced.
Escape does the same (noted under HOME-2). *Severity: low.*

---

## 3 · The proposal

Two rows, each with one job.

```
Header — the session, same on every place
[Place · sub-view]                     [● status, only when something is wrong]  Publish  Chat  ×

Place bar — this place only
[sub-views of this place …]                          [toggles that act on this place]
```

- **Header:** the place and its sub-view as the title; a status dot that
  appears only when a service needs attention and opens Sync or settings;
  Publish (the one outward action, styled as such); Chat; ×. Upload moves to
  Files and to the assessment, where it already is, and stays in the
  command field (HOME-12). Nothing else.
- **Place bar:** left, the place's own sub-views; right, only the toggles
  that change this place. Drafts as one switch with its count — *Drafts
  · 1,660* — on the places it changes; the banner shown once, then folded.
  Names / Pseudonyms on every place that shows a person.
- **Narrow windows:** the header keeps title, Publish, Chat, × and folds the
  status into the dot; the place bar scrolls sideways rather than wrapping.

Per place:

| Place | Place bar · left | Place bar · right |
| --- | --- | --- |
| Today | — | — (the date and week go in the title: *Today · Fri 23 Oct · week 8*) |
| Weeks | Planning · Teaching · Evidence · All weeks | Drafts · n, Preview as student |
| Tasks → Waiting (HOME-13) | Pending · Ready · Checklist · Unpublished | Drafts · n, Names |
| Students | — | Names |
| Gradebook | Grades · Sheet · Policy · Last changes (out of the body) | Drafts · n, **Names** |
| Concepts | By concept · By student · By week (HOME-8/9) | **Names** |
| Materials | Assessments · Slides · Exams · Grading policy · Student's outline | Drafts · n |
| Files | — | — |
| Sync | — | Names |
| Course settings | Integrations · Accounts · Preferences (Accounts out of the body) | Names |

What this costs: R3 and R6 change where three places keep their sub-views
(Weeks, Gradebook, Course settings), which moves code in
`client/materials.js`, `client/gradebook.js` and `client/integrations.js`;
the rest is the header in `client/materials.js` alone. R2 is one line and
should not wait for the rest.

## 4 · Order

1. ~~**R2** — Names on Gradebook (one line in `named`), now.~~ **Done
   2026-10-23.** Pseudonyms on the Gradebook was checked to replace every
   name with its code.
2. ~~**R1 + R5** — the header fits: status chip to a dot, Upload out, no
   wrap.~~ **Done 2026-10-23.** The connections chip is its coloured marks
   and a waiting count (248 → 108 px); its words are the tooltip. Upload left
   the header for Files and the scans slot. The readings and the drafts
   switch sit in a middle group that scrolls sideways (thin scrollbar) when
   the window is narrow, so the header is one 43 px row at 1440, 1280 and
   1100 px, with Chat and × always in place.
3. ~~**R3 + R7 + R9** — Weeks' readings into its place bar; title carries the
   sub-view.~~ **Done 2026-10-23.** Weeks has a place bar — Planning ·
   Teaching · Evidence · All weeks, and Preview as student at its right end,
   so hiding it on Teaching moves nothing. The header is the same six
   controls on every place. The title reads *Weeks · Teaching*, *Materials
   · Slides*, *Course settings · Integrations*, *Today · Fri, Oct 23*, and
   the composer says the same. Without the navigator (the stock browser in
   the seat) the readings stay in the header, the only row there is.
4. **R4** — drafts as one counted switch, on its five places only.
5. **R6** — Gradebook's and Course settings' sub-views into the place bar.
6. **R8, R10** — Publish styled as outward; × and Escape return to Today.
