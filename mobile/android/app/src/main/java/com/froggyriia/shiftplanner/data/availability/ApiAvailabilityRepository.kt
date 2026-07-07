package com.froggyriia.shiftplanner.data.availability

import com.froggyriia.shiftplanner.data.network.ApiClient
import com.froggyriia.shiftplanner.data.network.EmployeeAvailabilityBlockDto
import com.froggyriia.shiftplanner.data.network.EmployeeAvailabilityResponseDto
import com.froggyriia.shiftplanner.data.network.EmployeeAvailabilityUpsertDto
import com.froggyriia.shiftplanner.domain.model.AvailabilityBlock
import com.froggyriia.shiftplanner.domain.model.AvailabilitySlotState
import com.froggyriia.shiftplanner.domain.model.EmployeeAvailabilityData

class ApiAvailabilityRepository(
    private val apiClient: ApiClient
) : AvailabilityRepository {

    override suspend fun fetchAvailability(employeeId: Int): EmployeeAvailabilityData = wrap {
        apiClient.api.getEmployeeAvailability(employeeId).toDomain()
    }

    override suspend fun saveAvailability(
        employeeId: Int,
        data: EmployeeAvailabilityData
    ): EmployeeAvailabilityData = wrap {
        apiClient.api.saveEmployeeAvailability(
            id = employeeId,
            request = EmployeeAvailabilityUpsertDto(
                weeklyAvailability = data.weeklyAvailability.map { block ->
                    EmployeeAvailabilityBlockDto(
                        weekday = block.weekday,
                        startTime = block.startTime,
                        endTime = block.endTime,
                        availabilityStatus = block.status.apiValue
                    )
                },
                desiredDaysOff = data.desiredDaysOff
            )
        ).toDomain()
    }

    private fun EmployeeAvailabilityResponseDto.toDomain(): EmployeeAvailabilityData =
        EmployeeAvailabilityData(
            employeeId = employeeId,
            weeklyAvailability = weeklyAvailability.map { block ->
                AvailabilityBlock(
                    weekday = block.weekday,
                    startTime = block.startTime,
                    endTime = block.endTime,
                    status = AvailabilitySlotState.fromApiValue(block.availabilityStatus)
                )
            },
            desiredDaysOff = desiredDaysOff
        )

    private suspend fun <T> wrap(block: suspend () -> T): T {
        return try {
            block()
        } catch (error: Throwable) {
            throw Exception(apiClient.userMessage(error))
        }
    }
}
