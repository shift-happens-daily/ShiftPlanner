package com.froggyriia.shiftplanner.data.network

import com.google.gson.annotations.SerializedName

data class ScheduleGenerateRequestDto(
    @SerializedName("start_date")
    val startDate: String,
    @SerializedName("end_date")
    val endDate: String,
    @SerializedName("branch_id")
    val branchId: Int? = null
)

data class RequirementAssignRequestDto(
    @SerializedName("employee_id")
    val employeeId: Int
)

data class ManualShiftCreateRequestDto(
    val date: String,
    @SerializedName("start_time")
    val startTime: String,
    @SerializedName("end_time")
    val endTime: String,
    @SerializedName("position_id")
    val positionId: Int,
    @SerializedName("employee_id")
    val employeeId: Int?
)

data class ScheduleShiftUpdateRequestDto(
    val date: String,
    @SerializedName("start_time")
    val startTime: String,
    @SerializedName("end_time")
    val endTime: String,
    @SerializedName("position_id")
    val positionId: Int,
    @SerializedName("employee_id")
    val employeeId: Int?,
    val action: String? = null
)

data class ScheduleResponseDto(
    val id: Int,
    @SerializedName("branch_id")
    val branchId: Int?,
    // Schedule period as returned by the backend (ScheduleRead). Nullable for
    // resilience against older deployments that might omit them.
    @SerializedName("start_date")
    val startDate: String?,
    @SerializedName("end_date")
    val endDate: String?,
    val status: String,
    val shifts: List<ScheduleShiftResponseDto>,
    @SerializedName("unfilled_requirements")
    val unfilledRequirements: List<ScheduleUnfilledRequirementResponseDto>
)

/** Item of GET /schedule — used to detect schedules that overlap a period. */
data class ScheduleListItemResponseDto(
    val id: Int,
    @SerializedName("branch_id")
    val branchId: Int?,
    @SerializedName("start_date")
    val startDate: String,
    @SerializedName("end_date")
    val endDate: String,
    val status: String
)

data class ScheduleShiftResponseDto(
    val id: Int,
    @SerializedName("employee_id")
    val employeeId: Int?,
    @SerializedName("employee_name")
    val employeeName: String?,
    @SerializedName("position_id")
    val positionId: Int,
    val position: String,
    val date: String,
    @SerializedName("start_time")
    val startTime: String,
    @SerializedName("end_time")
    val endTime: String
)

data class ScheduleUnfilledRequirementResponseDto(
    @SerializedName("requirement_id")
    val requirementId: Int,
    @SerializedName("position_id")
    val positionId: Int,
    @SerializedName("position_title")
    val positionTitle: String,
    val date: String,
    @SerializedName("start_time")
    val startTime: String,
    @SerializedName("end_time")
    val endTime: String,
    @SerializedName("missing_staff")
    val missingStaff: Int
)

data class AvailableEmployeePositionDto(
    val id: Int,
    val name: String
)

data class AvailableEmployeeBranchDto(
    val id: Int,
    val name: String
)

data class AvailableEmployeeResponseDto(
    val id: Int,
    @SerializedName("full_name")
    val fullName: String,
    val position: AvailableEmployeePositionDto,
    val branch: AvailableEmployeeBranchDto?,
    @SerializedName("availability_status")
    val availabilityStatus: String,
    @SerializedName("assigned_hours")
    val assignedHours: Double
)

data class ScheduleRequirementInScheduleUpdateDto(
    @SerializedName("branch_id")
    val branchId: Int?,
    @SerializedName("position_id")
    val positionId: Int,
    val date: String,
    @SerializedName("min_staff")
    val minStaff: Int,
    @SerializedName("required_count")
    val requiredCount: Int,
    @SerializedName("start_time")
    val startTime: String,
    @SerializedName("end_time")
    val endTime: String
)

// ── Employee calendar summary (shifts across ALL published schedules) ────────

data class EmployeeCalendarPositionDto(
    val id: Int,
    val name: String
)

data class EmployeeCalendarEmployeeDto(
    val id: Int,
    @SerializedName("full_name")
    val fullName: String,
    val position: EmployeeCalendarPositionDto?
)

data class EmployeeCalendarShiftDto(
    @SerializedName("shift_id")
    val shiftId: Int,
    @SerializedName("schedule_id")
    val scheduleId: Int,
    val date: String,
    @SerializedName("start_time")
    val startTime: String,
    @SerializedName("end_time")
    val endTime: String,
    val status: String?
)

data class EmployeeCalendarSummaryDto(
    val employee: EmployeeCalendarEmployeeDto,
    val shifts: List<EmployeeCalendarShiftDto>
)

// ── Absences ──────────────────────────────────────────────────────────────────

data class AbsenceCreateRequestDto(
    @SerializedName("absence_type")
    val absenceType: String,
    @SerializedName("start_date")
    val startDate: String,
    @SerializedName("end_date")
    val endDate: String,
    val comment: String? = null
)

data class AbsenceResponseDto(
    val id: Int,
    @SerializedName("absence_type")
    val absenceType: String,
    @SerializedName("start_date")
    val startDate: String,
    @SerializedName("end_date")
    val endDate: String,
    val comment: String?,
    val status: String,
    @SerializedName("employee_id")
    val employeeId: Int
)

// ── Shift exchange requests ───────────────────────────────────────────────────

data class ShiftExchangeCreateRequestDto(
    @SerializedName("shift_id")
    val shiftId: Int,
    val note: String? = null
)

data class ShiftExchangeResponseDto(
    val id: Int,
    @SerializedName("shift_id")
    val shiftId: Int,
    @SerializedName("employee_id")
    val employeeId: Int,
    @SerializedName("employee_name")
    val employeeName: String = "",
    val note: String?,
    val status: String
)

data class ShiftExchangeUpdateRequestDto(
    val status: String
)
