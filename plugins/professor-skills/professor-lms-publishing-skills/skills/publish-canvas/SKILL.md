---
name: publish-canvas
description: Preview and publish professor-approved course announcements or pages through the Canvas LMS API. Use when the user asks to post or publish teaching content to Canvas; do not use for grades, submissions, or student records.
---

# Publish to Canvas

Use the bundled `prof-publish` CLI. Publishing is an external write and requires
the professor's explicit instruction for this specific artifact.

1. Identify the connection profile and course. Do not place student names,
   grades, submissions, or private feedback in the publication manifest.
2. Prepare JSON with `kind` (`announcement` or `page`), `title`, `content` as
   Canvas-safe HTML, and optionally `courseId`. For a page, `published` defaults
   to `true`.
3. Run `prof-publish plan --profile NAME --input FILE` and show the destination,
   kind, title, and publication state to the professor.
4. Only when the professor explicitly approves sending that artifact, run
   `prof-publish publish --profile NAME --input FILE --confirm`.
5. Report the returned remote ID and URL. On ambiguity, timeout, or transport
   failure, stop; never retry a write automatically because it may have succeeded.

Use `prof-publish doctor --profile NAME` for an authenticated, read-only
connection check.
