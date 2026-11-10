# Travel Planner — "Trip Planner"

A free, private travel-agent-in-your-browser. Answer a few questions and get a ready-to-paste request that any AI turns into a day-by-day itinerary tuned to your budget, pace, and taste — plus packing and booking checklists.

**Live:** [mpacarroll.github.io/ai-travel-planner/tool/](https://mpacarroll.github.io/ai-travel-planner/tool/) · **Tool:** `tool/index.html` (self-contained, no account, nothing saved or sent).

This is the lite free version of [TripDeputy](https://tripdeputy.com), which remembers what you send it over weeks or months and builds the full plan with calendar reminders. The tool links there for anyone who wants more.

Part of Mick Cairn's free tools — *the professionals you can't afford, made free and plain.* Always verify visas, hours, and prices before booking. Not affiliated with any employer.

## Relationship to TripDeputy (decision record, 2026-11-02)

This repository is **not deprecated and not archived**; that call is Michael's (hq#898). The
standing decision (hq, D4, 2026-10) is that it stays live as the free, no-account front door to
[TripDeputy](https://tripdeputy.com), and the cross-link at the bottom of the tool is deliberate
(operator, 2026-10-07).

What the two do, side by side, so nobody rebuilds one inside the other:

| | Trip Planner (this repo) | TripDeputy |
|---|---|---|
| Shape | One static page. Seven fields in, one pasteable prompt out, plus a packing and booking checklist | A product: saves every link, screenshot and booking email over weeks, builds the day-by-day plan, re-plans the day, reminds you what to book and when |
| Account, storage | None. Nothing saved, nothing sent | Free tier with no account, trips on your device; Plus and Pro add sync, live share links, calendar, alerts |
| The AI step | You paste the prompt into whichever assistant you already use | Runs the AI for you on Plus and Pro |
| Identity | Mick Cairn, free tools | MC AI Studio LLC, neutral brand |

Nothing here is worth porting into TripDeputy: the trip-type presets, the packing list and the
booking checklist all exist there already, and the one thing this page does that TripDeputy does
not, hand you a prompt for your own assistant, is the point of a free lite version. If that ever
changes, the port goes in as its own TripDeputy pull request, not here.

Maintenance rule: keep the page working and keep the TripDeputy link current. Do not add features;
anything new belongs in TripDeputy.

## The trip brief and the hand-off to TripDeputy (2026-11-09)

Added for the Mick hub's travel feeder (MH in Michael's 2026-11-09 build brief). It turns this page's
seven answers into a small structured brief, `tool/brief.js`, which goes three ways:

- **To TripDeputy.** The existing TripDeputy link now carries the answers. TripDeputy's planner
  already opens `https://tripdeputy.com/plan/#trip=t1.<data>` as the visitor's own trip (trip-deputy
  `src/lib/share.js`), so nothing changed there. The trip rides after the `#`, which browsers never
  send to a server, so this page still sends nothing.
- **To a file.** "Save these answers" downloads `<destination>-brief.json`; loading it fills the form.
- **Back from TripDeputy.** A TripDeputy share link, pasted or opened onto `/tool/#trip=...`, fills
  the form. What the form has no field for (saved links, notes, costs, day edits) is named as staying
  in TripDeputy.

Nothing is guessed. "5 days" is 4 nights, "a week" 7, "weekend" 2; a start date is used only when
the words give a whole date with a year. Anything vaguer ("late May") goes over as words in the
constraints, and the page says TripDeputy will start at its usual length.

Tests: `node --test tests/*.test.mjs`. `tests/brief.test.mjs` runs every link through a pinned copy
of TripDeputy's own decoder and encoder (`tests/tripdeputy/`, refreshed with
`bash tests/sync-tripdeputy.sh ../trip-deputy`), so a change to TripDeputy's link format fails here
first. `tests/page.test.mjs` drives the page in Chromium when the `playwright` package is present.

## License
MIT, see [LICENSE](LICENSE).
