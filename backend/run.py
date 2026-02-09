"""
Cloud Run / production entrypoint. Reads PORT from environment (Cloud Run sets 8080).
"""
import os
import sys

import uvicorn

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8000"))
    print(f"Starting uvicorn on 0.0.0.0:{port}", flush=True)
    sys.stdout.flush()
    sys.stderr.flush()
    # Use string so uvicorn loads app; avoids importing app here (logs show load errors)
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=port,
        log_level="info",
    )
