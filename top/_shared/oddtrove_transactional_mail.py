"""Odd Trove — transactional email (Gmail SMTP or Resend). Stdlib only."""
from __future__ import annotations

import json
import os
import smtplib
import ssl
import urllib.error
import urllib.request
from email.message import EmailMessage
from typing import Any


def mail_configured() -> bool:
    mode = (os.environ.get("ODDTROVE_MAIL_MODE") or "smtp").strip().lower()
    if mode == "resend":
        return bool((os.environ.get("ODDTROVE_RESEND_API_KEY") or "").strip())
    user = (os.environ.get("ODDTROVE_SMTP_USER") or os.environ.get("ODDTROVE_MAIL_FROM") or "").strip()
    password = (os.environ.get("ODDTROVE_SMTP_PASS") or "").strip()
    return bool(user and password)


def _mail_from() -> str:
    return (
        os.environ.get("ODDTROVE_MAIL_FROM")
        or os.environ.get("ODDTROVE_SMTP_USER")
        or "nightofhonour@gmail.com"
    ).strip()


def _password_reset_bodies(*, site_name: str, reset_url: str) -> tuple[str, str, str]:
    subject = f"Reset your {site_name} password"
    text = (
        f"You asked to reset your {site_name} password.\n\n"
        f"Open this link within one hour:\n{reset_url}\n\n"
        "If you did not ask for this, you can ignore this email.\n"
    )
    html = (
        f"<p>You asked to reset your <strong>{site_name}</strong> password.</p>"
        f'<p><a href="{reset_url}">Reset password</a> (link expires in one hour)</p>'
        "<p>If you did not ask for this, you can ignore this email.</p>"
    )
    return subject, text, html


def send_password_reset(*, to_email: str, reset_url: str, site_name: str) -> bool:
    """Send reset mail. Returns True on success, False if not configured or send failed."""
    to_email = str(to_email or "").strip()
    if not to_email or not mail_configured():
        return False
    subject, text, html = _password_reset_bodies(site_name=site_name, reset_url=reset_url)
    mode = (os.environ.get("ODDTROVE_MAIL_MODE") or "smtp").strip().lower()
    if mode == "resend":
        return _send_resend(to_email=to_email, subject=subject, text=text, html=html)
    return _send_smtp(to_email=to_email, subject=subject, text=text, html=html)


def _send_smtp(*, to_email: str, subject: str, text: str, html: str) -> bool:
    host = (os.environ.get("ODDTROVE_SMTP_HOST") or "smtp.gmail.com").strip()
    port = int(os.environ.get("ODDTROVE_SMTP_PORT") or "587")
    user = (os.environ.get("ODDTROVE_SMTP_USER") or _mail_from()).strip()
    password = (os.environ.get("ODDTROVE_SMTP_PASS") or "").strip()
    if not user or not password:
        return False
    msg = EmailMessage()
    msg["From"] = _mail_from()
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(text)
    msg.add_alternative(html, subtype="html")
    try:
        context = ssl.create_default_context()
        with smtplib.SMTP(host, port, timeout=30) as smtp:
            smtp.ehlo()
            smtp.starttls(context=context)
            smtp.ehlo()
            smtp.login(user, password)
            smtp.send_message(msg)
        return True
    except (OSError, smtplib.SMTPException):
        return False


def _send_resend(*, to_email: str, subject: str, text: str, html: str) -> bool:
    api_key = (os.environ.get("ODDTROVE_RESEND_API_KEY") or "").strip()
    if not api_key:
        return False
    payload: dict[str, Any] = {
        "from": _mail_from(),
        "to": [to_email],
        "subject": subject,
        "text": text,
        "html": html,
    }
    req = urllib.request.Request(
        "https://api.resend.com/emails",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return 200 <= resp.status < 300
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError):
        return False
