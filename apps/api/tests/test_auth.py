from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.asymmetric.rsa import (
    RSAPrivateKey,
    RSAPublicKey,
)
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from jwt import InvalidTokenError

from runner_api.auth import ClerkJWTVerifier, CurrentUser, SigningKey, authenticate

ISSUER = "https://runner-test.clerk.accounts.dev"
AUTHORIZED_PARTY = "http://localhost:5173"


@dataclass(frozen=True)
class OfflineSigningKey:
    key: RSAPublicKey


class OfflineJWKSClient:
    def __init__(self, public_key: RSAPublicKey) -> None:
        self._public_key = public_key
        self.tokens: list[str] = []

    def get_signing_key_from_jwt(self, token: str) -> SigningKey:
        self.tokens.append(token)
        return OfflineSigningKey(key=self._public_key)


def make_token(
    private_key: RSAPrivateKey,
    *,
    subject: str = "user_clerk_123",
    issuer: str = ISSUER,
    authorized_party: str = AUTHORIZED_PARTY,
) -> str:
    now = datetime.now(UTC)
    return jwt.encode(
        {
            "azp": authorized_party,
            "exp": now + timedelta(minutes=5),
            "iat": now,
            "iss": issuer,
            "nbf": now - timedelta(seconds=1),
            "sub": subject,
        },
        private_key,
        algorithm="RS256",
        headers={"kid": "offline-test-key"},
    )


@pytest.fixture
def rsa_keys() -> tuple[RSAPrivateKey, RSAPublicKey]:
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    return private_key, private_key.public_key()


def test_authenticate_extracts_current_user_from_verified_clerk_subject(
    rsa_keys: tuple[RSAPrivateKey, RSAPublicKey],
) -> None:
    private_key, public_key = rsa_keys
    jwks_client = OfflineJWKSClient(public_key)
    verifier = ClerkJWTVerifier(
        issuer=ISSUER,
        authorized_parties=[AUTHORIZED_PARTY],
        jwks_client=jwks_client,
    )
    token = make_token(private_key)

    current_user = authenticate(
        HTTPAuthorizationCredentials(scheme="Bearer", credentials=token),
        verifier,
    )

    assert current_user == CurrentUser(id="user_clerk_123")
    assert jwks_client.tokens == [token]


def test_clerk_verification_rejects_untrusted_authorized_party(
    rsa_keys: tuple[RSAPrivateKey, RSAPublicKey],
) -> None:
    private_key, public_key = rsa_keys
    verifier = ClerkJWTVerifier(
        issuer=ISSUER,
        authorized_parties=[AUTHORIZED_PARTY],
        jwks_client=OfflineJWKSClient(public_key),
    )

    with pytest.raises(InvalidTokenError, match="authorized party"):
        verifier.verify(
            make_token(private_key, authorized_party="https://untrusted.example")
        )


def test_clerk_verification_rejects_wrong_issuer(
    rsa_keys: tuple[RSAPrivateKey, RSAPublicKey],
) -> None:
    private_key, public_key = rsa_keys
    verifier = ClerkJWTVerifier(
        issuer=ISSUER,
        authorized_parties=[AUTHORIZED_PARTY],
        jwks_client=OfflineJWKSClient(public_key),
    )

    with pytest.raises(InvalidTokenError):
        verifier.verify(make_token(private_key, issuer="https://other.example"))


def test_authenticate_rejects_missing_credentials() -> None:
    class UnusedVerifier:
        def verify(self, token: str) -> dict[str, Any]:
            raise AssertionError("Verifier should not be called")

    with pytest.raises(HTTPException) as error:
        authenticate(None, UnusedVerifier())

    assert error.value.status_code == 401
    assert error.value.headers == {"WWW-Authenticate": "Bearer"}


def test_authenticate_rejects_invalid_verified_token() -> None:
    class InvalidVerifier:
        def verify(self, token: str) -> dict[str, Any]:
            raise InvalidTokenError("invalid")

    with pytest.raises(HTTPException) as error:
        authenticate(
            HTTPAuthorizationCredentials(scheme="Bearer", credentials="invalid"),
            InvalidVerifier(),
        )

    assert error.value.status_code == 401
    assert error.value.detail == "Invalid authentication token"
