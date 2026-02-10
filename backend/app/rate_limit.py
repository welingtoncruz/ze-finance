"""
Rate limiting configuration for API endpoints.
Uses SlowAPI with in-memory store (use Redis in production for distributed deploys).
Disabled when ENVIRONMENT=test so integration tests do not hit limits.
When slowapi is not installed, provides a no-op limiter so the app runs without rate limiting.
"""
import os
from typing import Any

try:
    from slowapi import Limiter
    from slowapi.util import get_remote_address

    _limiter = Limiter(
        key_func=get_remote_address,
        enabled=os.getenv("ENVIRONMENT", "development") != "test",
    )
    RATE_LIMIT_AVAILABLE = True
except ImportError:
    RATE_LIMIT_AVAILABLE = False

    class _NoopLimiter:
        """No-op limiter when slowapi is not installed."""

        def limit(self, *args: Any, **kwargs: Any) -> Any:
            def decorator(f: Any) -> Any:
                return f
            return decorator

    _limiter = _NoopLimiter()

limiter = _limiter
