"""
Centralised logging configuration for Voyageur backend.

Usage in any module:
    from app.core.logging import get_logger
    logger = get_logger(__name__)
    logger.info("message")
    logger.warning("message")
    logger.error("message", exc_info=True)
"""

import logging
import sys


def configure_logging(level: str = "INFO") -> None:
    """Call once at application startup (main.py)."""
    log_level = getattr(logging, level.upper(), logging.INFO)

    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(log_level)

    formatter = logging.Formatter(
        fmt="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    handler.setFormatter(formatter)

    root = logging.getLogger()
    root.setLevel(log_level)

    # Avoid duplicate handlers if called more than once
    if not root.handlers:
        root.addHandler(handler)
    else:
        root.handlers = [handler]

    # Quieten noisy third-party loggers
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    """Return a named logger. Pass __name__ from the calling module."""
    return logging.getLogger(name)
