"""Symmetric encryption for secrets at rest (e.g. user OpenAI API keys).

Uses Fernet (AES-128-CBC + HMAC). The Fernet key is derived deterministically
from a server secret so no separate key file is needed: APP_ENCRYPTION_SECRET if
set, otherwise JWT_SECRET. Rotating that secret invalidates existing ciphertexts.
"""
import base64
import hashlib
import os

from cryptography.fernet import Fernet, InvalidToken

_SECRET = (os.getenv("APP_ENCRYPTION_SECRET") or os.getenv("JWT_SECRET") or "").strip()


def _fernet() -> Fernet:
    if not _SECRET:
        raise RuntimeError(
            "APP_ENCRYPTION_SECRET (or JWT_SECRET) must be set to encrypt secrets at rest."
        )
    # Derive a valid 32-byte urlsafe-base64 Fernet key from the secret.
    digest = hashlib.sha256(_SECRET.encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt(plaintext: str) -> str:
    """Encrypt a UTF-8 string, returning urlsafe-base64 ciphertext."""
    return _fernet().encrypt(plaintext.encode("utf-8")).decode("ascii")


def decrypt(ciphertext: str) -> str | None:
    """Decrypt ciphertext produced by encrypt(). Returns None if it cannot be
    decrypted (tampered, or the server secret changed)."""
    try:
        return _fernet().decrypt(ciphertext.encode("ascii")).decode("utf-8")
    except (InvalidToken, ValueError, TypeError):
        return None
