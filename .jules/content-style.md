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
  2 lines +35, 3 lines +85, 4 lines +130, 5+ lines +200. Full-board clear
  gives a flat +500 bonus on top. (3-line bonus was +75 before v2.8.0; if a
  post predating that release still says +75, it's stale — correct it to
  +85 when touched.)
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
- Google Play Games (optional sign-in, from Settings or auto-detected): 18
  achievements; Best Score and Longest Streak leaderboards (Settings →
  Play Games → Leaderboards, added v2.8.0); cloud save (added v2.8.0) that
  syncs best score, coins, daily streak, and unlocked themes — merges by
  keeping the higher value / most-recently-changed value per field, never a
  blanket overwrite. One save slot per account; no manual conflict-resolution
  UI yet.

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

- [ ] Title reads like a real search query with a number or reassurance
      cluster ("Best Block Blast Alternatives (2026): Free, Offline, No
      Ads"), not a blog headline ("How Combo Multipliers Work in Block
      Puzzle Games") — a 2026-09-14 GSC audit found query-phrased titles
      converting while headline-style titles got zero clicks at the same
      ranking position. Meta description opens by directly addressing the
      searcher, not restating the title.
- [ ] One `<h1>` matching the target title
- [ ] Each `<h2>` is a real question/topic, answered in its first sentence
- [ ] At least one `<table class="score-table">` if the topic involves any
      comparison or numeric data
- [ ] FAQ section (3–5 Q/A) + matching `FAQPage` JSON-LD
- [ ] Share bar (WhatsApp/Twitter/Copy Link) before "More Guides", using
      this post's own title and canonical URL — copy the `.share-bar`
      markup pattern and `js/share.js` script tag from an existing post
      (e.g. `blog/how-to-play-dhamaka-blocks.html`). Encode the PLAIN title
      text (not the HTML-escaped version from `<title>`/meta tags) — if the
      title contains "&", percent-encode the real "&" character (→ `%26`),
      never the literal string "&amp;" (→ would wrongly produce `%26amp%3B`,
      showing "&amp;" as visible text in the shared message)
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
- [ ] A `301` line added to `_redirects` for the post's `.html` filename
      (e.g. `/blog/<slug>.html /blog/<slug> 301`) — Cloudflare's automatic
      extension-stripping uses a `307`, which search engines treat as
      incomplete; the explicit `_redirects` rule forces a proper `301`

## Editing an existing post

When a diff changes an existing published post's body content (facts,
prices, copy — not just a site-wide shared-UI change like a footer link),
also update, in the same PR:

- [ ] JSON-LD `"dateModified"` in that post's own `<head>`, to today
- [ ] `<meta property="article:modified_time" ...>`, to the same today's date
- [ ] The matching `<lastmod>` entry for that post's URL in `sitemap.xml`

Do NOT bump these for a purely cosmetic/shared-UI change replicated across
many posts (e.g. adding a footer link site-wide) — that would manufacture a
false freshness signal on pages whose actual content didn't change. This is
a judgment call: if what changed is something a reader would notice reading
just that post, bump the dates; if it's identical boilerplate added to every
page, don't. A CI check (`scripts/check-modified-dates.js`, wired into
`.github/workflows/modified-date-check.yml`) flags any changed post whose
body differs but whose dates didn't move — it warns, it doesn't block, since
the cosmetic-vs-real distinction isn't mechanically decidable. Read its
warning and use judgment, don't reflexively bump every flagged file.

## Scheduled routine: proposals only

The scheduled routine researches and PROPOSES topics. It never writes an
article, never approves or promotes an entry, and never edits or deletes an
existing entry. Statuses in `content-queue.json`:

- `proposed` — a researched suggestion waiting for the owner. The scheduled
  routine never writes it.
- `published`, `retired`, `rejected`, `skipped` — never reconsidered. `retired`
  keeps the reason and evidence as a tombstone so the topic is not proposed
  again without new evidence.
- `queued` and `approved` are invalid, and so is an `approval` block: approval
  is the owner's decision in their own conversation and is not recorded in the
  queue. A `publish_after` date is the earliest review date, never permission to
  write.

