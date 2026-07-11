package com.froggyriia.shiftplanner.data.employees

import com.froggyriia.shiftplanner.domain.model.ManagedBranch
import com.froggyriia.shiftplanner.domain.model.ManagedEmployee
import com.froggyriia.shiftplanner.domain.model.ManagedPosition
import com.froggyriia.shiftplanner.domain.model.PendingEmployeeRequest
import com.froggyriia.shiftplanner.domain.model.PendingManagerRequest

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

    // ── Pending join requests ─────────────────────────────────────────────────
    suspend fun fetchManagerRequests(): List<PendingManagerRequest>
    suspend fun acceptManagerRequest(id: Int)
    suspend fun declineManagerRequest(id: Int)
    suspend fun fetchEmployeeRequests(): List<PendingEmployeeRequest>
    suspend fun acceptEmployeeRequest(id: Int)
    suspend fun declineEmployeeRequest(id: Int)
}
