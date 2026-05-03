#!/usr/bin/env python3
"""Local server for Godot web exports with required COOP/COEP headers.
   Requires HTTPS (or localhost) for SharedArrayBuffer in browsers.
   Usage: serve.py [PORT] [DIRECTORY] [KEY_PEM] [CERT_PEM]
   If KEY_PEM and CERT_PEM are given, serves over HTTPS."""
import http.server
import ssl
import sys
import os

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8060
DIRECTORY = (
    os.path.abspath(sys.argv[2])
    if len(sys.argv) > 2
    else os.path.join(os.path.dirname(os.path.dirname(__file__)), "build", "web")
)
KEY_PEM = sys.argv[3] if len(sys.argv) > 3 else None
CERT_PEM = sys.argv[4] if len(sys.argv) > 4 else None
BIND = sys.argv[5] if len(sys.argv) > 5 else ""


class GodotHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Embedder-Policy", "require-corp")
        super().end_headers()


if __name__ == "__main__":
    server = http.server.HTTPServer((BIND or "", PORT), GodotHandler)
    if KEY_PEM and CERT_PEM and os.path.isfile(KEY_PEM) and os.path.isfile(CERT_PEM):
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ctx.load_cert_chain(CERT_PEM, KEY_PEM)
        server.socket = ctx.wrap_socket(server.socket, server_side=True)
        scheme = "https"
    else:
        scheme = "http"
    addr = BIND or "0.0.0.0"
    print(f"Serving Boe at {scheme}://{addr}:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
