---
name: make-exam
description: Create an exam, quiz, test, individual assessment question, answer key, rubric, or equivalent variants at the depth the request needs. Use when a professor asks to make assessment content and has not explicitly asked only for a blueprint or formal design review. Small requests are completed directly; full exams receive a compact specification and quality checks.
---

# Make an exam

Complete the smallest workflow that produces a trustworthy result. Do not turn
one question into a multi-file project.

## 1. Choose the route

| Route | Use when | Produce |
| --- | --- | --- |
| **QUICK** | one to three items, a short quiz, a rubric, or an edit | only what was requested |
| **STANDARD** | a complete quiz, midterm, final, or several variants | exam, key, compact specification |
| **ASSURANCE** | high-stakes, accreditation, five or more variants, approval-first, or explicit deep design | use `design-exam` before writing questions |

An explicit request for quick, standard, deep, or approval first wins. Otherwise
QUICK applies to a small artifact and STANDARD to a complete assessment.

Do not browse for generic assessment theory. Browse only when the user asks for
research or when current external rules or source material are necessary.

## 2. Ground the work

Use, in order:

1. course materials or outcomes the professor supplied;
2. course data available in the current project;
3. clearly labelled assumptions.

Do not invent course outcomes, policies, required topics, or source claims. If a
missing fact would only tune the result, choose a reasonable default and state it
briefly. Ask only when different answers would materially change the assessment.

## 3. QUICK

Write the requested item immediately. Include only the components that make it
usable:

- student-facing prompt;
- marks and a realistic time estimate;
- answer or solution expectations;
- criterion-level marking guidance when partial credit is possible.

For a selected-response item, explain why the keyed answer is correct and why
each distractor is plausible but wrong. For a constructed-response item, reward
reasoning rather than only the final answer.

No outline file, specification file, approval gate, or research pass.

## 4. STANDARD

Create a compact blueprint in memory before writing. It needs only:

- assessment purpose, duration, total marks, and permitted resources;
- outcome/topic weights;
- question roles, marks, estimated minutes, and evidence sought;
- intended performance range.

Then write, unless the user requested another format:

```text
<name>-exam.md
<name>-key.md
<name>-spec.yaml
```

Use this skill's packaged assets. Copy or adapt
`assets/exam-package.md` for the student paper and key, and
`assets/exam-spec.yaml` for the machine-readable contract.

The specification is concise but must connect every question to:

- its learning outcome or stated topic;
- marks and expected time;
- evidence expected from the student;
- solution expectations and rubric criteria;
- acceptable alternative methods;
- common errors and follow-through policy;
- question family and instance identifiers when variants exist.

Do not expose the key, rubric, hidden metadata, or variant-generation slots in
the student paper.

## 5. Performance levels

Default to one exam that contains opportunities to demonstrate increasing
levels of performance. Do not create separate “easy students” and “strong
students” papers unless policy requires them.

Use D/C/B/A or another local scale as evidence descriptors, not labels pasted
onto questions:

- **D:** execute a familiar method or identify a core idea;
- **C:** apply and explain in a familiar context;
- **B:** select, connect, or justify under meaningful constraints;
- **A:** transfer, evaluate, design, or defend in a less familiar context.

Match these descriptors to the actual course standard when one is supplied.

## 6. Equivalent variants

Generate variants from a shared question family, never by paraphrasing one item
repeatedly. Keep invariant:

- outcome and evidence sought;
- reasoning steps and decision count;
- marks, rubric, time, resources, and scaffolding;
- ambiguity and computational burden.

Vary only declared slots such as values, datasets, stimuli, or context. Solve
every instance before calling variants equivalent. Record the family and
instance IDs in the specification, not on the student paper unless needed for
administration.

## 7. Check before handoff

Read `references/quality-checks.md` and run the proportional checklist.
At minimum verify:

- totals and timing;
- alignment and coverage;
- independent solvability;
- clear wording and sufficient data;
- key/rubric consistency;
- no leaked answers;
- variant equivalence, when applicable.

Fix clear defects. Report material assumptions and any concern that needs the
professor's judgment. Do not claim an exam is validated by students unless it
has actually been piloted or analyzed.

## Rules

- Start from evidence students must produce, not from a target number of items.
- The student paper and answer key are separate artifacts.
- Marks measure demonstrated competence; they are not decoration after writing.
- Preserve partial credit and error-carried-forward where appropriate.
- Use the original answer image as well as transcription in any future
  handwritten-grading workflow.
- Do not include real student data in generated examples or filenames.
- Say what was generated and what was assumed.
