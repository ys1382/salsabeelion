# salsabeelion

Small web and game-adjacent projects: static demos (language learning, environmental pitch, crochet pattern hub), **Climatic Mysteries** (`climaticMysteries/`), and shared tooling to host them over HTTPS.

This repo intentionally does **not** include large or private material (for example: Godot `*.wasm` / `*.pck` exports, TLS key material, or unrelated game trees that lived only in the original workspace).

## Layout

| Path | Purpose |
|------|---------|
| `climaticMysteries/` | Climatic Mysteries: HTML/JS assets, `serve.py` (HTTPS + COOP/COEP for Godot), `scripts/deploy.sh` |
| `maestrosOdyssey/`, `envDyst/`, `crocheter/` | Requirements docs + static `www/` sites |
| `top/directory/` | Hub page listing links to deployed apps |
| `top/_shared/` | `serve_static_https.py` — simple static HTTPS server for the hub and demos |
| `top/scripts/` | `deploy-kids-sites.sh` — rsync + restart those sites on the server |
| `halalit/`, `harun/` | Other small project folders |

## Deploy

You need **SSH** to the host (default `root@157.230.130.12`) and **Python 3** on the server for the tiny HTTPS servers.

### 1. Kid hub + static demos (Maestro’s Odyssey, envDyst, crocheter, directory)

From the **repository root** (parent of `top/`):

```bash
./top/scripts/deploy-kids-sites.sh
```

Optional overrides:

```bash
./top/scripts/deploy-kids-sites.sh user@host remote_dir_name
```

Defaults: host `root@157.230.130.12`, remote directory `kids-sites`. The script syncs files, creates a self-signed cert under `~/kids-sites/ssl/` if missing, and starts HTTPS on ports **8070–8073** (hub **8070**).

### 2. Climatic Mysteries (`climaticMysteries`) web build

From `climaticMysteries/`:

```bash
./scripts/deploy.sh
```

Optional: `./scripts/deploy.sh user@host climatic-mysteries 8060`

If `index.wasm` and `index.pck` are not in the repo (often gitignored), the script keeps existing binaries on the server. Default URL pattern: `https://157.230.130.12:8060/` (and `/app.html`, `/godot.html` as applicable).

### TLS note

Deploy scripts use **self-signed** certificates so browsers will warn until you put the services behind a real hostname with a CA-issued cert (for example nginx + Let’s Encrypt).
