# NaloHub, Marketing Site & LLM Visibility Baseline (v2)

> Living reference for nalohub.com (the static marketing site, separate from the app repo).
> v2 issued 15 Aug 2026 after full deployment. Supersedes the 12 Aug version (delete that copy).
> Companion to ARCHITECTURE.md, which covers the app.
> Style rule: no em dashes anywhere in NaloHub content. Use commas, colons, or full stops.

---

## 1. Hosting & deploy

- Host: Uptime Web Hosting Australia, cPanel account `pudteabh`, webroot `public_html`.
  Server IP 43.229.62.26. Domain registered at GoDaddy; DNS is authoritative at Uptime
  (ns1/ns2/ns3.uthost.au). GoDaddy holds registration only. Never add DNS records at GoDaddy.
- Deploy method: zip built by Claude, uploaded via cPanel File Manager, Extract to
  `/public_html`, allow overwrite. No build system; plain static HTML.
- `index-backup-*.html` files live OUTSIDE the webroot (`/home/pudteabh/`). Never leave
  backups in `public_html`.
- GoDaddy Airo ghost sites for nalohub.com and zantales.com deleted by GoDaddy support 12 Aug.

## 2. Site structure (12 indexable pages, all deployed)

| Page | Notes |
| --- | --- |
| `index.html` | Homepage. Organization + SoftwareApplication JSON-LD, canonical. Contextual in-body links to both landing pages (committee section, pricing section). Footer links: Free tools, Articles, For committees, NaloHub vs MYBOS. |
| `features.html` | Feature-map page, masthead injected above its own hero. |
| `free-tools.html` | 20 free documents (files in `/free-tools/`). |
| `articles.html` | Articles index (5 cards, no visible dates) plus a "Guides & comparisons" strip linking both landing pages. |
| `articles/*.html` ×5 | what-your-building-forgets · allowed-to-ask · deadlines-nobody-hands-you · nobody-is-hiding-anything · the-work-nobody-can-see. Article JSON-LD, byline "Greg Ferguson, founder of NaloHub", schema dates kept, visible dates removed. |
| `strata-software-for-committees.html` | Landing page, FAQPage schema. Positioning: committee ownership, Australia-wide (all 8 jurisdictions), strata manager stays in place, BM as ally, self-managed schemes one paragraph only. Replaced an unpublished self-managed/QLD draft; that URL never went live. |
| `nalohub-vs-mybos.html` | Fair buyer's-guide comparison, public sources only, NO pricing content by decision (value dimensions instead: governance, resident and committee experience, PWA, data ownership). Includes "when MYBOS is better". |
| `privacy.html` | Canonical added. |

Also in webroot: `resources.html` (meta-refresh to free-tools), `/resources/` (old files,
301-redirected), `/leg-scr/` (state legislation JSON for NaloPilot, must stay reachable,
excluded from crawling), `NaloHub-Logo.png`, Google + Bing verification files (keep forever).

## 3. Design system

- Canonical two-row masthead on every page: 72px brand + CTA row, 48px centred links row.
  Background is SOLID `#0b1220` (never translucent or blurred; translucency caused
  page-dependent tinting). Brand is the inline SVG wordmark with colour pinned to `#eaf2fb`
  (the SVG uses currentColor and inherits page link colours if unpinned). Hamburger <861px.
- Subpage nav: Home · Features · Pricing · Free tools · Articles · Feature map, plus
  Talk to us and See the live demo buttons. Homepage keeps its fuller anchor set.
- Landing/article pages: wave-hero + prose template, `nh-*` scoped classes.
- Meta descriptions ≤160 chars sitewide (Bing errors above that). Rewrite, don't truncate.

## 4. Crawler & indexing infrastructure

- robots.txt: allow-all with named AI crawler allows (GPTBot, OAI-SearchBot, ChatGPT-User,
  ClaudeBot, Claude-Web, anthropic-ai, PerplexityBot, Google-Extended, CCBot); Disallow
  `/leg-scr/`, `/resources/`, `/index-backup-`; Sitemap line.
- sitemap.xml: 12 URLs with lastmod. Update whenever a page is added.
- .htaccess (appended blocks, in order): 35 × 301 redirects old `/resources/` files to
  `/free-tools/`; `resources.html` → `free-tools.html`; `Options -Indexes`; and (15 Aug)
  host canonicalisation: all `www.nalohub.com` traffic 301s to the bare domain.

## 5. Search engine status (as at 15 Aug 2026)

- Google Search Console: URL-prefix property, HTML-file verified. Sitemap Success.
  **9 pages indexed** within the first week. Known non-indexed reasons, all benign or in
  progress: "Crawled/Discovered, currently not indexed" (new-site queue), and one
  "Duplicate canonical" on privacy.html caused by historical www crawls, fixed by the
  www redirect; Validate Fix requested 15 Aug.
- Bing Webmaster Tools: imported from GSC. Live URL tests pass. Bing previously held a stale
  pre-launch "Launching Soon" snapshot (this is what ChatGPT browsing reflected); indexing
  requested to clear it. AI Performance (beta) tab tracks AI-answer citations.

## 6. cpGuard / bot access (resolved)

- Uptime runs cpGuard server-wide (Bot Attacks log in cPanel). It blocked genuine AI crawlers
  because OpenAI's newer published ranges (9.129.0.0/17, 172.204.28.x, both verified against
  openai.com JSON lists) postdated its definitions. Vendor-side fix applied 12 Aug.
- Verified working: ChatGPT live-fetched `articles.html` (created that day, uncacheable) and
  listed all five article titles with a nalohub.com citation.
- The log records blocks only; allowed crawlers don't appear. If legitimate bots are blocked
  again: verify the IP against the operator's published ranges, then reply on the Uptime
  ticket with the log row and the published-range match.

## 7. Measurement

- NaloHub-LLM-Visibility-Tracker.xlsx: 8 fixed questions × 4 models (ChatGPT, Claude,
  Perplexity, Gemini), monthly; Summary tab auto-counts mentions and citations.
  Q1 = branded control. Baseline run pending.
- Complementary: GSC Performance tab (non-branded queries), Bing AI Performance tab.

## 8. Parked / next levers

- 5 trade-pitch articles NOT on the site (reserved as editor exclusives; revisit ~end Sept 2026).
- llms.txt: assessed not worth prioritising.
- Next strategic lever is off-site citations: LookUpStrata paid directory ($250+GST, now
  unblocked) and Capterra/GetApp listings. These now outweigh further on-site content.
