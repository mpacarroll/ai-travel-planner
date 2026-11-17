# TripDeputy's trip model, pinned for the contract tests

Read-only copies of `src/lib/{trip,share,saved,costs}.js` from
[trip-deputy](https://github.com/mpacarroll/trip-deputy) at commit `e9b3ff9`
(main, 2026-11-09). `tests/brief.test.mjs` runs the brief this page makes
through TripDeputy's own `decodeTrip`, and TripDeputy's own `encodeTrip`
output back through this page's import, so a change in TripDeputy's link
format shows up here as a failing test rather than a broken hand-off.

Do not edit these files. Refresh them from a trip-deputy checkout with:

    bash tests/sync-tripdeputy.sh ../trip-deputy
