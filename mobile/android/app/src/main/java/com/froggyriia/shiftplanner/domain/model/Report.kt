package com.froggyriia.shiftplanner.domain.model

data class EmployeeReport(
    val employeeId: Int,
    val fullName: String,
    val position: String,
    val totalHours: Double,
    val totalShifts: Int
)

data class MySelfReport(
    val employeeId: Int,
    val fullName: String,
    val totalHours: Double,
    val totalShifts: Int
)
