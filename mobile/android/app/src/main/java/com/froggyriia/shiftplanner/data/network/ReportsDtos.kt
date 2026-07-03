package com.froggyriia.shiftplanner.data.network

import com.google.gson.annotations.SerializedName

data class EmployeeReportResponseDto(
    @SerializedName("employee_id") val employeeId: Int,
    @SerializedName("full_name") val fullName: String,
    val position: String,
    @SerializedName("total_hours") val totalHours: Double,
    @SerializedName("total_shifts") val totalShifts: Int
)

data class MySelfReportResponseDto(
    @SerializedName("employee_id") val employeeId: Int,
    @SerializedName("full_name") val fullName: String,
    @SerializedName("total_hours") val totalHours: Double,
    @SerializedName("total_shifts") val totalShifts: Int
)
