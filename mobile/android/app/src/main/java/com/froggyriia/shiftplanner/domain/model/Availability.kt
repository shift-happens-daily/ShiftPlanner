package com.froggyriia.shiftplanner.domain.model

enum class AvailabilitySlotState(val apiValue: String?) {
    CAN_WORK("available"),
    PREFER_NOT("if_needed"),
    UNAVAILABLE(null);

    companion object {
        fun fromApiValue(value: String?): AvailabilitySlotState = when (value) {
            "available" -> CAN_WORK
            "if_needed" -> PREFER_NOT
            else -> UNAVAILABLE
        }
    }
}

data class AvailabilityBlock(
    val weekday: Int,
    val startTime: String,
    val endTime: String,
    val status: AvailabilitySlotState
)

data class EmployeeAvailabilityData(
    val employeeId: Int,
    val weeklyAvailability: List<AvailabilityBlock>,
    val desiredDaysOff: List<Int>
)
