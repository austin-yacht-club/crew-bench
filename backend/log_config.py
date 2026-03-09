"""
Centralized logging configuration for Crew Bench backend.
Configure via env: LOG_LEVEL (DEBUG|INFO|WARNING|ERROR), LOG_FILE (optional path).
"""
import logging
import os
import sys
from logging.handlers import RotatingFileHandler

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
LOG_FILE = os.getenv("LOG_FILE", "").strip()
LOG_MAX_BYTES = int(os.getenv("LOG_MAX_BYTES", "5_242_880"))  # 5 MB
LOG_BACKUP_COUNT = int(os.getenv("LOG_BACKUP_COUNT", "3"))

# Same format for console and file
LOG_FORMAT = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
DATE_FORMAT = "%Y-%m-%d %H:%M:%S"


def get_log_level():
    """Return the configured log level (default INFO)."""
    level = getattr(logging, LOG_LEVEL, None)
    return level if isinstance(level, int) else logging.INFO


def configure_logging(name: str = "crew_bench") -> logging.Logger:
    """
    Configure root/app logging and return a logger for the given name.
    Call once at application startup (e.g. in main.py).
    """
    level = get_log_level()
    root = logging.getLogger()
    root.setLevel(level)

    # Avoid duplicate handlers if called multiple times
    if root.handlers:
        return logging.getLogger(name)

    formatter = logging.Formatter(LOG_FORMAT, datefmt=DATE_FORMAT)

    # Console
    console = logging.StreamHandler(sys.stdout)
    console.setLevel(level)
    console.setFormatter(formatter)
    root.addHandler(console)

    # Optional rotating file
    if LOG_FILE:
        try:
            file_handler = RotatingFileHandler(
                LOG_FILE,
                maxBytes=LOG_MAX_BYTES,
                backupCount=LOG_BACKUP_COUNT,
                encoding="utf-8",
            )
            file_handler.setLevel(level)
            file_handler.setFormatter(formatter)
            root.addHandler(file_handler)
        except OSError:
            logging.warning("Could not open log file %s; file logging disabled", LOG_FILE)

    # Reduce noise from third-party loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)

    return logging.getLogger(name)
