package com.froggyriia.shiftplanner.data.reports

import com.froggyriia.shiftplanner.data.network.ApiClient
import com.froggyriia.shiftplanner.domain.model.EmployeeReport
import com.froggyriia.shiftplanner.domain.model.MySelfReport

class ApiReportsRepository(
    private val apiClient: ApiClient
) : ReportsRepository {

    override suspend fun fetchEmployeeReports(
        startDate: String?,
        endDate: String?
    ): List<EmployeeReport> = wrap {
        apiClient.api.getEmployeeReports(startDate, endDate).map { dto ->
            EmployeeReport(
                employeeId = dto.employeeId,
                fullName = dto.fullName,
                position = dto.position,
                totalHours = dto.totalHours,
                totalShifts = dto.totalShifts
            )
        }
    }

    override suspend fun fetchMyReport(
        startDate: String?,
        endDate: String?
    ): MySelfReport = wrap {
        apiClient.api.getMyReport(startDate, endDate).let { dto ->
            MySelfReport(
                employeeId = dto.employeeId,
                fullName = dto.fullName,
                totalHours = dto.totalHours,
                totalShifts = dto.totalShifts
            )
        }
    }

    private suspend fun <T> wrap(block: suspend () -> T): T {
        return try {
            block()
        } catch (error: Throwable) {
            throw Exception(apiClient.userMessage(error))
        }
    }
}
