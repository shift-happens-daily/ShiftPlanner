package com.froggyriia.shiftplanner.data.reports

import com.froggyriia.shiftplanner.domain.model.EmployeeReport
import com.froggyriia.shiftplanner.domain.model.MySelfReport

interface ReportsRepository {
    suspend fun fetchEmployeeReports(
        startDate: String? = null,
        endDate: String? = null
    ): List<EmployeeReport>

    suspend fun fetchMyReport(
        startDate: String? = null,
        endDate: String? = null
    ): MySelfReport
}
