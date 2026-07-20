package com.froggyriia.shiftplanner.data.employees

import com.froggyriia.shiftplanner.data.network.ApiClient
import com.froggyriia.shiftplanner.data.network.EmployeeBranchUpdateRequestDto
import com.froggyriia.shiftplanner.data.network.EmployeeCreateRequestDto
import com.froggyriia.shiftplanner.data.network.EmployeePositionUpdateRequestDto
import com.froggyriia.shiftplanner.data.network.LinkUserRequestDto
import com.froggyriia.shiftplanner.data.network.EmployeeWorkLimitsDto
import com.froggyriia.shiftplanner.data.network.EmployeeBranchesUpdateDto
import com.froggyriia.shiftplanner.data.network.CompanyUserPublicIdRequestDto
import com.froggyriia.shiftplanner.data.network.PositionCreateRequestDto
import com.froggyriia.shiftplanner.domain.model.ManagedBranch
import com.froggyriia.shiftplanner.domain.model.ManagedBranchAssignment
import com.froggyriia.shiftplanner.domain.model.ManagedEmployee
import com.froggyriia.shiftplanner.domain.model.ManagedEmployeeCalendar
import com.froggyriia.shiftplanner.domain.model.ManagedEmployeeCalendarShift
import com.froggyriia.shiftplanner.domain.model.ManagedPosition
import com.froggyriia.shiftplanner.domain.model.PendingEmployeeRequest
import com.froggyriia.shiftplanner.domain.model.PendingManagerRequest
import com.froggyriia.shiftplanner.domain.model.WorkLimits

