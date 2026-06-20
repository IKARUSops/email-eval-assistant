"""Minimal retry wrapper for flaky network calls (rate limits, timeouts)."""

import time
import functools

import config


def with_retries(fn):
    @functools.wraps(fn)
    def wrapper(*args, **kwargs):
        last_exc = None
        for attempt in range(1, config.MAX_RETRIES + 1):
            try:
                return fn(*args, **kwargs)
            except Exception as exc:
                last_exc = exc
                if attempt == config.MAX_RETRIES:
                    break
                wait = config.RETRY_BACKOFF_SECONDS * attempt
                print(f"  [retry] {fn.__name__} failed ({exc!r}), retrying in {wait}s "
                      f"(attempt {attempt}/{config.MAX_RETRIES})")
                time.sleep(wait)
        raise last_exc
    return wrapper
