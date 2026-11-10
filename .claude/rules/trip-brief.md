---
paths: ["tool/**", "tests/**"]
---
# The trip brief (tool/brief.js)

- The hand-off to TripDeputy is TripDeputy's own share-link format
  (`/plan/#trip=t1.` + base64url JSON with `v: 1`). Never invent a second
  format; if TripDeputy's changes, refresh `tests/tripdeputy/` with
  `bash tests/sync-tripdeputy.sh ../trip-deputy` and the contract tests say
  what broke. Do not edit trip-deputy from this repo.
- Never guess a length or a date. Unreadable words travel as words in the
  constraints, and the page says TripDeputy starts at its default.
- `tests/page.test.mjs` loads Playwright with `createRequire`, because a
  globally installed package is found through NODE_PATH, which ES module
  imports ignore.
- The link must refresh synchronously on a click in the form: a deferred
  refresh left it one chip behind, and the page test caught it.
