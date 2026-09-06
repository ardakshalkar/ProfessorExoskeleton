# Professor Student Assessment Skills

This plugin keeps four states distinct:

```text
student work -> evidence -> AI suggestion -> professor decision -> feedback
```

The first three may be prepared by an agent. Only the professor owns the
decision. `prof-assess` therefore has `check`, `summary`, and `audit` commands,
but deliberately has no approval, mutation, database-write, or LMS command.

## CLI

Pass a public/internal rubric as a file and restricted evaluations through
stdin:

```sh
get-evaluations | prof-assess check --rubric rubric.json
get-evaluations | prof-assess summary --rubric rubric.json
get-evaluations | prof-assess audit --rubric rubric.json --confidence 0.8
```

Input may be one evaluation, an array, or `{ "evaluations": [...] }`. Summary
totals use only stamped `approved` or `overridden` professor decisions. AI
suggestions are never aggregated into a student grade.
