from app.schemas.common import MessageResponse, ValidationErrorResponse

VALIDATION_ERROR_RESPONSE = {
    422: {
        "model": ValidationErrorResponse,
        "description": "Validation error.",
    }
}
BAD_REQUEST_RESPONSE = {
    400: {
        "model": MessageResponse,
        "description": "Business rule error.",
    }
}
UNAUTHORIZED_RESPONSE = {
    401: {
        "model": MessageResponse,
        "description": "Authentication required or token is invalid.",
    }
}
FORBIDDEN_RESPONSE = {
    403: {
        "model": MessageResponse,
        "description": "Insufficient permissions.",
    }
}
NOT_FOUND_RESPONSE = {
    404: {
        "model": MessageResponse,
        "description": "Resource was not found.",
    }
}
CONFLICT_RESPONSE = {
    409: {
        "model": MessageResponse,
        "description": "Request conflicts with an existing resource.",
    }
}
