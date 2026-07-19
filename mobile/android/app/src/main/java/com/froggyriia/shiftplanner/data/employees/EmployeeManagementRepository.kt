package com.froggyriia.shiftplanner.data.employees

import com.froggyriia.shiftplanner.domain.model.ManagedBranch
import com.froggyriia.shiftplanner.domain.model.ManagedBranchAssignment
import com.froggyriia.shiftplanner.domain.model.ManagedEmployee
import com.froggyriia.shiftplanner.domain.model.ManagedEmployeeCalendar
import com.froggyriia.shiftplanner.domain.model.ManagedPosition
import com.froggyriia.shiftplanner.domain.model.PendingEmployeeRequest
import com.froggyriia.shiftplanner.domain.model.PendingManagerRequest
import com.froggyriia.shiftplanner.domain.model.WorkLimits

interface EmployeeManagementRepository {
    suspend fun fetchEmployees(): List<ManagedEmployee>
    suspend fun fetchBranches(): List<ManagedBranch>
    suspend fun fetchPositions(): List<ManagedPosition>
    suspend fun createEmployee(
        fullName: String,
        email: String,
        positionId: Int,
        branchId: Int?
    ): ManagedEmployee
    suspend fun deleteEmployee(employeeId: Int)
    suspend fun assignPosition(employeeId: Int, positionId: Int?): ManagedEmployee
    suspend fun assignBranch(employeeId: Int, branchId: Int?): ManagedEmployee
    suspend fun createPosition(title: String, companyId: Int): ManagedPosition
    suspend fun deletePosition(positionId: Int)

    suspend fun linkEmployeeByPublicId(publicId: String, branchId: Int?, positionId: Int?): ManagedEmployee

    // ── Multi-branch, calendar, add-manager ───────────────────────────────────
    suspend fun addManagerByPublicId(publicId: String): PendingManagerRequest
    suspend fun fetchEmployeeBranches(employeeId: Int): List<ManagedBranchAssignment>
    suspend fun replaceEmployeeBranches(employeeId: Int, branchIds: List<Int>, primaryBranchId: Int): List<ManagedBranchAssignment>
    suspend fun fetchEmployeeCalendar(employeeId: Int): ManagedEmployeeCalendar

    // ── Work-hours limits ─────────────────────────────────────────────────────
    suspend fun fetchWorkLimits(employeeId: Int): WorkLimits
    suspend fun updateWorkLimits(employeeId: Int, maxHoursPerWeek: Int, maxHoursPerDay: Int): WorkLimits

    // ── Pending join requests ─────────────────────────────────────────────────
    suspend fun fetchManagerRequests(): List<PendingManagerRequest>
    suspend fun acceptManagerRequest(id: Int)
    suspend fun declineManagerRequest(id: Int)
    suspend fun fetchEmployeeRequests(): List<PendingEmployeeRequest>
    suspend fun acceptEmployeeRequest(id: Int)
    suspend fun declineEmployeeRequest(id: Int)
}
