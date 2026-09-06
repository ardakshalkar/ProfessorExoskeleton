# Professor LMS Publishing Skills

This plugin deliberately separates preparation from the external write:

```text
course artifact -> local publication manifest -> preview -> explicit approval -> provider API
```

`prof-publish` reads JSON connection profiles from `--connections`, then
`PROFESSOR_CONNECTIONS`, then `~/.professor/connections.json`. Secret values
may be stored directly, but `tokenEnv` is preferred and is resolved only when a
network operation starts. Tokens never appear in plans or error messages.

See `connections.example.json` for profile fields. A publication manifest has:

```json
{
  "kind": "announcement",
  "title": "Week 4 materials",
  "content": "<p>The materials are now available.</p>",
  "courseId": "42"
}
```

Canvas supports `announcement` and `page`. Telegram supports `message` (also
accepting `announcement`) and `document`. Moodle announcements use the standard
`mod_forum_add_discussion` function and need `forumId`. Other Moodle content can
use a site-provided `wsFunction` accepting `courseid`, `title`, `content`, and
`kind`.