Every `proposed` entry must pass `node scripts/check-queue-gate.js` (also run by
CI), which requires:

- **First-party evidence** (`evidence.first_party[]`): Search Console
  (`gsc-live` for a live check, `gsc-digest` for the stored weekly digest) or
  GA4/traffic (`ga4`), each with `source`, `fetched_at`, `window` and the quoted
  rows relied on (a zero result is quoted too). Public web search and
  competitor research go only in `evidence.supplementary` and never satisfy
  this. Never claim a live check that was not run.
- **An honest demand label**: `evidence.demand_label` is `observed`, `thin` or
  `none-observed`, with `evidence.limits` and `evidence.summary`. Thin or
  absent data is labelled as such and never described as validation. There is
  no minimum-impression cutoff; a proposal is an editorial suggestion for the
  owner to weigh, not a demand finding.
- **An intent-overlap check** (`overlap_check`): result `distinct`, covering
  every existing blog page, with notes; and no exact `intent` term shared with
  a published or proposed entry. A `retired`, `rejected` or `skipped` topic can
  be re-proposed only with `addresses_retirement` (`slug` and a `note` on the
  new first-party evidence).
- `proposed_at` (today) and a `publish_after` at least 3 days later.
- Evidence freshness: each first-party item fetched at most 10 days before
  `proposed_at`. This is a safety default that reuses the existing 10-day digest
  rule. It is not an SEO requirement or a demand threshold. It lives in
  `POLICY_DEFAULTS` in `scripts/check-queue-gate.js` and changes only by a
  reviewed PR.

Before researching, run `node scripts/check-queue-gate.js` (must exit 0), then
`node scripts/check-queue-gate.js --proposals`. If any proposal is listed it is
waiting for the owner: make no changes, open no PR and exit normally.

## Writing an approved topic (interactive handoff only)

The scheduled routine never does this section. The owner decides in their normal
conversation. The main session (the one that talks with the owner) checks the
original approval and passes a bounded writing request to an interactive Claude
session. The request names the slug and the fingerprint of the exact revision
(printed by `--proposals` and `--check-writable`), states that the owner
approved it, and limits the scope to: write one post, open a PR, do not merge.

The interactive session then:

1. runs `node scripts/check-queue-gate.js --check-writable <slug>`; it must exit
   0 and print the same fingerprint as the request. A different fingerprint
   means the entry changed after approval: stop and ask;
