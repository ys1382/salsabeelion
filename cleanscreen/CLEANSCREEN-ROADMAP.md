# CleanScreen Search — roadmap

Owner beta on `/cleanscreen/`. Policy rules live in `config/policy_rules.json` and domain lists under `config/`.

## Shipped in owner beta

- Kid mode (default) vs parent mode toggle
- Four-gate rule of thumb in config: always block → kids allowlist → parent-only → open web + snippet filters
- Kids allowlist: public libraries, vetted bookstores, school tools, Minecraft/LEGO, faith/education picks, etc.
- Parent-only categories: news, shopping, forums, anime, gaming publishers, Wikipedia, AI, and more (see `parent_only_domains.json`)
- Always block both modes: streaming, fanfic, fanservice hubs, bypass/paste tools
- Private feedback log (`cleanscreen-data/feedback.jsonl`) — rate limited, no sign-in

## Not built yet (owner said: roadmap only for now)

- **Kidsproof parent unlock** — only a proper adult can enable parent mode (not a kid checkbox when public)
- **Parent survey flow** — vote whether borderline sites (Amazon, Spotify, Cool Math, etc.) belong on the kids allowlist
- **Structured kid feedback** — “this site is 100% clean” suggestions with owner review queue
- **Promote from feedback** — workflow to move a site from `parent_only_domains.json` or survey queue into `vetted_domains.json`
- Thumbnail / video preview vetting
- Default browser search replacement
- Public access (nginx owner gate stays until launch)

## Survey queue

Listed in `config/policy_rules.json` → `surveyQueue`. Parent-only in config until owner or survey promotes them.

## ForeWarner

Click-warning before watch/read is a **separate** product (`clickWarning/`). CleanScreen stays search-only.
