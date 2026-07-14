#!/usr/bin/env python3
"""
Local Halalit stand-in (same shape as oddtrove.art): static under /halalit/,
API under /halalit/api/ → 127.0.0.1:8075.

Usage (from repo):
  python3 halalit/scripts/serve-local-halalit.py
Then open http://127.0.0.1:8744/halalit/
"""
from __future__ import annotations

import http.client
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parents[2]
WWW = ROOT / "halalit" / "www"
API_HOST = os.environ.get("HALALIT_LOCAL_API_HOST", "127.0.0.1")
API_PORT = int(os.environ.get("HALALIT_LOCAL_API_PORT", "8075"))
BIND = os.environ.get("HALALIT_LOCAL_BIND", "127.0.0.1")
PORT = int(os.environ.get("HALALIT_LOCAL_PORT", "8744"))

MIME = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".map": "application/json",
    ".txt": "text/plain; charset=utf-8",
}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args) -> None:
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def do_OPTIONS(self) -> None:
        if self.path.startswith("/halalit/api/"):
            self._proxy()
            return
        self.send_response(204)
        self.end_headers()

    def do_GET(self) -> None:
        self._dispatch()

    def do_POST(self) -> None:
        self._dispatch()

    def do_PUT(self) -> None:
        self._dispatch()

    def do_DELETE(self) -> None:
        self._dispatch()

    def _dispatch(self) -> None:
        parsed = urlparse(self.path)
        path = unquote(parsed.path or "/")
        if path in ("/", "/halalit"):
            self.send_response(302)
            self.send_header("Location", "/halalit/")
            self.end_headers()
            return
        if path.startswith("/halalit/api/") or path == "/halalit/api":
            self._proxy()
            return
        if path.startswith("/halalit/"):
            self._static(path[len("/halalit/") :])
            return
        self.send_error(404, "Not found")

    def _proxy(self) -> None:
        parsed = urlparse(self.path)
        # /halalit/api/foo → /api/foo
        suffix = parsed.path[len("/halalit") :] or "/api/"
        if not suffix.startswith("/api"):
            suffix = "/api" + suffix
        target = suffix
        if parsed.query:
            target += "?" + parsed.query
        length = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(length) if length else None
        headers = {}
        for k in ("Content-Type", "Accept", "Cookie", "Origin", "X-Requested-With"):
            v = self.headers.get(k)
            if v:
                headers[k] = v
        headers["Host"] = "%s:%s" % (API_HOST, API_PORT)
        headers["X-Forwarded-Proto"] = "http"
        try:
            conn = http.client.HTTPConnection(API_HOST, API_PORT, timeout=90)
            conn.request(self.command, target, body=body, headers=headers)
            resp = conn.getresponse()
            data = resp.read()
        except OSError as e:
            msg = ("API not reachable at %s:%s (%s). Start halalit/server first." % (API_HOST, API_PORT, e)).encode()
            self.send_response(502)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", str(len(msg)))
            self.end_headers()
            self.wfile.write(msg)
            return
        self.send_response(resp.status)
        skip = {"transfer-encoding", "connection", "content-length"}
        for k, v in resp.getheaders():
            if k.lower() in skip:
                continue
            self.send_header(k, v)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(data)
        conn.close()

    def _static(self, rel: str) -> None:
        rel = rel.split("?", 1)[0]
        if not rel or rel.endswith("/"):
            rel = (rel or "") + "index.html"
        # block path escape
        candidate = (WWW / rel).resolve()
        try:
            candidate.relative_to(WWW.resolve())
        except ValueError:
            self.send_error(403)
            return
        if not candidate.is_file():
            self.send_error(404)
            return
        data = candidate.read_bytes()
        ctype = MIME.get(candidate.suffix.lower(), "application/octet-stream")
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)


def main() -> None:
    if not WWW.is_dir():
        print("Missing www at", WWW, file=sys.stderr)
        sys.exit(1)
    server = ThreadingHTTPServer((BIND, PORT), Handler)
    print("Local Halalit: http://%s:%s/halalit/" % (BIND, PORT))
    print("API proxy → http://%s:%s/api/ (start server with HALALIT_COOKIE_SECURE=0)" % (API_HOST, API_PORT))
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
