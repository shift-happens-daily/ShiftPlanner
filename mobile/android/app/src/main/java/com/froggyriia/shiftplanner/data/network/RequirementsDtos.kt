package com.froggyriia.shiftplanner.data.network

import com.google.gson.annotations.SerializedName

data class ScheduleRequirementResponseDto(
    val id: Int,
    @SerializedName("branch_id")
    val branchId: Int?,
    @SerializedName("position_id")
    val positionId: Int,
    @SerializedName("position_title")
    val positionTitle: String,
    val date: String,
    @SerializedName("min_staff")
    val minStaff: Int,
    @SerializedName("start_time")
    val startTime: String,
    @SerializedName("end_time")
    val endTime: String
)

data class ScheduleRequirementCreateDto(
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

data class ScheduleRequirementUpdateDto(
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

data class ScheduleRequirementTemplateCreateDto(
    @SerializedName("position_id")
    val positionId: Int,
    @SerializedName("min_staff")
    val minStaff: Int,
    @SerializedName("start_time")
    val startTime: String,
    @SerializedName("end_time")
    val endTime: String
)

data class ScheduleRequirementBulkCreateDto(
    @SerializedName("start_date")
    val startDate: String,
    @SerializedName("end_date")
    val endDate: String,
    val weekdays: List<Int>,
    val requirements: List<ScheduleRequirementTemplateCreateDto>
)

data class ScheduleRequirementBulkResponseDto(
    @SerializedName("created_count")
    val createdCount: Int,
    val requirements: List<ScheduleRequirementResponseDto>
)
