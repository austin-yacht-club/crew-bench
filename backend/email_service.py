"""Pluggable email delivery for Crew Bench.

When SMTP_HOST is set, emails are sent via SMTP. Otherwise messages are logged
to the application logger (suitable for local dev and tests).
"""
import logging
import os
import smtplib
from abc import ABC, abstractmethod
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

logger = logging.getLogger("crew_bench.email")


class EmailBackend(ABC):
    @abstractmethod
    def send_email(
        self,
        to: str,
        subject: str,
        body_text: str,
        body_html: Optional[str] = None,
    ) -> None:
        pass


class LogEmailBackend(EmailBackend):
    """Log emails instead of sending (default for dev/test)."""

    def send_email(
        self,
        to: str,
        subject: str,
        body_text: str,
        body_html: Optional[str] = None,
    ) -> None:
        logger.info(
            "EMAIL (log backend)\n  To: %s\n  Subject: %s\n  Body:\n%s",
            to,
            subject,
            body_text,
        )


class SMTPEmailBackend(EmailBackend):
    def __init__(
        self,
        host: str,
        port: int,
        username: Optional[str],
        password: Optional[str],
        from_addr: str,
        use_tls: bool,
    ):
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.from_addr = from_addr
        self.use_tls = use_tls

    def send_email(
        self,
        to: str,
        subject: str,
        body_text: str,
        body_html: Optional[str] = None,
    ) -> None:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = self.from_addr
        msg["To"] = to
        msg.attach(MIMEText(body_text, "plain", "utf-8"))
        if body_html:
            msg.attach(MIMEText(body_html, "html", "utf-8"))

        with smtplib.SMTP(self.host, self.port, timeout=30) as server:
            if self.use_tls:
                server.starttls()
            if self.username and self.password:
                server.login(self.username, self.password)
            server.sendmail(self.from_addr, [to], msg.as_string())
        logger.info("Email sent via SMTP to %s: %s", to, subject)


_email_backend: Optional[EmailBackend] = None


def get_email_backend() -> EmailBackend:
    global _email_backend
    if _email_backend is None:
        smtp_host = (os.getenv("SMTP_HOST") or "").strip()
        if smtp_host:
            _email_backend = SMTPEmailBackend(
                host=smtp_host,
                port=int(os.getenv("SMTP_PORT", "587")),
                username=(os.getenv("SMTP_USERNAME") or "").strip() or None,
                password=(os.getenv("SMTP_PASSWORD") or "").strip() or None,
                from_addr=(os.getenv("SMTP_FROM") or os.getenv("SMTP_USERNAME") or "noreply@crewbench.app").strip(),
                use_tls=(os.getenv("SMTP_USE_TLS", "true").lower() in ("1", "true", "yes")),
            )
        else:
            _email_backend = LogEmailBackend()
    return _email_backend


def reset_email_backend() -> None:
    """Reset cached backend (for tests)."""
    global _email_backend
    _email_backend = None


def set_email_backend(backend: EmailBackend) -> None:
    """Inject a custom backend (for tests)."""
    global _email_backend
    _email_backend = backend
