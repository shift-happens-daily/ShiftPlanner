package com.froggyriia.shiftplanner

import android.content.Context
import com.froggyriia.shiftplanner.data.auth.ApiAuthRepository
import com.froggyriia.shiftplanner.data.auth.AuthRepository
import com.froggyriia.shiftplanner.data.availability.ApiAvailabilityRepository
import com.froggyriia.shiftplanner.data.availability.AvailabilityRepository
import com.froggyriia.shiftplanner.data.company.ApiCompanyRepository
import com.froggyriia.shiftplanner.data.company.CompanyRepository
import com.froggyriia.shiftplanner.data.employees.ApiEmployeeManagementRepository
import com.froggyriia.shiftplanner.data.employees.EmployeeManagementRepository
import com.froggyriia.shiftplanner.data.network.ApiClient
import com.froggyriia.shiftplanner.data.network.TokenStore
import com.froggyriia.shiftplanner.data.requirements.ApiRequirementsRepository
import com.froggyriia.shiftplanner.data.requirements.RequirementsRepository
import com.froggyriia.shiftplanner.data.reports.ApiReportsRepository
import com.froggyriia.shiftplanner.data.reports.ReportsRepository
import com.froggyriia.shiftplanner.data.schedule.ApiScheduleRepository
import com.froggyriia.shiftplanner.data.schedule.ScheduleRepository

class AppContainer(
    context: Context
) {
    private val tokenStore = TokenStore(context.applicationContext)
    val apiClient = ApiClient(tokenStore)

    val authRepository: AuthRepository = ApiAuthRepository(
        apiClient = apiClient,
        tokenStore = tokenStore
    )

    val companyRepository: CompanyRepository = ApiCompanyRepository(apiClient)

    val availabilityRepository: AvailabilityRepository = ApiAvailabilityRepository(apiClient)

    val requirementsRepository: RequirementsRepository = ApiRequirementsRepository(apiClient)

    val scheduleRepository: ScheduleRepository = ApiScheduleRepository(apiClient)

    val reportsRepository: ReportsRepository = ApiReportsRepository(apiClient)

    /** Pass companyId after login to scope positions to the manager's company. */
    fun employeeManagementRepository(companyId: Int?): EmployeeManagementRepository =
        ApiEmployeeManagementRepository(apiClient = apiClient, companyId = companyId)
}
