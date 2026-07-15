package com.froggyriia.shiftplanner.domain.model

enum class AppAbsenceType(val apiValue: String, val displayName: String) {
    VACATION("vacation", "Vacation"),
    SICK_LEAVE("sick_leave", "Sick leave"),
    OTHER("other", "Other");

    companion object {
        fun fromApiValue(value: String?): AppAbsenceType =
            entries.firstOrNull { it.apiValue == value } ?: OTHER
    }
}

enum class AppAbsenceStatus(val apiValue: String) {
    PENDING("pending"),
    APPROVED("approved"),
    REJECTED("rejected");

    companion object {
        /** Returns null when the backend omits status (no approval workflow) or sends an unknown value. */
        fun fromApiValue(value: String?): AppAbsenceStatus? =
            value?.let { v -> entries.firstOrNull { it.apiValue == v } }
    }
}

data class AppAbsence(
    val id: Int,
    val absenceType: AppAbsenceType,
    val startDate: String,
    val endDate: String,
    val comment: String?,
    val status: AppAbsenceStatus?,
    val employeeId: Int
)

data class AppShiftExchangeRequest(
    val id: Int,
    val shiftId: Int,
    val note: String?,
    val status: String,
    val employeeId: Int
)
