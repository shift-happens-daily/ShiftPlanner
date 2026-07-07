package com.froggyriia.shiftplanner.data.availability

import com.froggyriia.shiftplanner.domain.model.EmployeeAvailabilityData

interface AvailabilityRepository {
    suspend fun fetchAvailability(employeeId: Int): EmployeeAvailabilityData
    suspend fun saveAvailability(
        employeeId: Int,
        data: EmployeeAvailabilityData
    ): EmployeeAvailabilityData
}
