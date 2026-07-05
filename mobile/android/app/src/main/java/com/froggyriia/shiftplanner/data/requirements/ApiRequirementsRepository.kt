package com.froggyriia.shiftplanner.data.requirements

import com.froggyriia.shiftplanner.data.network.ApiClient
import com.froggyriia.shiftplanner.data.network.ScheduleRequirementBulkCreateDto
import com.froggyriia.shiftplanner.data.network.ScheduleRequirementCreateDto
import com.froggyriia.shiftplanner.data.network.ScheduleRequirementResponseDto
import com.froggyriia.shiftplanner.data.network.ScheduleRequirementTemplateCreateDto
import com.froggyriia.shiftplanner.data.network.ScheduleRequirementUpdateDto
import com.froggyriia.shiftplanner.domain.model.RequirementOccurrence
import com.froggyriia.shiftplanner.domain.model.RequirementPositionOption
import com.froggyriia.shiftplanner.domain.model.RequirementTemplateDraft
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

class ApiRequirementsRepository(
    private val apiClient: ApiClient
) : RequirementsRepository {

    override suspend fun fetchPositions(): List<RequirementPositionOption> = wrap {
        apiClient.api.getPositions().map { RequirementPositionOption(id = it.id, name = it.title) }
    }

    override suspend fun fetchRequirements(
        startDate: String,
        endDate: String
    ): List<RequirementOccurrence> = wrap {
        apiClient.api.getRequirements(startDate = startDate, endDate = endDate)
            .map { it.toOccurrence() }
    }

    override suspend fun createRequirement(
        date: String,
        branchId: Int?,
        positionId: Int,
        quantity: Int,
        startSlot: Int,
        endSlot: Int
    ): RequirementOccurrence = wrap {
        apiClient.api.createRequirement(
            ScheduleRequirementCreateDto(
                branchId = branchId,
                positionId = positionId,
                date = date,
                minStaff = quantity,
                requiredCount = quantity,
                startTime = slotToTime(startSlot),
                endTime = slotToTime(endSlot)
            )
        ).toOccurrence()
    }

    override suspend fun updateRequirement(
        id: Int,
        date: String,
        branchId: Int?,
        positionId: Int,
        quantity: Int,
        startSlot: Int,
        endSlot: Int
    ): RequirementOccurrence = wrap {
        apiClient.api.updateRequirement(
            id = id,
            request = ScheduleRequirementUpdateDto(
                branchId = branchId,
                positionId = positionId,
                date = date,
                minStaff = quantity,
                requiredCount = quantity,
                startTime = slotToTime(startSlot),
                endTime = slotToTime(endSlot)
            )
        ).toOccurrence()
    }

    override suspend fun deleteRequirement(id: Int) = wrap {
        apiClient.api.deleteRequirement(id)
        Unit
    }

    override suspend fun createRequirementsBulk(
        startDate: String,
        endDate: String,
        weekdays: List<Int>,
        templates: List<RequirementTemplateDraft>
    ): List<RequirementOccurrence> = wrap {
        apiClient.api.createRequirementsBulk(
            ScheduleRequirementBulkCreateDto(
                startDate = startDate,
                endDate = endDate,
                weekdays = weekdays,
                requirements = templates.map {
                    ScheduleRequirementTemplateCreateDto(
                        positionId = it.positionId,
                        minStaff = it.quantity,
                        startTime = slotToTime(it.startSlot),
                        endTime = slotToTime(it.endSlot)
                    )
                }
            )
        ).requirements.map { it.toOccurrence() }
    }

    private fun ScheduleRequirementResponseDto.toOccurrence(): RequirementOccurrence {
        val parsedDate = dateFormatter.parse(date) ?: Date()
        val cal = Calendar.getInstance().apply { time = parsedDate }
        // Convert Sunday=1..Saturday=7 to Monday=0..Sunday=6
        val weekday = (cal.get(Calendar.DAY_OF_WEEK) + 5) % 7
        return RequirementOccurrence(
            id = id,
            date = parsedDate,
            weekday = weekday,
            branchId = branchId,
            positionId = positionId,
            positionName = positionTitle,
            quantity = minStaff,
            startSlot = timeToSlot(startTime),
            endSlot = timeToSlot(endTime)
        )
    }

    private fun slotToTime(slot: Int): String {
        val totalMinutes = slot * 30
        return String.format(Locale.US, "%02d:%02d:00", totalMinutes / 60, totalMinutes % 60)
    }

    private fun timeToSlot(time: String): Int {
        val parts = time.split(":").mapNotNull { it.toIntOrNull() }
        if (parts.size < 2) return 0
        return (parts[0] * 60 + parts[1]) / 30
    }

    private val dateFormatter = SimpleDateFormat("yyyy-MM-dd", Locale.US)

    private suspend fun <T> wrap(block: suspend () -> T): T {
        return try {
            block()
        } catch (error: Throwable) {
            throw Exception(apiClient.userMessage(error))
        }
    }
}
