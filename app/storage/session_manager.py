from fastapi import Request, Response, Depends
import uuid
from typing import Optional
from datetime import datetime, timedelta

# Session cookie name
SESSION_COOKIE_NAME = "sat_annotator_session"
# Session timeout (7 days)
SESSION_TIMEOUT_DAYS = 7


def generate_session_id() -> str:
    """Generate a unique session ID"""
    return str(uuid.uuid4())


async def get_session_id(request: Request) -> str:
    """
    Get the session ID from the request cookie or create a new one.
    This function should be used as a dependency in FastAPI routes.
    """
    session_id = request.cookies.get(SESSION_COOKIE_NAME)

    if not session_id:
        session_id = generate_session_id()

    return session_id


def set_session_cookie(response: Response, session_id: str) -> None:
    """
    Set the session cookie in the response.
    Call this function when responding to a request if a new session was created.
    This creates a session cookie that expires when the browser is closed.
    """
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session_id,
        httponly=True,  # Prevent JavaScript access for enhanced security against XSS
        samesite="lax",
        path="/",
        # No expires parameter = session cookie (cleared on browser close/reload)
    )


class SessionManager:
    """
    A manager for handling session-related operations in route handlers.
    Simplifies session management in API endpoints.
    """

    def __init__(self, request: Request, response: Response):
        self.request = request
        self.response = response
        self._session_id: Optional[str] = None

    @property
    def session_id(self) -> str:
        """Get or initialize the session ID"""
        if self._session_id is None:
            self._session_id = self.request.cookies.get(SESSION_COOKIE_NAME)
            if not self._session_id:
                self._session_id = generate_session_id()
                set_session_cookie(self.response, self._session_id)
        return self._session_id

    def clear_session(self) -> None:
        """Remove the session cookie"""
        self.response.delete_cookie(
            key=SESSION_COOKIE_NAME,
            httponly=True,  # Match the httponly setting from set_session_cookie
            path="/",
        )


def get_session_manager(request: Request, response: Response) -> SessionManager:
    """
    FastAPI dependency to get the session manager.
    Usage: session_manager: SessionManager = Depends(get_session_manager)
    """
    return SessionManager(request, response)
