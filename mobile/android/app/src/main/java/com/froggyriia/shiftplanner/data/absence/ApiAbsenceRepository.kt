package com.froggyriia.shiftplanner.data.absence

import com.froggyriia.shiftplanner.data.network.AbsenceCreateRequestDto
import com.froggyriia.shiftplanner.data.network.AbsenceResponseDto
import com.froggyriia.shiftplanner.data.network.ApiClient
import com.froggyriia.shiftplanner.data.network.ShiftExchangeCreateRequestDto
import com.froggyriia.shiftplanner.data.network.ShiftExchangeResponseDto
import com.froggyriia.shiftplanner.domain.model.AppAbsence
import com.froggyriia.shiftplanner.domain.model.AppAbsenceStatus
import com.froggyriia.shiftplanner.domain.model.AppAbsenceType
import com.froggyriia.shiftplanner.domain.model.AppShiftExchangeRequest

class ApiAbsenceRepository(
    private val apiClient: ApiClient
) : AbsenceRepository {

    override suspend fun fetchMyAbsences(): List<AppAbsence> = wrap {
        apiClient.api.getMyAbsences().map { it.toDomain() }
    }

    override suspend fun createMyAbsence(
        type: AppAbsenceType,
        startDate: String,
        endDate: String,
        comment: String?
    ): AppAbsence = wrap {
        apiClient.api.createMyAbsence(
            AbsenceCreateRequestDto(
                absenceType = type.apiValue,
                startDate = startDate,
                endDate = endDate,
                comment = comment
            )
        ).toDomain()
    }

    override suspend fun fetchEmployeeAbsences(employeeId: Int): List<AppAbsence> = wrap {
        apiClient.api.getEmployeeAbsences(employeeId).map { it.toDomain() }
    }

    override suspend fun updateAbsence(
        employeeId: Int,
        absenceId: Int,
        type: AppAbsenceType,
        startDate: String,
        endDate: String,
        comment: String?
    ): AppAbsence = wrap {
        apiClient.api.updateAbsence(
            employeeId = employeeId,
            absenceId = absenceId,
            request = AbsenceCreateRequestDto(
                absenceType = type.apiValue,
                startDate = startDate,
                endDate = endDate,
                comment = comment
            )
        ).toDomain()
    }

    override suspend fun deleteAbsence(employeeId: Int, absenceId: Int): Unit = wrap {
        apiClient.api.deleteAbsence(employeeId = employeeId, absenceId = absenceId)
    }

    override suspend fun createExchangeRequest(shiftId: Int, note: String?): AppShiftExchangeRequest = wrap {
        apiClient.api.createExchangeRequest(
            ShiftExchangeCreateRequestDto(shiftId = shiftId, note = note)
        ).toDomain()
    }

    override suspend fun fetchExchangeRequests(): List<AppShiftExchangeRequest> = wrap {
        apiClient.api.getExchangeRequests().map { it.toDomain() }
    }

    override suspend fun approveExchangeRequest(id: Int): AppShiftExchangeRequest = wrap {
        apiClient.api.approveExchangeRequest(id).toDomain()
    }

    override suspend fun rejectExchangeRequest(id: Int): AppShiftExchangeRequest = wrap {
        apiClient.api.rejectExchangeRequest(id).toDomain()
    }

    // ── Mapping ───────────────────────────────────────────────────────────────

    private fun AbsenceResponseDto.toDomain() = AppAbsence(
        id = id,
        absenceType = AppAbsenceType.fromApiValue(absenceType),
        startDate = startDate,
        endDate = endDate,
        comment = comment,
        status = AppAbsenceStatus.fromApiValue(status),
        employeeId = employeeId
    )

    private fun ShiftExchangeResponseDto.toDomain() = AppShiftExchangeRequest(
        id = id,
        shiftId = shiftId,
        note = note,
        status = status,
        employeeId = employeeId
    )

    private suspend fun <T> wrap(block: suspend () -> T): T {
        return try {
            block()
        } catch (error: Throwable) {
            throw Exception(apiClient.userMessage(error))
        }
    }
}
