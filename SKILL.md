---
name: video-moderation
description: Automated video content moderation tool. Scans admin panel video lists for illegal/risky content using keyword blacklists, downloads covers for manual review, and generates compliance reports with HTML dashboards. Use when asked to scan videos, check content compliance, generate moderation reports, or review video covers.
---

# Video Content Moderation Tool

## Overview

This tool automates content compliance scanning for video admin panels (LayUI-based). It:
1. Logs into the admin panel via Playwright
2. Scrapes video metadata (title, tags, description, cover images)
3. Checks against a two-tier keyword blacklist (VIOLATION + RISK)
4. Generates CSV/JSON reports and an HTML dashboard
5. Produces a cover review page for manual visual inspection

## Quick Start

```bash
# 1. Setup (first time only)
bash scripts/setup.sh

# 2. Configure credentials
cp .env.example .env
# Edit .env with admin credentials

# 3. Run a scan
bash scripts/scan.sh                    # Full scan (default 50 pages)
bash scripts/scan.sh --max-pages 10     # Scan 10 pages
bash scripts/scan.sh --headless         # Headless mode (for CI/server)
bash scripts/scan.sh --skip-covers      # Skip cover downloads (fast mode)
bash scripts/scan.sh --skip-descriptions # Skip description fetching

# 4. View reports
bash scripts/dashboard.sh              # Regenerate dashboard
open output/dashboard.html             # Overview dashboard
open output/cover-review.html          # Manual cover review
open output/violations.csv             # Latest CSV report
```

## Key Commands for Agent

| Task | Command |
|------|---------|
| Install dependencies | `bash scripts/setup.sh` |
| Run full scan | `node src/main.js` |
| Run scan with options | `node src/main.js --headless --max-pages 10` |
| Generate dashboard only | `node src/dashboard.js` |
| Run tests | `npm test` |
| View help | `node src/main.js --help` |

## Configuration

### Environment Variables (`.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `ADMIN_ACCOUNT` | Yes | Admin panel username |
| `ADMIN_PASSWORD` | Yes | Admin panel password |
| `ADMIN_CARD_NUM` | No | Card number field (if login requires it) |

### Site URL

Edit `src/config.js` line `baseUrl` to change target admin panel URL.

### Blacklist Keywords

Edit `data/blacklist.json` to add/remove keywords. Structure:

```json
{
  "violations": {
    "underage": ["keyword1", "keyword2"],
    "violence": ["keyword3"],
    "animal": ["keyword4"],
    "gore": ["keyword5"]
  },
  "risks": {
    "risk_age": ["keyword6"],
    "risk_consent": ["keyword7"],
    "risk_incest": ["keyword8"]
  },
  "violence_patterns": [
    { "regex": "pattern", "desc": "description" }
  ],
  "violence_safe_words": ["safe1", "safe2"]
}
```

No code changes needed — just edit the JSON and re-run.

## Architecture

```
src/
├── main.js            # Orchestrator: login → scrape → check → report
├── config.js          # Configuration + CLI args
├── login.js           # Playwright login automation
├── scraper.js         # Video list scraping + cover download
├── checker.js         # Keyword matching + description format check
├── blacklist.js       # Loads data/blacklist.json, provides matchers
├── reporter.js        # CSV + JSON report writer
├── cover-analyzer.js  # Cover review HTML page generator
├── dashboard.js       # Dashboard HTML report generator
└── retry.js           # Network retry with exponential backoff
data/
└── blacklist.json     # Keyword blacklists (editable, no code change needed)
output/                # Generated reports, covers, dashboards
tests/                 # Unit tests for checker + blacklist
```

## Output Files

| File | Description |
|------|-------------|
| `output/violations_<timestamp>.csv` | Timestamped CSV report |
| `output/violations_<timestamp>.json` | Timestamped JSON report |
| `output/violations.csv` | Latest CSV (symlink) |
| `output/violations.json` | Latest JSON (symlink) |
| `output/dashboard.html` | Visual dashboard with charts and tables |
| `output/cover-review.html` | Interactive cover review page |
| `output/covers/` | Downloaded cover images |

## Two-Tier Detection

- **VIOLATION (hard)**: Illegal content — underage, violence/coercion, bestiality, gore
- **RISK (soft)**: Needs human review — age-ambiguous terms, voyeurism, incest themes

## Troubleshooting

- **Login fails**: Check `.env` credentials. If the site has a `card_num` field, set `ADMIN_CARD_NUM`.
- **No videos found**: The site's menu label might differ. Edit `CONFIG.menuLabel` in `src/config.js`.
- **Playwright not installed**: Run `npx playwright install chromium`.
- **Per-page not working**: The site might not support 1000/page. The tool auto-falls back to the largest available option.
