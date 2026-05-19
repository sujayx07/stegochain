"""
IPFS / Pinata Integration Module
==================================
Provides file pinning and retrieval via the Pinata IPFS pinning service.
All HTTP calls use the `requests` library directly — no Pinata SDK.

API credentials are passed as explicit parameters so this module is fully
testable in isolation (no import of config.py required).

Pinata API reference:
    Upload : POST  https://api.pinata.cloud/pinning/pinFileToIPFS
    Retrieve: GET  https://gateway.pinata.cloud/ipfs/{CID}
    List   : GET  https://api.pinata.cloud/pinning/pinList
    Unpin  : DELETE https://api.pinata.cloud/pinning/unpin/{CID}
"""

import io
import json
import os
import tempfile

import requests


# ── Constants ─────────────────────────────────────────────────────────────────
_BASE_URL    = "https://api.pinata.cloud"
_GATEWAY_URL = "https://gateway.pinata.cloud/ipfs"
_TIMEOUT     = 30   # seconds


# ── Public API ────────────────────────────────────────────────────────────────

def upload_file_to_ipfs(
    file_path: str,
    pinata_api_key: str,
    pinata_secret_key: str,
    metadata: dict = None,
) -> dict:
    """
    Upload a local file to IPFS via Pinata.

    Parameters
    ----------
    file_path        : absolute or relative path to the file to upload
    pinata_api_key   : Pinata API key
    pinata_secret_key: Pinata secret key
    metadata         : optional Pinata metadata dict (name + keyvalues)

    Returns
    -------
    dict with keys:
        cid         (str) : IPFS CID (IpfsHash)
        size        (int) : pinned size in bytes
        timestamp   (str) : pin timestamp
        file_name   (str) : original filename
        gateway_url (str) : full retrieval URL

    Raises
    ------
    ConnectionError : if Pinata returns a non-2xx status code
    """
    headers = _auth_headers(pinata_api_key, pinata_secret_key)
    file_name = os.path.basename(file_path)

    with open(file_path, "rb") as fh:
        files = {"file": (file_name, fh, "application/octet-stream")}
        data  = {}

        if metadata:
            data["pinataMetadata"] = json.dumps(metadata)

        response = requests.post(
            f"{_BASE_URL}/pinning/pinFileToIPFS",
            headers=headers,
            files=files,
            data=data,
            timeout=_TIMEOUT,
        )

    _raise_for_error(response)
    return _parse_upload_response(response.json(), file_name)


def upload_bytes_to_ipfs(
    data: bytes,
    file_name: str,
    pinata_api_key: str,
    pinata_secret_key: str,
    metadata: dict = None,
) -> dict:
    """
    Upload raw bytes to IPFS via Pinata without saving a file to disk first.

    Internally writes bytes to a temporary file, uploads it, then cleans up.

    Parameters
    ----------
    data             : raw bytes to upload
    file_name        : name to assign to the file on IPFS
    pinata_api_key   : Pinata API key
    pinata_secret_key: Pinata secret key
    metadata         : optional Pinata metadata dict

    Returns
    -------
    Same dict format as upload_file_to_ipfs.

    Raises
    ------
    ConnectionError : if Pinata returns a non-2xx status code
    """
    # Write bytes to a named temp file so upload_file_to_ipfs can read it
    suffix = os.path.splitext(file_name)[1] or ".bin"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(data)
        tmp_path = tmp.name

    # Override basename so Pinata shows the caller-supplied file_name
    try:
        headers   = _auth_headers(pinata_api_key, pinata_secret_key)
        with open(tmp_path, "rb") as fh:
            files   = {"file": (file_name, fh, "application/octet-stream")}
            req_data = {}
            if metadata:
                req_data["pinataMetadata"] = json.dumps(metadata)

            response = requests.post(
                f"{_BASE_URL}/pinning/pinFileToIPFS",
                headers=headers,
                files=files,
                data=req_data,
                timeout=_TIMEOUT,
            )
        _raise_for_error(response)
        return _parse_upload_response(response.json(), file_name)
    finally:
        try:
            os.remove(tmp_path)
        except OSError:
            pass


