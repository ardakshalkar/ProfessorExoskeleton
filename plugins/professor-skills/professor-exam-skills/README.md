# Professor Exam Skills

Two skills for creating assessments without turning every request into an
instructional-design project.

- `make-exam` completes ordinary work: a question, quiz, exam, answer key,
  rubric, or equivalent variants.
- `design-exam` creates a defensible blueprint when the assessment is
  high-stakes, complex, or should be approved before questions are written.

The default path is intentionally light. There is no CLI, dependency install,
hook, database requirement, or mandatory research pass.

## Core design

```text
course evidence -> compact blueprint -> questions -> key and rubric -> checks
                                      \-> equivalent variants
                                      \-> future AI grading
```

For one or two questions, the blueprint remains in the response and no YAML is
created. For a complete exam, the durable package is normally:

```text
<name>-exam.md
<name>-key.md
<name>-spec.yaml
```

The specification is the shared contract. It keeps the exact question,
solution expectations, rubric, outcomes, variant metadata, acceptable methods,
and common errors together so later grading does not have to reconstruct them.

## What is deliberately absent in v0.1

- rendering and PDF generation;
- OCR and handwritten-answer grading;
- a command-line application;
- psychometric analysis;
- network research unless the user asks for it.

Those can be added as separate capabilities once the creation workflow is
proven useful.
