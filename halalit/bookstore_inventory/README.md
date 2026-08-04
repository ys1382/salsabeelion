# Bookstore inventory aggregation for Halalit

## What this is

Halalit can show **where a book appears to be listed** at participating bookstores and send readers to that store’s site or map. Halalit **does not** sell books, take payment, or guarantee stock.

Recommendations stay separate: Book Quest / hand-vet quality still come first unless the reader chooses an availability filter later.

## Architecture

```
halalit/bookstore_inventory/
  adapters/          # per-store adapters (sample fixture, B&N, Kepler’s, Green Apple)
  config/stores/     # JSON config per store (domains, delays, templates)
  fixtures/          # saved HTML/JSON-LD for tests
  jobs/              # APScheduler hooks + locks
  models.py          # SQLite tables (same stack as Halalit accounts)
  matching.py        # ISBN → normalized key → fuzzy (+ review queue)
  freshness.py       # last-checked labels + disclaimers
  service.py         # upsert, public listings, owner dashboard
halalit/server/bookstore_api.py   # HTTP routes
halalit/www/halalit-bookstore-*.js
```

**Database:** SQLite via `HALALIT_BOOKSTORE_DB` (defaults to `HALALIT_ACCOUNTS_DB`). No Postgres required.

**Live access order per store:** official API/feed → public JSON → JSON-LD → static HTML → Playwright only if needed and robots-allowed. LLM page browsing is not used.

## Robots / legal status (starter stores)

| Store | robots notes | Default |
|-------|----------------|---------|
| Sample fixture | local only | **enabled** |
| Kepler’s | `Disallow: /search/`, `/books/`; crawl-delay 10 | **paused / disabled** |
| Green Apple | same IndieCommerce pattern | **paused / disabled** |
| Barnes & Noble | `Disallow: /search` | **paused / disabled** |

ISBN **product pages** (`/book/{isbn}` or B&N `?ean=`) can be checked when you enable an adapter after review. **Full catalog scrape and search are not permitted** by current robots.txt — ask each store for a feed/API or written permission before turning those on.

## Install (API host)

```bash
cd /path/to/halalit
python3 -m pip install -r bookstore_inventory/requirements-bookstore.txt
# Optional later (only if an enabled adapter needs JS on an allowed URL):
# python3 -m pip install crawl4ai playwright
# python3 -m playwright install chromium
```

Stdlib alone is enough for the fixture adapter and JSON-LD ISBN checks.

## Environment

| Variable | Meaning |
|----------|---------|
| `HALALIT_BOOKSTORE_DB` | SQLite path (default: accounts DB) |
| `HALALIT_BOOKSTORE_JOBS=1` | Start APScheduler ISBN watchlist jobs |
| `HALALIT_BOOKSTORE_JOB_MINUTES` | Interval (default 180) |
| `HALALIT_BOOKSTORE_MAX_CONCURRENT` | Cap parallel store jobs (default 2) |
| `HALALIT_BOOKSTORE_USER_AGENT` | Honest bot UA |
| `HALALIT_BOOKSTORE_LIVE_CHECKS=1` | Allow live ISBN checks on inventory POST (still respects per-store `enabled`) |

## Matching

1. ISBN-13  
2. ISBN-10  
3. Normalized title+author+publisher(+edition/format)  
4. Fuzzy only if needed → **admin review** below confidence 0.88  

Does not auto-merge audiobooks with print, different editions, or translations when format/edition differ.

## Freshness

Labels: recently verified / checked today / last few days / possibly stale / unavailable / verification failed.  
Public copy always tells readers to confirm with the bookstore. Missing listings are marked unavailable after **3** failed checks (not deleted immediately).

## Run tests (no live sites)

```bash
cd /path/to/halalit
PYTHONPATH=. python3 -m unittest bookstore_inventory.tests.test_bookstore_inventory -v
# also keep existing:
cd server && python3 -m unittest test_bookcheck_theme_helpers -v
```

## Manual refresh (owner)

Owner’s Office → **Bookstore inventory** → **Run now**, or:

```bash
PYTHONPATH=/path/to/halalit:/path/to/halalit/server \
  HALALIT_BOOKSTORE_DB=/tmp/halalit-bookstore-test.sqlite \
  python3 -c "from bookstore_inventory.service import run_adapter_job; print(run_adapter_job('sample_fixture','fixture_refresh'))"
```

## Add a new bookstore adapter

1. Add `config/stores/<store_id>.json` (approved domains, delay, ISBN URL template, locations).  
2. Add `adapters/<store_id>.py` implementing `BookstoreAdapter` (`search_inventory`, `scrape_inventory`, `check_listing`).  
3. Register with `@register_adapter`.  
4. Add fixtures under `fixtures/` and tests.  
5. Leave `enabled: false` until robots/API/legal review passes.  
6. Prefer feed/API; never bypass CAPTCHA, login walls, or Disallow paths.

## Disable an adapter safely

- Owner’s Office → **Pause**, or set `"paused": true` / `"enabled": false` in store JSON and re-seed.  
- **Mark needs repair** pauses and flags layout/selector issues.  
- Or stop jobs: unset `HALALIT_BOOKSTORE_JOBS`.

## Troubleshoot layout changes

If product pages stop yielding JSON-LD, scraper errors get hint `possible_page_layout_change`. Pause the store, save a new fixture, update the adapter, re-enable after tests pass. Do not scrape Disallow paths to “work around” it — contact the store for a feed instead.

## Public API

- `GET/POST /api/bookstore/inventory` — listings for title/author/isbn  
- `GET /api/bookstore/places` — store + location metadata  
- Owner: `/api/owner/bookstore/dashboard`, `/run`, `/flags`, `/match-review`

Readers never submit arbitrary URLs for the server to scrape.
