from dataclasses import dataclass
from functools import lru_cache
from typing import Annotated, Any, Protocol, cast

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import InvalidTokenError, PyJWKClient, PyJWTError

from runner_api.config import settings


@dataclass(frozen=True)
class CurrentUser:
    id: str


class TokenVerifier(Protocol):
    def verify(self, token: str) -> dict[str, Any]: ...


class SigningKey(Protocol):
    @property
    def key(self) -> Any: ...


class JWKSClient(Protocol):
    def get_signing_key_from_jwt(self, token: str) -> SigningKey: ...


class ClerkJWTVerifier:
    def __init__(
        self,
        issuer: str,
        authorized_parties: list[str],
        jwks_url: str | None = None,
        jwks_client: JWKSClient | None = None,
    ) -> None:
        self._issuer = issuer.rstrip("/")
        self._authorized_parties = authorized_parties
        self._jwks_client = jwks_client or cast(
            JWKSClient,
            PyJWKClient(jwks_url or f"{self._issuer}/.well-known/jwks.json"),
        )

    def verify(self, token: str) -> dict[str, Any]:
        signing_key = self._jwks_client.get_signing_key_from_jwt(token)
        claims = cast(
            dict[str, Any],
            jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256"],
                issuer=self._issuer,
                options={
                    "require": ["exp", "iat", "iss", "nbf", "sub"],
                    "verify_aud": False,
                },
            ),
        )

        authorized_party = claims.get("azp")
        if (
            authorized_party is not None
            and authorized_party not in self._authorized_parties
        ):
            raise InvalidTokenError("Token authorized party is not allowed")

        return claims


bearer_scheme = HTTPBearer(auto_error=False)


@lru_cache
def get_token_verifier() -> TokenVerifier:
    if not settings.clerk_issuer:
        raise RuntimeError("CLERK_ISSUER is required for authenticated API requests")

    authorized_parties = [
        origin.strip()
        for origin in settings.clerk_authorized_parties.split(",")
        if origin.strip()
    ]
    if not authorized_parties:
        raise RuntimeError(
            "CLERK_AUTHORIZED_PARTIES must include at least one frontend origin"
        )

    return ClerkJWTVerifier(
        issuer=settings.clerk_issuer,
        jwks_url=settings.clerk_jwks_url,
        authorized_parties=authorized_parties,
    )


def authenticate(
    credentials: HTTPAuthorizationCredentials | None,
    verifier: TokenVerifier,
) -> CurrentUser:
    if credentials is None:
        raise _unauthorized("Authentication required")

    try:
        claims = verifier.verify(credentials.credentials)
    except PyJWTError as error:
        raise _unauthorized("Invalid authentication token") from error

    subject = claims.get("sub")
    if not isinstance(subject, str) or not subject:
        raise _unauthorized("Invalid authentication token")

    return CurrentUser(id=subject)


def get_current_user(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None,
        Depends(bearer_scheme),
    ],
) -> CurrentUser:
    if credentials is None:
        raise _unauthorized("Authentication required")

    return authenticate(credentials, get_token_verifier())


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )
