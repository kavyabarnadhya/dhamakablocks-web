# Content Style & Factual Guardrails — Dhamaka Blocks Blog

This file is the allow-list for the automated content loop (see the 30-day
pilot plan). It exists because the loop's agent starts with **zero prior
context** each run — everything it's allowed to assert must be written down
here. The human reviewing each generated PR should spot-check every factual
claim in the draft against this file before merging.

## Confirmed game facts (safe to assert)

- Platform: Android, via Google Play Store. App ID:
  `com.dhamakagames.dhamakablocks`. Free to install, free to play.
- Grid: 8×8. Tray holds 3 pieces at a time; place in any order.
- Clearing a full row or column clears it and scores points. No timer, no
  lives — the game ends only when none of the 3 current tray pieces fit.
- Scoring: 1 base point per cell placed. Line-clear bonuses: 1 line +10,
  2 lines +35, 3 lines +75, 4 lines +130, 5+ lines +200. Full-board clear
  gives a flat +500 bonus on top.
- Combo multiplier (consecutive clearing turns): 1 turn 1.0×, 2 turns 2.0×,
  3 turns 3.5×, 4 turns 5.0×, 5 turns 7.0×, 6+ turns 10.0×. Missing a clear
  resets the streak to 1.0×.
- Difficulty gates at 200 / 500 / 1,000 / 2,000 points (Levels 1–5). The 3×3
  square piece unlocks at Level 2; relief/easy pieces get rarer at higher
  levels.
- Coins: ~1 per 100 points scored (capped 50/game) + a 7-day escalating Daily
  Reward (25, 40, 60, 80, 120, 160, 400 coins on Day 7; misses reset to Day 1).
  Lifetime milestone chests at 7/30/100 total daily-reward days (150 coins;
  400 coins + free Aurora theme; 800 coins + free Monsoon theme) — these
  don't reset even if the daily streak breaks.
- Boosters: UNDO (30 coins, undoes last placement), REFRESH (40 coins, new
  tray), BOMB (60 coins, clears a 3×3 area). All three also usable during the
  "last chance" window before a game would end.
- Board themes: 7 total. Basic tier: Ember (free). Signature tier: Midnight,
  Peacock, Sunset, Frost (400–1,200 coins). Prestige tier: Monsoon (2,400
  coins). Aurora is milestone-exclusive (not purchasable).
- Theme/branding: Indian festive aesthetic — saffron, gold, peacock green;
  rangoli-inspired visuals; Indian percussion sound effects. Built by
  Dhamaka Games, an Indian studio. Score-sharing card formatted for WhatsApp.
- A one-time "continue" (rewarded-ad powered) is available when a game would
  otherwise end — removes one piece type from the tray for another chance.

## Hard rules — never invent

- **No fabricated ratings, install counts, review counts, or awards** for
  Dhamaka Blocks or any competitor, unless sourced from a real, citable
  figure. If unsure, omit the number entirely rather than guess.
- **No claims about unreleased features.** Only describe what's listed above
  or confirmed in an existing published post.
- **Competitor facts must be generic or hedged** ("many players report…",
  "a common complaint is…") unless independently verifiable — don't assert
  a competitor's exact rating/install count/price without a source.
- **Never target or reference "solver", "cheat", "hack", or "MOD APK" content**
  for Dhamaka Blocks or competitors. This is off-brand and piracy-adjacent.
  If a queue item's search intent brushes this territory, redirect to the
  legitimate angle (e.g. "high score tips" instead of "solver").
- **Ads:** do not write ad copy, ad placements, or AdSense/monetization
  content. Out of scope for this site's editorial work entirely.

## Tone

Warm, festive, India-proud, confident but not boastful. Calm/strategic framing
(no artificial urgency — the game itself has no timer, so don't manufacture
one in prose). Match the register of the 5 existing posts: direct, practical,
a little playful with the festive palette language ("saffron and gold" etc.),
never hype-y or clickbait in the body copy (title can be more search-friendly).

## Required elements checklist (every new post)

- [ ] One `<h1>` matching the target title
- [ ] Each `<h2>` is a real question/topic, answered in its first sentence
- [ ] At least one `<table class="score-table">` if the topic involves any
      comparison or numeric data
