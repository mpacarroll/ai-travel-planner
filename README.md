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

## License
MIT, see [LICENSE](LICENSE).