class ApiEmployeeManagementRepository(
    private val apiClient: ApiClient,
    private val companyId: Int?
) : EmployeeManagementRepository {

    override suspend fun fetchEmployees(): List<ManagedEmployee> = wrap {
        apiClient.api.getEmployees().map { it.toDomain() }
            .sortedBy { it.fullName }
    }

    override suspend fun fetchBranches(): List<ManagedBranch> = wrap {
        apiClient.api.getBranches().map { ManagedBranch(id = it.id, name = it.name) }
    }

    override suspend fun fetchPositions(): List<ManagedPosition> = wrap {
        apiClient.api.getPositions()
            .filter { it.companyId == companyId }
            .map { it.toDomain() }
            .sortedBy { it.title }
    }

    override suspend fun createEmployee(
        fullName: String,
        email: String,
        positionId: Int,
        branchId: Int?
    ): ManagedEmployee = wrap {
        val created = apiClient.api.createEmployee(
            EmployeeCreateRequestDto(fullName = fullName, email = email, positionId = positionId)
        ).toDomain()

        if (branchId != null) {
            apiClient.api.updateEmployeeBranch(
                id = created.id,
                request = EmployeeBranchUpdateRequestDto(branchId = branchId)
            ).toDomain()
        } else {
            created
        }
    }

    override suspend fun deleteEmployee(employeeId: Int) = wrap {
        apiClient.api.deleteEmployee(employeeId)
        Unit
    }

    override suspend fun assignPosition(employeeId: Int, positionId: Int?): ManagedEmployee = wrap {
        apiClient.api.updateEmployeePosition(
            id = employeeId,
            request = EmployeePositionUpdateRequestDto(positionId = positionId)
        ).toDomain()
    }

    override suspend fun assignBranch(employeeId: Int, branchId: Int?): ManagedEmployee = wrap {
        apiClient.api.updateEmployeeBranch(
            id = employeeId,
            request = EmployeeBranchUpdateRequestDto(branchId = branchId)
        ).toDomain()
    }

    override suspend fun createPosition(title: String, companyId: Int): ManagedPosition = wrap {
        apiClient.api.createPosition(
            PositionCreateRequestDto(title = title, companyId = companyId)
        ).toDomain()
    }

    override suspend fun deletePosition(positionId: Int) = wrap {
        apiClient.api.deletePosition(positionId)
        Unit
    }

    override suspend fun linkEmployeeByPublicId(
        publicId: String,
        branchId: Int?,
        positionId: Int?
    ): ManagedEmployee = wrap {
        apiClient.api.linkUserToCompany(
            LinkUserRequestDto(userPublicId = publicId, branchId = branchId, positionId = positionId)
        ).toDomain()
    }

    override suspend fun fetchWorkLimits(employeeId: Int): WorkLimits = wrap {
        apiClient.api.getEmployeeWorkLimits(employeeId).let {
            WorkLimits(maxHoursPerWeek = it.maxHoursPerWeek, maxHoursPerDay = it.maxHoursPerDay)
        }
    }

    override suspend fun updateWorkLimits(
        employeeId: Int,
        maxHoursPerWeek: Int,
        maxHoursPerDay: Int
    ): WorkLimits = wrap {
        apiClient.api.updateEmployeeWorkLimits(
            id = employeeId,
            request = EmployeeWorkLimitsDto(
                maxHoursPerWeek = maxHoursPerWeek,
                maxHoursPerDay = maxHoursPerDay
            )
        ).let { WorkLimits(maxHoursPerWeek = it.maxHoursPerWeek, maxHoursPerDay = it.maxHoursPerDay) }
    }

    // ── Pending join requests ─────────────────────────────────────────────────

    override suspend fun fetchManagerRequests(): List<PendingManagerRequest> = wrap {
        apiClient.api.getManagerRequests()
            .filter { it.membershipStatus == "pending" }
            .map { it.toDomain() }
    }

    override suspend fun acceptManagerRequest(id: Int) = wrap {
        apiClient.api.acceptManagerRequest(id); Unit
    }

    override suspend fun declineManagerRequest(id: Int) = wrap {
        apiClient.api.declineManagerRequest(id); Unit
    }

    override suspend fun fetchEmployeeRequests(): List<PendingEmployeeRequest> = wrap {
        apiClient.api.getEmployeeRequests()
            .filter { !it.isActive }
            .map { it.toDomain() }
    }

    override suspend fun acceptEmployeeRequest(id: Int) = wrap {
        apiClient.api.acceptEmployeeRequest(id); Unit
    }

    override suspend fun declineEmployeeRequest(id: Int) = wrap {
        apiClient.api.declineEmployeeRequest(id); Unit
    }

    override suspend fun addManagerByPublicId(publicId: String): PendingManagerRequest = wrap {
        apiClient.api.addManagerByPublicId(CompanyUserPublicIdRequestDto(userPublicId = publicId)).toDomain()
    }

    override suspend fun fetchEmployeeBranches(employeeId: Int): List<ManagedBranchAssignment> = wrap {
        apiClient.api.getEmployeeBranches(employeeId).map {
            ManagedBranchAssignment(id = it.id, name = it.name, isPrimary = it.isPrimary)
        }
    }

    override suspend fun replaceEmployeeBranches(
        employeeId: Int,
        branchIds: List<Int>,
        primaryBranchId: Int
    ): List<ManagedBranchAssignment> = wrap {
        apiClient.api.replaceEmployeeBranches(
            employeeId,
            EmployeeBranchesUpdateDto(branchIds = branchIds, primaryBranchId = primaryBranchId)
        ).map { ManagedBranchAssignment(id = it.id, name = it.name, isPrimary = it.isPrimary) }
    }

    override suspend fun fetchEmployeeCalendar(employeeId: Int): ManagedEmployeeCalendar = wrap {
        val dto = apiClient.api.getEmployeeCalendarSummary(employeeId)
        val shifts = dto.shifts.map { s ->
            ManagedEmployeeCalendarShift(
                date = s.date,
                startMinutes = timeToMinutes(s.startTime),
                endMinutes = timeToMinutes(s.endTime),
                status = s.status ?: ""
            )
        }.sortedWith(compareBy({ it.date }, { it.startMinutes }))
        ManagedEmployeeCalendar(
            employeeName = dto.employee.fullName,
            totalShifts = dto.workload?.totalShifts ?: shifts.size,
            totalHours = dto.workload?.totalHours ?: 0.0,
            shifts = shifts
        )
    }

    private fun timeToMinutes(time: String): Int {
        val parts = time.split(":").mapNotNull { it.toIntOrNull() }
        return if (parts.size >= 2) parts[0] * 60 + parts[1] else 0
    }

    private suspend fun <T> wrap(block: suspend () -> T): T {
        return try {
            block()
        } catch (error: Throwable) {
            throw Exception(apiClient.userMessage(error))
        }
    }
}
