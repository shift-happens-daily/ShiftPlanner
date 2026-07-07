package com.froggyriia.shiftplanner.data.network

data class ApiErrorResponse(
    val detail: String?
)

data class ApiValidationErrorResponse(
    val detail: List<ApiValidationErrorItem>?
)

data class ApiValidationErrorItem(
    val loc: List<String>?,
    val msg: String?
)

class ApiException(message: String) : Exception(message)