def retrieve_from_ipfs(cid: str, output_path: str = None) -> bytes:
    """
    Retrieve a file from IPFS via the Pinata gateway.

    Parameters
    ----------
    cid         : IPFS CID string
    output_path : if provided, save the retrieved bytes to this path

    Returns
    -------
    bytes : the raw file content

    Raises
    ------
    ConnectionError : if the gateway returns a non-2xx status
    """
    url      = f"{_GATEWAY_URL}/{cid}"
    response = requests.get(url, timeout=_TIMEOUT)
    _raise_for_error(response)

    content = response.content
    if output_path:
        with open(output_path, "wb") as fh:
            fh.write(content)

    return content


def pin_exists(cid: str, pinata_api_key: str, pinata_secret_key: str) -> bool:
    """
    Check whether a CID is currently pinned in the Pinata account.

    Returns True if pinned, False otherwise. Never raises.
    """
    try:
        headers  = _auth_headers(pinata_api_key, pinata_secret_key)
        response = requests.get(
            f"{_BASE_URL}/pinning/pinList",
            headers=headers,
            params={"hashContains": cid},
            timeout=_TIMEOUT,
        )
        if response.status_code != 200:
            return False
        rows = response.json().get("rows", [])
        return any(row.get("ipfs_pin_hash") == cid for row in rows)
    except Exception:
        return False


def unpin_from_ipfs(cid: str, pinata_api_key: str, pinata_secret_key: str) -> bool:
    """
    Remove a pin from the Pinata account.

    Returns True on success, False on any failure. Never raises.
    """
    try:
        headers  = _auth_headers(pinata_api_key, pinata_secret_key)
        response = requests.delete(
            f"{_BASE_URL}/pinning/unpin/{cid}",
            headers=headers,
            timeout=_TIMEOUT,
        )
        return response.status_code == 200
    except Exception:
        return False


def get_pin_list(
    pinata_api_key: str,
    pinata_secret_key: str,
    limit: int = 10,
) -> list:
    """
    Fetch the list of files pinned in the Pinata account.

    Parameters
    ----------
    pinata_api_key   : Pinata API key
    pinata_secret_key: Pinata secret key
    limit            : maximum number of results to return

    Returns
    -------
    list of dicts, each with: cid, size, timestamp, file_name
    Returns empty list on any error.
    """
    try:
        headers  = _auth_headers(pinata_api_key, pinata_secret_key)
        response = requests.get(
            f"{_BASE_URL}/pinning/pinList",
            headers=headers,
            params={"pageLimit": limit},
            timeout=_TIMEOUT,
        )
        if response.status_code != 200:
            return []

        rows = response.json().get("rows", [])
        result = []
        for row in rows:
            metadata  = row.get("metadata", {})
            file_name = metadata.get("name", "")
            result.append({
                "cid":       row.get("ipfs_pin_hash", ""),
                "size":      row.get("size", 0),
                "timestamp": row.get("date_pinned", ""),
                "file_name": file_name,
            })
        return result
    except Exception:
        return []


def build_ipfs_metadata(
    session_id: str,
    sender_id: str,
    receiver_id: str,
    file_type: str,
) -> dict:
    """
    Build the Pinata metadata dict to attach to every IPFS upload.

    Parameters
    ----------
    session_id  : unique session identifier linking IPFS CID to Shamir shares
    sender_id   : identifier of the message sender
    receiver_id : identifier of the message receiver
    file_type   : "image" or "audio"

    Returns
    -------
    dict compatible with Pinata's pinataMetadata field:
        { "name": str, "keyvalues": { ... } }
    """
    return {
        "name": f"stegochain_{session_id}",
        "keyvalues": {
            "session_id":   session_id,
            "sender_id":    sender_id,
            "receiver_id":  receiver_id,
            "file_type":    file_type,
            "app":          "stegochain",
        },
    }


# ── Private helpers ───────────────────────────────────────────────────────────

def _auth_headers(api_key: str, secret_key: str) -> dict:
    """Return Pinata authentication headers."""
    return {
        "pinata_api_key":        api_key,
        "pinata_secret_api_key": secret_key,
    }


def _raise_for_error(response: requests.Response) -> None:
    """Raise ConnectionError if the response status is not 2xx."""
    if not response.ok:
        raise ConnectionError(
            f"Pinata API error {response.status_code}: {response.text[:500]}"
        )


def _parse_upload_response(body: dict, file_name: str) -> dict:
    """Extract standard fields from a Pinata upload response body."""
    cid = body.get("IpfsHash", "")
    return {
        "cid":         cid,
        "size":        body.get("PinSize", 0),
        "timestamp":   body.get("Timestamp", ""),
        "file_name":   file_name,
        "gateway_url": f"{_GATEWAY_URL}/{cid}",
    }
