# Professor LMS Publishing Skills

This plugin deliberately separates preparation from the external write:

```text
course artifact -> local publication manifest -> preview -> explicit approval -> provider API
```

A profile name is resolved in the **shared connections registry** first —
`AINAR_CONNECTIONS`, else `~/.ainar/connections.json`, which `ainar
connections` owns and which every outbound target now reads. That registry
holds no secrets: a connection names the environment variable its token lives
in, and a literal `token` found there is refused rather than used.

If the name is not in the registry, the older profiles file is read:
`--connections`, then `PROFESSOR_CONNECTIONS`, then
`~/.professor/connections.json`. That file is unchanged and still honours a
literal `token`, so nothing that works today stops working — but a token in a
file that gets backed up and synced should be treated as exposed. `ainar
connections migrate` reports one and deliberately does not copy it forward.

Tokens never appear in plans or error messages, and are resolved only when a
network operation starts. When a profile names no `tokenEnv`, the
`AINAR_`-prefixed variable is tried before the bare one this package shipped
with (`AINAR_CANVAS_TOKEN`, then `CANVAS_TOKEN`).

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
