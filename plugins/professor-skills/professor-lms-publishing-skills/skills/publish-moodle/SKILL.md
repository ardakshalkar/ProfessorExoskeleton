---
name: publish-moodle
description: Preview and publish professor-approved course content through a configured Moodle web-service function. Use when the user asks to post or publish teaching content to Moodle; do not use for grades, submissions, or student records.
---

# Publish to Moodle

Use the bundled `prof-publish` CLI. For `announcement`, configure the course's
announcements forum as `forumId`; the CLI calls Moodle's standard
`mod_forum_add_discussion` function. Other kinds require profile `wsFunction`;
that site-provided function must accept `courseid`, `title`, `content`, and
`kind`.

1. Identify the profile and course. For an announcement, also identify the
   announcements forum instance. For other content, confirm the configured
   function's contract. Keep identified student information out of the manifest.
2. Prepare JSON with `kind`, `content`, optional `title`, and optional `courseId`.
3. Run `prof-publish plan --profile NAME --input FILE` and review the course,
   function, kind, and title with the professor.
4. Only after explicit approval for that artifact, run
   `prof-publish publish --profile NAME --input FILE --confirm`.
5. Report the remote ID/URL. Never retry an ambiguous write automatically.

Use `prof-publish doctor --profile NAME` to verify the token and Moodle service
through the read-only `core_webservice_get_site_info` function.
