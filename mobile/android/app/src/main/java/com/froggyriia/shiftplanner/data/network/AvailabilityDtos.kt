package com.froggyriia.shiftplanner.data.network

import com.google.gson.annotations.SerializedName

data class EmployeeAvailabilityBlockDto(
    val weekday: Int,
    @SerializedName("start_time")
    val startTime: String,
    @SerializedName("end_time")
    val endTime: String,
    @SerializedName("availability_status")
    val availabilityStatus: String?
)

data class EmployeeAvailabilityResponseDto(
    @SerializedName("employee_id")
    val employeeId: Int,
    @SerializedName("weekly_availability")
    val weeklyAvailability: List<EmployeeAvailabilityBlockDto>,
    @SerializedName("desired_days_off")
    val desiredDaysOff: List<Int>
)

data class EmployeeAvailabilityUpsertDto(
    @SerializedName("weekly_availability")
    val weeklyAvailability: List<EmployeeAvailabilityBlockDto>,
    @SerializedName("desired_days_off")
    val desiredDaysOff: List<Int>
)
