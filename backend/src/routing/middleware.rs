use axum::{
    extract::{Request, State},
    middleware::Next,
    response::{IntoResponse, Response},
};
use http::{HeaderMap, StatusCode};

use crate::auth;

use super::{AppError, BackendResponse, RouterState};

/// Verifies the JWT and authenticates a user. If the JWT is invalid, the user is sent an unauthorized status code. If the JWT is valid, the authentication is added to the state.
///
/// TODO: THIS IS DUM DUM, CHANGE IT, ADD THE STATE TO THE REQUEST, A SHARED AUTH MUTEX MAKES NO SENSE
pub async fn verify_jwt_middleware(
    State(state): State<RouterState>,
    headers: HeaderMap,
    mut request: Request,
    next: Next,
) -> Result<Response, AppError> {
    if let Some(auth_header) = headers.get("Authorization") {
        if let Some(jwt) = auth_header.to_str()?.strip_prefix("Bearer ") {
            let auth = auth::verify_token(jwt, &state.env_vars).await;

            if let Ok(auth) = auth {
                // If auth is fine, add it to the request extensions
                request.extensions_mut().insert(auth);
            } else {
                return Ok(BackendResponse::<()>::error(
                    "Authorization token invalid.".into(),
                    StatusCode::UNAUTHORIZED,
                )
                .into_response());
            }
        } else {
            return Ok(BackendResponse::<()>::error(
                "Authorization header format invalid.".into(),
                StatusCode::UNAUTHORIZED,
            )
            .into_response());
        }
    } else {
        return Ok(BackendResponse::<()>::error(
            "Authorization header missing.".into(),
            StatusCode::UNAUTHORIZED,
        )
        .into_response());
    }

    Ok(next.run(request).await)
}