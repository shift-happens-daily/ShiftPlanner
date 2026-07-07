package com.froggyriia.shiftplanner.data.schedule

import com.froggyriia.shiftplanner.data.network.ApiClient
import com.froggyriia.shiftplanner.data.network.AvailableEmployeeResponseDto
import com.froggyriia.shiftplanner.data.network.ManualShiftCreateRequestDto
import com.froggyriia.shiftplanner.data.network.RequirementAssignRequestDto
import com.froggyriia.shiftplanner.data.network.ScheduleGenerateRequestDto
import com.froggyriia.shiftplanner.data.network.ScheduleRequirementInScheduleUpdateDto
import com.froggyriia.shiftplanner.data.network.ScheduleResponseDto
import com.froggyriia.shiftplanner.data.network.ScheduleShiftResponseDto
import com.froggyriia.shiftplanner.data.network.ScheduleShiftUpdateRequestDto
import com.froggyriia.shiftplanner.data.network.ScheduleUnfilledRequirementResponseDto
import com.froggyriia.shiftplanner.domain.model.AppAvailableEmployee
import com.froggyriia.shiftplanner.domain.model.AppEmployeeAvailabilityStatus
import com.froggyriia.shiftplanner.domain.model.AppSchedule
import com.froggyriia.shiftplanner.domain.model.AppScheduleStatus
import com.froggyriia.shiftplanner.domain.model.AppScheduledShift
import com.froggyriia.shiftplanner.domain.model.AppUnfilledRequirement
import com.froggyriia.shiftplanner.domain.model.ScheduleShiftMutation
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class ApiScheduleRepository(
    private val apiClient: ApiClient
) : ScheduleRepository {

    override suspend fun generateSchedule(startDate: String, endDate: String): List<AppSchedule> = wrap {
        apiClient.api.generateSchedule(
            ScheduleGenerateRequestDto(startDate = startDate, endDate = endDate)
        ).map { it.toDomain() }
    }

    override suspend fun fetchSchedule(scheduleId: Int): AppSchedule = wrap {
        apiClient.api.getSchedule(scheduleId).toDomain()
    }

    override suspend fun fetchLatestSchedule(status: String?): AppSchedule? = wrap {
        val response = apiClient.api.getLatestSchedule(status)
        if (response.code() == 404) return@wrap null
        if (!response.isSuccessful) throw Exception("Request failed with status ${response.code()}")
        response.body()?.toDomain()
    }

    override suspend fun publishSchedule(scheduleId: Int): AppSchedule = wrap {
        apiClient.api.publishSchedule(scheduleId).toDomain()
    }

    override suspend fun fetchMySchedule(): List<AppScheduledShift> = wrap {
        apiClient.api.getMySchedule().map { it.toShift() }
    }

    override suspend fun fetchAvailableEmployees(
        scheduleId: Int,
        shift: AppScheduledShift,
        branchId: Int?,
        includeUnavailable: Boolean
    ): List<AppAvailableEmployee> = wrap {
        apiClient.api.getAvailableEmployees(
            scheduleId = scheduleId,
            date = dateFormatter.format(shift.date),
            startTime = minutesToTime(shift.startMinutes),
            endTime = minutesToTime(shift.endMinutes),
            positionId = shift.positionId,
            branchId = branchId,
            includeUnavailable = includeUnavailable
        ).map { it.toEmployee() }
    }

    override suspend fun assignRequirement(
        scheduleId: Int,
        requirementId: Int,
        employeeId: Int
    ): AppSchedule = wrap {
        apiClient.api.assignRequirement(
            scheduleId = scheduleId,
            requirementId = requirementId,
            request = RequirementAssignRequestDto(employeeId = employeeId)
        ).toDomain()
    }

    override suspend fun createShift(
        scheduleId: Int,
        mutation: ScheduleShiftMutation
    ): AppSchedule = wrap {
        apiClient.api.createShift(
            scheduleId = scheduleId,
            request = ManualShiftCreateRequestDto(
                date = dateFormatter.format(mutation.date),
                startTime = minutesToTime(mutation.startMinutes),
                endTime = minutesToTime(mutation.endMinutes),
                positionId = mutation.positionId,
                employeeId = mutation.employeeId?.takeIf { it > 0 }
            )
        ).toDomain()
    }

    override suspend fun updateShift(
        scheduleId: Int,
        shiftId: Int,
        mutation: ScheduleShiftMutation
    ): AppSchedule = wrap {
        val resolvedEmployeeId = mutation.employeeId?.takeIf { it > 0 }
        val action = when {
            resolvedEmployeeId != null -> "reassign"
            else -> "remove"
        }
        apiClient.api.updateShift(
            scheduleId = scheduleId,
            shiftId = shiftId,
            request = ScheduleShiftUpdateRequestDto(
                date = dateFormatter.format(mutation.date),
                startTime = minutesToTime(mutation.startMinutes),
                endTime = minutesToTime(mutation.endMinutes),
                positionId = mutation.positionId,
                employeeId = resolvedEmployeeId,
                action = action
            )
        ).toDomain()
    }

    override suspend fun deleteShift(scheduleId: Int, shiftId: Int): AppSchedule = wrap {
        apiClient.api.deleteShift(scheduleId = scheduleId, shiftId = shiftId)
        fetchSchedule(scheduleId)
    }

    override suspend fun updateScheduleRequirement(
        scheduleId: Int,
        requirementId: Int,
        mutation: ScheduleShiftMutation,
        quantity: Int
    ): AppSchedule = wrap {
        apiClient.api.updateScheduleRequirement(
            scheduleId = scheduleId,
            requirementId = requirementId,
            request = ScheduleRequirementInScheduleUpdateDto(
                branchId = null,
                positionId = mutation.positionId,
                date = dateFormatter.format(mutation.date),
                minStaff = quantity,
                requiredCount = quantity,
                startTime = minutesToTime(mutation.startMinutes),
                endTime = minutesToTime(mutation.endMinutes)
            )
        ).toDomain()
    }

    // ── Mapping ───────────────────────────────────────────────────────────────

    private fun ScheduleResponseDto.toDomain(): AppSchedule {
        val scheduleStatus = AppScheduleStatus.fromApiValue(status)
            ?: throw Exception("Unknown schedule status: $status")
        return AppSchedule(
            id = id,
            branchId = branchId,
            status = scheduleStatus,
            shifts = shifts.map { it.toShift() },
            unfilledRequirements = unfilledRequirements.map { it.toUnfilled() }
        )
    }

    private fun ScheduleShiftResponseDto.toShift(): AppScheduledShift {
        val parsedDate = dateFormatter.parse(date) ?: Date()
        return AppScheduledShift(
            id = id,
            employeeId = employeeId,
            employeeName = employeeName,
            positionId = positionId,
            positionName = position,
            date = parsedDate,
            startMinutes = timeToMinutes(startTime),
            endMinutes = timeToMinutes(endTime)
        )
    }

    private fun ScheduleUnfilledRequirementResponseDto.toUnfilled(): AppUnfilledRequirement {
        val parsedDate = dateFormatter.parse(date) ?: Date()
        return AppUnfilledRequirement(
            id = requirementId,
            positionId = positionId,
            positionTitle = positionTitle,
            date = parsedDate,
            startMinutes = timeToMinutes(startTime),
            endMinutes = timeToMinutes(endTime),
            missingStaff = missingStaff
        )
    }

    private fun AvailableEmployeeResponseDto.toEmployee(): AppAvailableEmployee {
        val status = AppEmployeeAvailabilityStatus.fromApiValue(availabilityStatus)
        return AppAvailableEmployee(
            id = id,
            fullName = fullName,
            positionName = position.name,
            branchName = branch?.name,
            availabilityStatus = status,
            assignedHours = assignedHours
        )
    }

    private fun timeToMinutes(time: String): Int {
        val parts = time.split(":").mapNotNull { it.toIntOrNull() }
        if (parts.size < 2) return 0
        return parts[0] * 60 + parts[1]
    }

    private fun minutesToTime(minutes: Int): String =
        String.format(Locale.US, "%02d:%02d:00", minutes / 60, minutes % 60)

    private val dateFormatter = SimpleDateFormat("yyyy-MM-dd", Locale.US)

    private suspend fun <T> wrap(block: suspend () -> T): T {
        return try {
            block()
        } catch (error: Throwable) {
            throw Exception(apiClient.userMessage(error))
        }
    }
}
