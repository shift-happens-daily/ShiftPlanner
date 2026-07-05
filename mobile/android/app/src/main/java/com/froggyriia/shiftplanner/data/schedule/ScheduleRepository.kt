package com.froggyriia.shiftplanner.data.schedule

import com.froggyriia.shiftplanner.domain.model.AppAvailableEmployee
import com.froggyriia.shiftplanner.domain.model.AppSchedule
import com.froggyriia.shiftplanner.domain.model.AppScheduledShift
import com.froggyriia.shiftplanner.domain.model.ScheduleShiftMutation

interface ScheduleRepository {
    suspend fun generateSchedule(startDate: String, endDate: String): List<AppSchedule>
    suspend fun fetchSchedule(scheduleId: Int): AppSchedule
    suspend fun fetchLatestSchedule(status: String? = null): AppSchedule?
    suspend fun publishSchedule(scheduleId: Int): AppSchedule
    suspend fun fetchMySchedule(): List<AppScheduledShift>
    suspend fun fetchAvailableEmployees(
        scheduleId: Int,
        shift: AppScheduledShift,
        branchId: Int?,
        includeUnavailable: Boolean = false
    ): List<AppAvailableEmployee>
    suspend fun assignRequirement(
        scheduleId: Int,
        requirementId: Int,
        employeeId: Int
    ): AppSchedule
    suspend fun createShift(scheduleId: Int, mutation: ScheduleShiftMutation): AppSchedule
    suspend fun updateShift(
        scheduleId: Int,
        shiftId: Int,
        mutation: ScheduleShiftMutation
    ): AppSchedule
    suspend fun deleteShift(scheduleId: Int, shiftId: Int): AppSchedule
    suspend fun updateScheduleRequirement(
        scheduleId: Int,
        requirementId: Int,
        mutation: ScheduleShiftMutation,
        quantity: Int = 1
    ): AppSchedule
}
