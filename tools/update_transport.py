"""Shared acknowledgement rules for the command-line maintenance uploaders."""
import http.client
import json
import urllib.error

TRANSPORT_ERRORS = (urllib.error.URLError, OSError, http.client.HTTPException)


def read_acknowledgement(response):
    """Never mistake a received rejection or malformed body for transport loss."""
    try:
        result = json.loads(response.read().decode("utf-8"))
    except (ValueError, UnicodeError) as error:
        raise RuntimeError("Update outcome unconfirmed: invalid acknowledgement; verify before retrying") from error
    if not isinstance(result, dict) or result.get("ok") is not True:
        detail = result.get("error") if isinstance(result, dict) else None
        raise RuntimeError(detail or "Update outcome unconfirmed: no positive acknowledgement; verify before retrying")
    return result
