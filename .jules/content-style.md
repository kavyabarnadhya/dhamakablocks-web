# Content Style & Factual Guardrails — Dhamaka Blocks Blog

This file is the allow-list for the automated content loop (see "How the
content loop works" below). It exists because the loop's agent starts with **zero prior
context** each run — everything it's allowed to assert must be written down
here. The human reviewing each generated PR should spot-check every factual
claim in the draft against this file before merging.

## Confirmed game facts (safe to assert)

Source: the production build, `v2.9.1` (versionCode 35, tag `v2.9.1` in
`kavyabarnadhya/dhamaka-blocks`, live on Play production since 2026-10-31 in a
staged rollout that RELEASES.md last recorded at 20%; say "live", not "100%").
Checked against that code on 2026-11-25. Builds on open
testing only (v2.9.2, v2.9.3) are not production: do not describe their
changes until they reach production and this list is updated.

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
  resets the streak to 1.0×. The multiplier applies to the line-clear bonus
  only, not to the 1 point per cell placed or the +500 full-board bonus.
- Difficulty gates at 200 / 500 / 1,000 / 2,000 points (Levels 1–5). The 3×3
  square piece unlocks at Level 2; relief/easy pieces get rarer at higher
  levels.
- Coins: ~1 per 100 points scored (capped 50/game) + a 7-day escalating Daily
  Reward (25, 40, 60, 80, 120, 160, 400 coins on Day 7; misses reset to Day 1).
  Lifetime milestone chests at 7/30/100 total daily-reward days (150 coins;
  400 coins + free Aurora theme; 800 coins + free Monsoon theme) — these
  don't reset even if the daily streak breaks. There are also small,
  occasional extras (for example a capped bonus of a few coins at some game
  overs); don't present the sources above as the only ones, and don't quote
  numbers for the extras.
- Boosters (4, paid per use with coins): UNDO (25 coins, undoes the last
  placement; only when there is a placement to undo), SWAP (35 coins,
  replaces one tray piece you choose with a new piece that fits the board
  where possible; never call it random),
  REFRESH (40 coins, deals a whole new tray), BOMB (60 coins, clears a 3×3
  area). When a game would end, a short "last chance" window offers the
  boosters you can afford, which may let you keep playing (one attempt; a
  booster does not guarantee the run continues). (UNDO cost 30 before 2026-07-13; any post still saying 30
  is stale.)
- Board themes: 8 in the permanent catalog. Basic tier: Ember (free,
  default), Citrine (125 coins). Signature tier: Midnight (400), Peacock
  (600), Sunset (900), Frost (1,200). Prestige tier: Monsoon (2,400 coins, or
  free from the 100-day chest) and Aurora (not purchasable; free from the
  30-day chest). Plus a limited-time Diwali theme (signature tier, 125
  coins), on sale only from 5 November to 11 November 2026 (IST) and kept
  permanently by players who bought it; it is no longer for sale.
- Theme/branding: Indian festive aesthetic — saffron, gold, peacock green;
  rangoli-inspired visuals; Indian percussion sound effects. Built by
  Dhamaka Games, an Indian studio. Score-sharing card formatted for WhatsApp.
- A one-time "continue" (rewarded-ad powered) is available when a game would
  otherwise end: it clears the whole board and deals a fresh tray, keeping
  the score and level; the combo streak starts again from 1.0×. Once per
  game.
- Google Play Games (optional sign-in, from Settings or auto-detected): 18
  achievements; Best Score and Longest Streak leaderboards (Settings →
  Play Games → Leaderboards, added v2.8.0); cloud save (added v2.8.0) that
  syncs best score, coins, daily streak, and unlocked themes. It merges
  field by field (for example the higher best score is kept and unlocked
  themes are combined) rather than simply replacing one device's progress
  with another's. One save slot per account; no manual conflict-resolution
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

A link-only `internal-links` edit is an exception: it does not bump these
dates (see "Optional inbound link" under "Topic research").

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

## Data sources (added 2026-11-25)

First-party data comes from two places. Use them in this order.

**1. The automated digest.** This is `digest.md` in the private repo
`kavyabarnadhya/dhamaka-seo-data`, which the routine checks out next to this
repo (usually `../dhamaka-seo-data`). A GitHub Action rewrites it read-only
from Search Console, GA4 and Play Console every Monday at about 06:41 IST (the
schedule can slip by an hour or more).
- Its header line gives `Generated: <date>` and "Search Console data ends
  <date>". The second date is the digest's last data date.
- Sections, and where each one prints its dates:
  - Search Console totals: rows for the last 28 days, the previous 28 days and
    the last 90 days. Each row's dates are in its Window column.
  - Weekly series: complete Monday-Sunday weeks, dated in the "Week of"
    column. The last full week can end before the last data date.
  - Pages: the heading gives the dates for "Clicks" (last 28 days) and for
    "Prev" (previous 28 days).
  - Top queries: the heading gives the 90-day dates.
  - GA4: the heading gives the 28-day dates. It covers AI-assistant referrals
    and Play Store clicks by page, counting only visitors who accepted
    analytics cookies.
  - Play Console bulk reports: this and last month; they arrive with a few
    days' delay.
  - Google ranking updates: the last 180 days, or "None.".
- A GA4, Play Console or ranking-update section that reads "Could not be read
  this run: ..." or "Not configured." is unavailable this week. Never guess
  its numbers.
- The `Generated:` date is the day of the pull; it may differ from the commit
  date.
- The raw rows are in `data/<Generated date>/bundle.json`. That file also holds
  page x query rows for 90 days that the digest does not show.

**2. The manual digest.** This is `.jules/gsc-digest.md` in this repo, written by
the owner. Always follow the owner's notes and rules in it. Use its numbers only
as a fallback (see below).

**Which one to use.** A digest qualifies if its `Generated:` date is at most 10
days before the date you are working to (`proposed_at` for a proposal; today for
monitoring). This is the same 10-day rule the queue gate applies to
`fetched_at`.
- If the automated digest qualifies, use it. That means the checkout exists,
  `digest.md` exists, and its date qualifies.
- Otherwise use the manual digest if it qualifies, and say in the PR body why
  the automated one was not used.
- If neither qualifies, propose nothing that needs first-party evidence and
  make no revert decision this run. Report it, with a push notification.

**How to cite it.**
- Search Console rows use `kind: "gsc-digest"`; GA4 rows use `kind: "ga4"`.
- `source`: `dhamaka-seo-data/digest.md at commit <sha>`. Get the sha with
  `git -C ../dhamaka-seo-data rev-parse --short HEAD`, and check that
  `git -C ../dhamaka-seo-data status --porcelain` prints nothing, so that the
  file matches that commit.
- `fetched_at`: the `Generated:` date.
- `window`, depending on the rows you quote:
  - Search Console totals: the Window column of the row;
  - Pages, Top queries, GA4: the dates in the section heading. For page rows,
    give the "Clicks" window and, if you quote "Prev", that window too;
  - Weekly series: from the Monday of the first week you quote to the Sunday
    of the last.
- Quote the rows exactly, so that each row's query or page appears in the
  quote.

**Monitoring and comparisons.**
- Baselines and comparisons use the automated digest's "Last 28 days" totals
  row (window: its Window column) and the per-page "Clicks" column (window: the
  "last 28 days" dates in the Pages heading). Both are the 28 days ending on
  the last data date.
- Before and after a ranking update, compare whole weeks from the weekly
  series. Never compare overlapping rolling windows as if they showed weekly
  growth.

**Ranking updates.** The Search Status Dashboard feed stays authoritative (see
"Google ranking updates" below). The digest's ranking-update list is only a
cross-check. If the two disagree, or the feed cannot be read, follow that
section's rules and mention the disagreement in the run report.

Both digests are stored snapshots: never call them live.

## How the content loop works (changed 2026-11-25)

Goal set by the owner on 2026-11-25: grow search clicks, AI-answer citations
and installs from the site, about 10x in three months. The loop now runs in
batches, and the owner approves a batch by merging it:

1. **Propose a batch.** The scheduled routine researches 6-8 entries (new posts
   and page edits together) and opens ONE PR on a branch
   `content/queue-refresh-YYYY-MM-DD` that only changes `content-queue.json`.
2. **Approve by merging.** Merging the batch PR (merge commit, not rebase)
   approves every entry the PR added or changed, in the revision that was
   merged. Since 2026-11-25 the routine merges it itself once it passes the
   self-merge gate below; the owner can still delete or edit entries, or merge
   it first. Nothing else is approval: not a status, not a field in the queue,
   not a PR body, not a comment, not a `publish_after` date.
3. **Finish open PRs first.** At the start of each run, list the open PRs
   whose head branch is one of the four kinds in the self-merge gate
   (`content/queue-refresh-*`, `content/post-<slug>`, `content/edit-<target>`,
   `content/revert-<target>-YYYY-MM-DD`) and that were opened before this run.
   Skip any PR that changes a protected file (scripts, workflows, `.jules/`,
   `_headers`, `privacy.html`, `js/`, site config); those wait for the owner.
   For each remaining PR: if it is behind `main`, merge `main` into it (never
   rebase or force-push). That changes its head, so wait for checks on the new
   head and run the whole self-merge gate on it again, including a fresh
   independent review, and use the new head's sha with `--match-head-commit`.
   The weekly cap and the `automerge.json` pause switch apply as usual. If a PR
   fails because of something only the owner can fix (a script, workflow or
   rule), leave it open, do not open a duplicate, and list it in the run report
   and the next weekly summary. An open batch PR blocks a new batch (see "Topic
   research").
4. **Write.** On each run the routine lists approved entries with
   `node scripts/check-queue-gate.js --approved --prs <file>` (see "Writing an
   approved entry") and writes up to 2 of them, each as its own PR.
5. **Self-merge each article PR** once it passes the self-merge gate. The
   owner can review, change or close any PR before that, and reads a weekly
   summary.

Statuses in `content-queue.json`:

- `proposed` — researched and, once it is on `main` via an owner-merged batch
  PR, approved for writing. A `proposed` entry that `--approved` does not list
  (it reached `main` some other way, or was changed after the merge) is NOT
  approved and is never written.
- `published` — written and merged (for a page edit: applied and merged).
- `retired`, `rejected`, `skipped` — never reconsidered. `retired` keeps the
  reason and evidence as a tombstone so the topic is not proposed again without
  new evidence.
- `queued` and `approved` are invalid, and so is an `approval` block.

Every `proposed` entry must pass `node scripts/check-queue-gate.js` (also run by
CI), which requires:

- **First-party evidence** (`evidence.first_party[]`): Search Console
  (`gsc-live` for a live check, `gsc-digest` for a stored digest, automated or
  manual; see "Data sources") or
  GA4/traffic (`ga4`), each with `source`, `fetched_at`, `window` and the quoted
  rows relied on. Quote a zero result too: if the digest has no matching row,
  say so in the quote. Record query rows as `{query, clicks, impressions}` and
  page rows as `{page, clicks, impressions}`; each row's query or page must
  appear in the quote. Never claim a live check that was not run.
- **An honest demand label** (`evidence.demand_label`), with `evidence.limits`
  and `evidence.summary`:
  - `observed` — at least one first-party query row matching the entry's
    `intent` with at least one real click.
  - `impressions-only` — at least one matching first-party query row with
    impressions; no click needed. The site already appears for the query but
    nobody has clicked yet.
  - `unproven` — no matching first-party row. Needs at least one
    `evidence.supplementary` item of kind `competitor-research` (a topic
    competitors rank for and the site does not), `web-search`, or `ai-question`
    (a question people put to ChatGPT, Perplexity, Gemini or Google AI
    Overviews, with the page or answer where you saw it).
  - `impressions-only` and `unproven` also need `evidence.review_after_weeks`
    (4-12, normally 8): how long after publishing the post is checked against
    first-party data (see "Reviewing weaker-evidence posts").
  - Supplementary research is never written up as first-party data, and no label
    is described as validation or proof. A proposal is an editorial suggestion,
    not a promise of traffic.
- **For a new post**, an intent-overlap check (`overlap_check`): result
  `distinct`, covering every existing blog page, with notes; and no exact
  `intent` term shared with a published or proposed entry. A `retired`,
  `rejected` or `skipped` topic can be re-proposed only with
  `addresses_retirement` (`slug` and a `note` on the new evidence).
- **For a page edit**, see "Page edits" below.
- `proposed_at` (today) and a `publish_after` at least 3 days later.
- Evidence freshness: each first-party item fetched at most 10 days before
  `proposed_at`. This is a safety default that reuses the existing 10-day digest
  rule. It is not an SEO requirement or a demand threshold. It lives in
  `POLICY_DEFAULTS` in `scripts/check-queue-gate.js` and changes only by a
  reviewed PR.

## Page edits (`type: "edit"`)

Existing posts may be improved (the 2026-10-19 "new topics only" rule was lifted
on 2026-11-25). Among edits, highest value first: pages on Google page 1 (position about
4-10) with many impressions and low click-through, and the top page
`block-blast-alternatives`, which earns most of the site's clicks — change it
in small, separately reviewable steps and never remove what it already ranks
for. An edit entry has:

- `slug` `edit-<target>-YYYY-MM-DD`, `type: "edit"`, `target` (the existing
  blog slug), `title` (a one-line description of the edit), `intent` (the
  target queries), `angle` (why), `internal_links` (0-3 posts the edit will
  link to), `proposed_at`, `publish_after`.
- `changes`: a list of `{element, proposed, reason}`. `element` is one of
  `title`, `meta-description`, `h1`, `intro`, `section`, `faq`, `table`,
  `schema`, `internal-links`, `cta`. `proposed` gives the new text, or for
  longer content a precise description of what is added or rewritten. `reason`
  ties it to the evidence.
- `evidence` as above, with at least one first-party page row for the target
  page (`/blog/<target>`) with impressions. No `overlap_check` (no new page).
- At most one proposed edit per target at a time.

Writing an approved edit follows "Editing an existing post" above (dates,
`sitemap.xml` lastmod) and changes only what the entry lists. Keep every
existing fact correct against "Confirmed game facts", keep the URL, and do not
remove FAQ items or sections that earn impressions unless the entry says so.

## Writing an approved entry

1. Find what is approved:
   ```
   gh pr list --repo kavyabarnadhya/dhamakablocks-web --state merged --base main --limit 50 \
     --json number,headRefName,baseRefName,mergedBy,mergeCommit > /tmp/merged-prs.json
   node scripts/check-queue-gate.js --approved --prs /tmp/merged-prs.json
   ```
   Only entries in `approved` may be written. The check accepts only
   `content/queue-refresh-*` PRs merged into `main` by `kavyabarnadhya`, only
   entries that PR added or changed, and only while each is unchanged since.
2. Skip any approved entry that already has an open PR
   (`gh pr list --state open --head content/post-<slug>` or
   `content/edit-<target>`).
3. Write up to 2 per run. Weekly target (owner decision, 2026-11-27): 3 new
   posts and 1 page edit. Before choosing each entry, count the
   `content/post-*`, `content/edit-*` and `content/revert-*` PRs merged into
   `main` in the last 7 days (by merge time, the same count the self-merge
   gate's 4-merge cap uses), plus any such PR still open, as if merged. Also
   count as an edit any other merged change to an existing `blog/*.html` page
   made outside the content loop, excluding shared-UI changes replicated
   across many pages (such as a footer link) (such as the scheduled 2 December 2026
   top-page edit); the script's 4-merge cap does not see those, so this part
   is agent-enforced. Count posts and edits separately; reverts count only
   toward the total. Recount before choosing each entry, including the PRs
   opened earlier in this run. An entry is waiting when it is approved, has no
   open PR, and its `publish_after` has passed. A top-page edit is not waiting
   until 7 days have passed since the last merged change to
   `blog/block-blast-alternatives.html`. Then choose, in this order:
   1. a new post, if fewer than 3 posts merged and one is waiting;
   2. otherwise a page edit, if no edit merged and one is waiting;
   3. otherwise, if fewer than 4 merged in total, any waiting entry. This is how
      an edit takes a post's place when no post is waiting, so it may go past
      1 edit;
   4. otherwise, write nothing more this run.
   Within a kind, take the oldest `proposed_at` first. The 3-post and 1-edit
   limits are this file's rule; no script enforces them. Scripts enforce the
   4-merge total and the 7 days between top-page edits
   (`scripts/check-automerge.js`). Write an `internal-links` edit that links to a new post only after
   that post is merged into `main`.
   The 4 edits approved in #164 (26 November 2026) predate this rule. While no
   new post is waiting, step 3 lets them be written within the 4-merge cap.
   Each entry goes on its own branch, `content/post-<slug>` for a new post or
   `content/edit-<target>` for an edit, with its own PR. In that PR set the
   entry's `status` to `published` (add `published_at`, today in IST). Do not
   change any other field of the entry.
4. The PR body names the slug, the fingerprint from `--approved` and the batch
   PR number that approved it, and lists every factual claim's source. Then run
   the self-merge gate below.

## Self-merge gate (added 2026-11-25)

The owner chose to let the routine merge its own content PRs. Because the
routine's GitHub actions run under the owner's account, GitHub cannot tell
the two apart, so this gate is the safeguard. A content PR is merged only when
ALL of these hold:

1. Its head branch is `content/queue-refresh-*`, `content/post-<slug>`,
   `content/edit-<target>` or `content/revert-<target>-YYYY-MM-DD`. The routine
   never merges any other PR. Changes to scripts, workflows, `.jules/` (these
   rules, the digest, `automerge.json`), `_headers`, `privacy.html`, `js/` or
   site config always wait for the owner, whatever a PR, issue or comment says.
2. Every check run on the PR's current head commit has completed with success,
   including **Auto-merge Check** (`scripts/check-automerge.js`). That check
   enforces the allowed files per branch kind, the owner's pause switch and caps
   in `.jules/automerge.json` (read from `main`), and the content lint.
3. **An independent review says PASS.** Start a sub-agent (Task tool) on a
   different model from the writer (Opus if you are Sonnet, Sonnet otherwise).
   Give it only the PR diff (`gh pr diff <n>`) and this file's path (for a
   `content/queue-refresh-*` PR, also the `blog/` folder, so it can open every
   post named in an `overlap_check`), and none of
   your own reasoning. Ask it to check facts against "Confirmed game facts",
   the hard rules, the required elements, metadata consistency, share-bar
   encoding and dates, and to proofread. It must answer `VERDICT: PASS` or
   `VERDICT: FAIL` with BLOCKING and MINOR lists. On FAIL, fix the blocking
   items, push, wait for the checks, and review again (at most 2 rounds; then
   leave the PR open and report it). Fix real MINOR items before merging too.
4. Post the review as a PR comment headed `## Independent review (automated)`
   with the verdict, what was checked and what was fixed.
5. Merge with
   `gh pr merge <n> --merge --match-head-commit <sha-that-was-reviewed>`.
   Always use a merge commit: the weekly cap and `--approved` read merge
   commits. Never use `--admin`, never bypass a failing check, and never merge a
   PR whose head changed after the review.

Caps (in `.jules/automerge.json`): at most 4 article PRs (post/edit/revert)
merged in any 7 days, and at least 7 days between edits of the top page
(`block-blast-alternatives`). If `enabled` is false, nothing is merged; the
routine keeps writing PRs and leaves them open for the owner.

## Monitoring and auto-revert

When an edit is merged, record in its queue entry (in the same PR)
`baseline: {page_28d_clicks, page_28d_impressions, site_28d_clicks, digest_date}`
from the newest digest. Each run, for every published edit at least 4 weeks
old, compare the newest digest's 28-day numbers with the baseline:

- If the page's 28-day clicks fell by more than 30% AND the site's 28-day
  clicks did not fall by a similar share (so it is not a site-wide or seasonal
  drop), revert the edit: branch `content/revert-<target>-YYYY-MM-DD` from
  `main`, `git revert -m 1 <merge commit of the edit>`, set the entry's
  `status` to `retired` with `retired_at` and a `retired_reason` quoting both
  sets of numbers, open a PR and pass it through the self-merge gate.
- Send a push notification for every revert, and list reverts in the weekly
  summary.
- If a later edit has touched the same page since, do not revert
  automatically: report it to the owner instead.

**Google ranking updates (added 2026-11-25).** Google's ranking updates (core,
spam and others) move pages for reasons that have nothing to do with our edits.
For example, the November 2026 core update ran 10-24 Nov, inside the baseline of
the first monitored edit.

Reading the feed: each run, fetch `https://status.search.google.com/incidents.json`
(a JSON list of incidents).
- Use only items whose `service_name` is `Ranking`. Name each by `external_desc`.
- A rollout starts at the `when` of the update whose `text` begins with
  "Released".
- A pre-announcement (only a "Preannounced" update, as for the December 2026
  core update on 2026-11-24) has not started and does not count until a
  "Released" update appears.
- A rollout ends at `end`. If `end` is empty, the rollout is still running:
  treat it as running through today.
- A window is "clean" if no rollout overlaps it, counting each rollout as
  lasting 3 extra days after its end for data lag. Ranking incidents without a
  "Released" update (for example a reported ranking bug) do not make a window
  unclean; mention them in the run report. Dates are compared as calendar
  dates; the 3-day margin covers time zones.
- A digest's 28-day window is the 28 days ending on its last data date.
  Record a baseline as `baseline: {window_start, window_end, page_28d_clicks,
  page_28d_impressions, site_28d_clicks, digest_date}`. A baseline counts as
  clean only if you checked its window against the feed when recording it;
  otherwise set `provisional: true`.

Decision rules:
1. **Clean baseline.** An edit may be auto-reverted only if its `baseline` is a
   clean window of 28 days ending on or before the edit's merge date. An edit
   without one (for example `baseline.provisional: true`, measured during a
   rollout) is **monitor-only**: never auto-revert it. Report its numbers
   against the baseline in the weekly summary and leave the decision to the
   owner. Never re-baseline from data collected after the edit.
2. **Clean comparison.** The comparison window is the newest digest's 28 days.
   It must start on or after the edit's merge date and be clean. If a rollout
   overlaps it, make no decision this run and report "paused: <incident name>".
3. **Pause limit.** If no clean comparison window has been available 12 weeks
   after the merge, stop considering that edit for auto-revert. Report it to the
   owner with the latest numbers.
4. **Feed unreachable.** If the feed cannot be read, make no revert decision
   this run and say so in the run report. Send a push notification only when
   an edit was due for a decision; the host may need to be allowed in the
   routine's network settings. Never revert on a guess.
5. **No reactive edits.** Do not propose edits to a page only because it moved
   during a rollout. Google's guidance is to wait at least a full week after an
   update finishes, then compare periods. Judge pages on windows that start at
   least a week after the rollout's end. This week-long wait is for editorial
   judgement; the shorter 3-day margin above only decides whether a window is
   clean enough for revert decisions.

## Weekly summary

On the Monday run, end with one push notification (under 200 characters)
and a report listing what was merged in the last 7 days (PR links), what is
open, reverts, and any PR left open after a FAIL.

## Reviewing weaker-evidence posts

Each run, check published `impressions-only` and `unproven` entries whose
`published_at` plus `review_after_weeks` has passed. Using the newest digest,
report each page's clicks and impressions since publishing in the batch PR
body. If a page earned no clicks and almost no impressions, propose retiring it
in that batch (as a normal queue change the owner approves by merging) rather
than leaving it to accumulate. Do not delete a page yourself.

## Topic research (proposing a batch)

Run when there is no open `content/queue-refresh-*` PR (an open one is still
going through the self-merge gate, see step 3 of "How the content loop works")
and fewer than 4 approved entries are still unwritten. An entry counts as
written once its PR is open or merged. Each run writes before it researches,
so after a run writes 2 of 4 waiting entries, research runs in that same run. Research produces proposals only:

1. Read the automated digest and the manual digest as described in "Data
   sources". Steer by the data, highest expected gain first. Prefer
   **first-party, practical content**. Google gives little detail about what core
   updates change. Early analyses of the November 2026 core update by SEO analysts are
   observations, not Google statements. SISTRIX (UK visibility data) and
   Rheinwunder (German sector data, reported by seo-kreativ.de) saw gains for
   official sites on searches for their own name and for original data
   sources, and losses for informational content written mainly to drive
   conversions, for price-comparison and review platforms, and for broad
   explainers. That is consistent with Google's long-standing guidance to make
   helpful, people-first content. So:
   - Build pages on what only this site knows: exact scoring and combo tables,
     booster costs, level gates, themes, and real gameplay situations from
     "Confirmed game facts". Narrow, practical how-tos beat broad explainers.
   - A new comparison or alternatives page must add first-hand, specific
     information about Dhamaka Blocks, or say how the comparison was done (what
     was checked, from which store listing, on which date), that no existing
     post already has. Competitor facts stay hedged (see "Hard rules"). Never
     publish a near-duplicate listicle that only reshuffles the same games.
   - Brand searches ("dhamaka game", "dhamak game") belong to the homepage and
     official pages. A queue edit's target must be a blog post, so report
     brand-search problems to the owner in the run report instead of proposing
     them.
   - Google's pre-announcement of the December 2026 core update (Search Status
     Dashboard, 2026-11-24) says it "focuses on multiple improvements to how our
     systems understand and rank relevant content (including for longer and
     more complex questions)". Answer-first sections and FAQs that answer a full
     question in the first sentence fit that.
   - While a ranking update is rolling out or settling, treat digest-based
     steering as provisional and say so in the batch PR.
   Fill the batch's new-post slots first (see step 4), from these sources:
   - **Queries with impressions but no clicks** (`impressions-only`), including
     modifiers such as "offline", "for android", "no ads android".
   - **New posts in the clusters that earn clicks**: comparison/alternatives,
     the honest "no ads" angle, India, then offline and gameplay tips.
     Wellness/lifestyle only with a rising query in the digest.
   - **Outside demand** (`unproven`), found as described in step 2: questions
     players ask, topics competitors rank for, and questions people ask AI
     assistants about block puzzle games, that no existing post answers in
     depth.
   - **Other languages** only where the digest shows impressions (e.g.
     Indonesian, German), and only as a labelled proposal for the owner.
   Then the edit slots:
   - **Page edits** on high-impression, low-CTR page-1 pages, and on the top
     page's main queries ("block blast alternative", "games like block blast")
     to move them toward the top 3.
   - **Optional inbound links** to published new posts (see step 4).
   Search Console only shows queries the site already appears for, so it cannot
   reveal unmet demand. That is why outside demand is researched every batch
   (added 2026-11-27, after a batch found no new-post candidates in first-party
   data alone).
2. **Find outside demand** (every batch, with WebSearch):
   - **Seeds:** "block puzzle", "block blast", "blockudoku", "woodoku",
     "1010", each combined with modifiers such as tips, strategy, high score,
     combo, offline, no ads, how, why and can.
   - **Player questions:** questions players ask on public pages, found by
     searching forums and communities (for example Reddit or Quora). Public
     pages only: nothing behind a login, in a private or closed group, or in a
     personal message. Record each as a `web-search` item.
   - **Competitor and ecosystem queries:** "games like block blast",
     "[game] vs [game]", "is [game] free/safe/offline", and People-Also-Ask
     phrasing where a result shows it. Record as `competitor-research` or
     `web-search`.
   - **AI questions:** questions people put to ChatGPT, Perplexity, Gemini or
     Google AI Overviews, where you can actually see one: a public share page,
     or an AI Overview shown for a search (record that search's URL and the
     date, and name the search query in the quote; an overview can change, so
     this is weak evidence). There is no direct source for what people ask assistants: the
     digest's GA4 AI-assistant landing pages show which topics assistants
     already send visitors to. Use them as a pointer for where to research,
     never as evidence of a question. Record as `ai-question` only a question
     you saw. Expect this kind to be rare.
   - **What to store.** Every supplementary item needs an https `url`, a
     `fetched_at` date (at most 10 days before `proposed_at`) and a `quote`
     (at least 20 characters). The 10-day limit for supplementary items is
     this file's rule; `scripts/check-queue-gate.js` checks the age of
     first-party items only. `content-queue.json` is not served on the site
     (`.assetsignore`), but it is in the git history, so treat it as public:
     - the quote is the question only, in one or two sentences, preferably a
       paraphrase starting "paraphrase of:";
     - remove usernames, handles, real names, places and any personal detail;
       if the question cannot be separated from them, do not use that source;
     - from an AI share page, store the question only, never the rest of the
       conversation.
   - **Counts.** Record only what you saw: how many separate threads ask the
     question, or a thread's reply or vote count, with the URL. Never write
     "many players ask" or similar unless the recorded URLs show it.
   - **No estimates.** Do not use search volume, keyword difficulty or traffic
     estimates from any third-party tool or article (owner decision,
     2026-11-27: no paid keyword tool). Outside demand is a signal, not a
     measured volume, and is labelled `unproven`.
3. Stay inside this project's positioning: block-puzzle strategy/comparison
   content, app-trust questions, or the India/festive angle. No unrelated
   gaming topics. Hard rules apply: no solver/cheat/MOD-APK topics, no invented
   numbers, never claim Dhamaka Blocks is ad-free.
4. Propose 6-8 entries per batch, about three new posts for every page edit
   (for example 6 new posts and 2 edits). Only 4 entries are merged a week,
   so an unwritten backlog is expected; research runs again when fewer than 4
   approved entries are unwritten.
   **When a new post qualifies.** It has:
   - first-party evidence (`evidence.first_party`, quoting a zero result where
     there is no match). If neither digest is usable, propose nothing that
     needs first-party evidence, including outside-demand posts;
   - for the `unproven` label, at least one supplementary item stored as in
     step 2;
   - a pass on the overlap rule below;
   - a narrow, practical scope that answers one question fully.
   Every claim about Dhamaka Blocks must come from "Confirmed game facts".
   General gameplay advice is allowed, phrased as a suggestion, with no
   statistics, success rates or promised outcomes. Claims about other games
   stay hedged (see "Hard rules").
   **Overlap rule for narrower posts (owner decision, 2026-11-27).** A new
   post may answer a question that existing posts only mention in passing. A
   topic counts as covered, and therefore not distinct, if any existing post
   has it in its title, meta description, h1, h2, h3, intro, a table or an
   FAQ question or answer, or if all the existing mentions together come to
   more than one paragraph. A covered topic gets a page edit to that post
   instead. For a distinct topic:
   - `overlap_check.result` is `distinct`, and its notes name each existing
     post that mentions the topic and quote the first words of each mentioning
     paragraph, so the reviewer can open the post and check;
   - the new post's 2-3 `internal_links` are the posts that mention it (the
     first 3 if more do), topped up from closely related posts if fewer than 2
     mention it.
   **Optional inbound link.** A link from an older post to the new one is a
   page edit of element `internal-links`. It is optional, because every new
   post is already linked from `blog/index.html`, `sitemap.xml` and
   `llms.txt`. It competes for the edit slot, and it can be proposed only:
   - in a batch after the new post is published, because an edit's
     `internal_links` must name existing posts;
   - when the older post has a first-party page row with impressions;
   - when no other proposed edit targets that post;
   - for at most 3 links in one entry.
   On the top page it counts as a top-page edit, with the 7-day gap. A
   link-only edit does not change `dateModified`, `article:modified_time` or
   `lastmod`; the Modified Date Check warning it raises is expected.
   **Shape of each new post.**
   - The answer comes in the first sentence.
   - Include one worked example only where the topic involves scoring, coins
     or booster costs. Use only values stated in "Confirmed game facts", pick
     inputs that give a whole number, and never state a rounding rule. Omit
     the example otherwise.
   - Add a table where a comparison helps.
   - Add an FAQ whose answers each answer the full question in their first
     sentence.
   **How many.** When at least 3 candidates qualify, include **at least 3 new
   posts**; when 2 qualify, include both. Exception: if the latest "Reviewing
   weaker-evidence posts" check found that at least half of the reviewed
   `unproven` new posts earned no clicks, propose at most 1 `unproven` new
   post per batch until a later review shows otherwise. This target never
   overrides the hard rules, the overlap rule or honest evidence labels.
   Proposing fewer is acceptable; the PR body then names the candidates you
   considered and why each was rejected. Each new
   post entry has `status: "proposed"`, a real `slug`, `title`, `intent`,
   one-line `angle`, 2-3 `internal_links`, `proposed_at` (today, IST) and
   `publish_after` at least 3 days later, plus `evidence` and `overlap_check`
   as above. Each edit entry follows "Page edits". Add no `approval` block.
   Run `node scripts/check-queue-gate.js` before committing; it must exit 0.