- [ ] FAQ section (3–5 Q/A) + matching `FAQPage` JSON-LD
- [ ] `Article` + `BreadcrumbList` JSON-LD in `<head>`
- [ ] Unique `title`/`meta description`/`canonical`/OG (`summary_large_image`)
- [ ] `article:published_time` set to the actual publish date
- [ ] Every Play Store link carries
      `?utm_source=blog&utm_medium=<nav|cta|sticky>&utm_campaign=<slug>`
- [ ] Early in-content CTA (after intro) + a context-matched closing CTA
      (not generic "Get the Game" — tie the copy to the post's topic)
- [ ] 2–3 internal links to the posts named in `content-queue.json`'s
      `internal_links` for that entry
- [ ] Post registered in `sitemap.xml`, `blog/index.html`, `index.html`
      (blog preview section), and `llms.txt`

## Topic research (when content-queue.json has no queued items left)

If every item in `content-queue.json` is `published` (or the file has no
`queued` items at all), do a research pass instead of exiting immediately:

1. Use WebSearch to find 2–3 new topic candidates, following the same method
   as the original keyword research: search competitor/ecosystem queries
   (e.g. "games like block blast", "block puzzle high score tips", "[genre]
   vs [competitor]"), People-Also-Ask-style phrasing, and app-trust queries
   ("is [game] free/safe/offline"). Prefer angles not yet covered by existing
   posts (check `blog/index.html` for what's already published).
2. Stay inside this project's positioning: block-puzzle strategy/comparison
   content, or the India/festive cultural angle. Do not chase unrelated
   gaming topics.
3. Apply the same hard rules as post-writing: no solver/cheat/MOD-APK topics,
   no fabricated stats to justify a topic's popularity — describe the search
   intent qualitatively (e.g. "recurring comparison query"), not with invented
   numbers.
4. For each candidate, add a new entry to `content-queue.json` with `status:
   "queued"`, a real `slug`, `title`, `intent`, one-line `angle`, plausible
   `internal_links` (existing post slugs), and a `publish_after` date at
   least 3 days out from today (do not backdate to make it immediately
   eligible — that defeats the review cadence).
5. Commit the updated `content-queue.json` on its own branch (e.g.
   `content/queue-refresh-<date>`) and open a PR titled "Add N new topics to
   content queue" with a body explaining the search intent behind each new
   entry. This is a separate PR from any post-writing PR — do not mix queue
   research with a generated post in the same PR.
6. Do not also write a post in the same run as a research pass — pick one:
   if a queued+due item exists, write it; only research when none does.

## Self-review (post as a PR comment before finishing)

After committing the new post and opening its PR (or the queue-refresh PR),
run a self-review pass and post the findings as a comment on that same PR
via `gh pr comment <number> --body "..."` — do not skip this even though you
already tried to follow the rules while writing. This is a second, explicit
check, not a formality:

1. Re-read every factual sentence in the new/changed content against
   "Confirmed game facts" above. List any claim that doesn't trace to this
   file.
2. Check against "Hard rules" — no solver/cheat/MOD references, no
   fabricated competitor stats/ratings, no ad content.
3. Walk the "Required elements checklist" above item by item.
4. Confirm UTM params are present on every Play Store link and use this
   post's own slug.
5. Post a comment structured like:
   ```
   ## Self-review

   **Facts checked:** <ok, or list flagged claims>
   **Hard rules:** <ok, or list violations>
   **Required elements:** <item-by-item pass/fail>
   **UTM links:** <ok, or list missing>

   **Summary:** <one line — looks ready for review, or specific concerns>
   ```
   This is informational only — you are not authorized to merge, approve,
   or request changes on your own PR. The human makes the merge decision.

## Reviewer's job (human, per PR)

1. Read the self-review comment first, then verify it against the diff
   yourself — treat the comment as a starting point, not a substitute for
   your own check.
2. Read every factual sentence — does it match "Confirmed game facts" above?
   Flag anything invented.
3. Check the "Hard rules" section — no solver/cheat/MOD references, no
   fabricated competitor stats, no ad content.
4. Confirm the required-elements checklist above is satisfied.
5. Spot-check UTM params are present and use the post's own slug.
6. If everything checks out, merge. If not, request changes in the PR or
   fix directly before merging — never merge unreviewed.
