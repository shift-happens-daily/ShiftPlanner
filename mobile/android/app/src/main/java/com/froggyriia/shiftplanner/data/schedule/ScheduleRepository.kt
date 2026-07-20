package com.froggyriia.shiftplanner.data.schedule

import com.froggyriia.shiftplanner.domain.model.AppAvailableEmployee
import com.froggyriia.shiftplanner.domain.model.AppSchedule
import com.froggyriia.shiftplanner.domain.model.AppScheduleListItem
import com.froggyriia.shiftplanner.domain.model.AppScheduledShift
import com.froggyriia.shiftplanner.domain.model.PendingShiftExchange
import com.froggyriia.shiftplanner.domain.model.ScheduleShiftMutation

interface ScheduleRepository {
    suspend fun generateSchedule(startDate: String, endDate: String, branchId: Int? = null): List<AppSchedule>
    suspend fun fetchSchedule(scheduleId: Int): AppSchedule
    suspend fun fetchLatestSchedule(status: String? = null): AppSchedule?
    /** Schedules (any status) that overlap the given period, optionally for one branch. */
    suspend fun fetchSchedules(
        startDate: String? = null,
        endDate: String? = null,
        branchId: Int? = null,
        status: String? = null
    ): List<AppScheduleListItem>
    suspend fun publishSchedule(scheduleId: Int): AppSchedule
    /**
     * The employee's own shifts. With a period given, shifts come from ALL
     * published schedules overlapping it (not just the latest one).
     */
    suspend fun fetchMySchedule(
        startDate: String? = null,
        endDate: String? = null
    ): List<AppScheduledShift>
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
    suspend fun deleteSchedule(scheduleId: Int)
    suspend fun deleteShift(scheduleId: Int, shiftId: Int): AppSchedule
    suspend fun updateScheduleRequirement(
        scheduleId: Int,
        requirementId: Int,
        mutation: ScheduleShiftMutation,
        quantity: Int = 1
    ): AppSchedule

    // Shift exchange
    suspend fun createExchangeRequest(shiftId: Int, note: String)
    suspend fun fetchExchangeRequests(): List<PendingShiftExchange>
    suspend fun updateExchangeRequest(id: Int, approved: Boolean): PendingShiftExchange
}