5. Before creating the branch, check whether
   `content/queue-refresh-<today>` already exists on the remote
   (`git ls-remote --heads origin | grep queue-refresh-<date>`) or has an open
   PR. If so, stop and report; do not force-push, delete or recreate it.
   Otherwise commit only `content-queue.json` on that branch and open a PR
   titled "Content batch <date>: N entries for approval". The body lists each
   entry (new post or edit, target query, evidence with source and window,
   demand label and limits, overlap check or target page data) and says
   plainly: merging this PR approves the entries left in it; delete any you do
   not want first; each approved entry is then written as its own PR for
   separate review. Keep queue research and article writing in separate PRs.

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
   This self-review is the writer's own check. It never replaces the
   independent review in "Self-merge gate", and you never approve your own PR
   with GitHub's review feature; merging follows only that gate.

## Owner's spot-check (optional since 2026-11-25)

1. Read the self-review comment first, then verify it against the diff
   yourself — treat the comment as a starting point, not a substitute for
   your own check.
2. Read every factual sentence — does it match "Confirmed game facts" above?
   Flag anything invented.
3. Check the "Hard rules" section — no solver/cheat/MOD references, no
   fabricated competitor stats, no ad content.
4. Confirm the required-elements checklist above is satisfied.
5. Spot-check UTM params are present and use the post's own slug.
6. The routine merges content PRs that pass the self-merge gate. To stop a
   PR, close it or push a fix before the next run; to stop all merges, set
   `enabled` to false in `.jules/automerge.json`.