2. quotes the writing request in the PR body (it cannot independently verify
   the owner's approval; the PR lets the owner see exactly what was relied on);
3. writes the post following the checklists below and marks that entry
   `published` in the same PR. The post PR needs its own merge approval from
   the owner and is never self-merged.

With no such request, nothing is written.

## Topic research (when content-queue.json has no proposed entries)

Trigger condition: run the research pass only when no entry has
`status: "proposed"` (nothing is waiting for the owner). Any other status
(`published`, `retired`, `rejected`, `skipped`, or anything else a human may have
set) is excluded and never reconsidered or rewritten. If any entry is
`proposed`, make no changes, open no PR and exit normally. Research produces
proposals only; it never makes anything writable:

1. Use WebSearch to find 2–3 new topic candidates, following the same method
   as the original keyword research: search competitor/ecosystem queries
   (e.g. "games like block blast", "block puzzle high score tips", "[genre]
   vs [competitor]"), People-Also-Ask-style phrasing, and app-trust queries
   ("is [game] free/safe/offline"). Prefer angles not yet covered by existing
   posts (check `blog/index.html` for what's already published).
2. **Alternate cluster type from the most recently published batch.** Before
   researching, check the `angle`/`intent` of the most recently *published*
   items in `content-queue.json` (not queued — published). This project has
   two content clusters: (a) comparison/install-intent (e.g. "X vs Y",
   "alternatives to X", "best offline block puzzle games") and (b) wellness/
   lifestyle-adjacent (e.g. brain-health, stress-relief, calm/no-timer
   positioning). If the last published batch was cluster (b), research
   cluster (a) next, and vice versa. Comparison content has the only
   confirmed click signal so far (per GSC data as of 2026-08-29) — when
   genuinely unsure which cluster the last batch belongs to, default to
   cluster (a). This is a simple alternation rule, not a scoring system —
   don't overthink it.
3. Stay inside this project's positioning: block-puzzle strategy/comparison
   content, or the India/festive cultural angle. Do not chase unrelated
   gaming topics.
4. Apply the same hard rules as post-writing: no solver/cheat/MOD-APK topics,
   no fabricated stats to justify a topic's popularity — describe the search
   intent qualitatively (e.g. "recurring comparison query"), not with invented
   numbers.
5. For each candidate, add a new entry to `content-queue.json` with `status:
   "proposed"`, a real `slug`, `title`, `intent`, one-line `angle`, 2-3
   `internal_links` (existing post slugs), `proposed_at` (today) and a
   `publish_after` at least 3 days after `proposed_at` (the earliest review
   date, not permission to write; never backdate), plus `evidence` and
   `overlap_check` blocks as described in "Scheduled routine: proposals only":
   first-party data (the stored digest as `gsc-digest`, a live Search Console
   check as `gsc-live`, GA4 as `ga4`) goes in `evidence.first_party` with
   source, date, window and quoted rows (zero results too); public search and
   competitor research go only in `evidence.supplementary`. Set
   `demand_label` and `limits` honestly, never call thin or absent data
   validation, invent no cutoffs, and never claim a live check you did not run.
   `overlap_check` records that you compared the topic's intent with every
   existing blog page. Do not re-propose a retired, rejected or skipped topic
   unless new first-party evidence addresses its recorded reason (put it in
   `addresses_retirement`). Add no `approval` block or any other approval
   marker. State in the PR body that these are proposals only. Run
   `node scripts/check-queue-gate.js` before committing.
6. Before creating a branch: check whether a branch named
   `content/queue-refresh-<today's date, YYYY-MM-DD>` already exists on the
   remote (`git ls-remote --heads origin | grep queue-refresh-<date>`) or
   whether an open PR already targets it (`gh pr list --head
   content/queue-refresh-<date>`). If either exists, that means an earlier
   run today already started or finished this — do not create a duplicate,
   do not force-push over it, and do not delete/recreate it. Just stop and
   report that a queue-refresh for today is already in progress or done.
   Otherwise, commit the updated `content-queue.json` on a fresh branch
   `content/queue-refresh-<date>` and open a PR titled "Add N new topics to
   content queue" with a body explaining the search intent behind each new
   entry. This is a separate PR from any post-writing PR — do not mix queue
   research with a generated post in the same PR.
7. The scheduled routine never writes a post, in this run or any other:
   research only when no entry is `proposed`, then stop.

## Self-review (post as a PR comment before finishing)

After committing the new post and opening its PR (or the queue-refresh PR),
run a self-review pass and post the findings as a comment on that same PR.
`gh pr create`'s own output is just a URL, not a labeled PR number — get the
number explicitly with `gh pr view --head <your-branch-name> --json number
-q .number` right after creating the PR, then use that number:
`gh pr comment <number> --body "..."`. Do not skip the self-review even
though you already tried to follow the rules while writing — this is a
second, explicit check, not a formality:

1. Re-read every factual sentence in the new/changed content against
   "Confirmed game facts" above. List any claim that doesn't trace to this
   file.
2. Check against "Hard rules" — no solver/cheat/MOD references, no
   fabricated competitor stats/ratings, no ad content.
3. Walk the "Required elements checklist" above item by item.
4. Confirm UTM params are present on every Play Store link and use this
   post's own slug.
5. If this PR edits an existing post's body (not just a new post), walk
   "Editing an existing post" above too — dateModified, article:modified_time,
   sitemap.xml lastmod.
6. Post a comment structured like:
   ```
   ## Self-review

   **Facts checked:** <ok, or list flagged claims>
   **Hard rules:** <ok, or list violations>
   **Required elements:** <item-by-item pass/fail>
   **UTM links:** <ok, or list missing>
   **Modified dates (if editing an existing post):** <ok, or list missing>

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
