package com.froggyriia.shiftplanner.presentation.manager.employees

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.froggyriia.shiftplanner.data.employees.EmployeeManagementRepository
import com.froggyriia.shiftplanner.domain.model.ManagedBranch
import com.froggyriia.shiftplanner.domain.model.ManagedEmployee
import com.froggyriia.shiftplanner.domain.model.ManagedPosition
import com.froggyriia.shiftplanner.domain.model.PendingEmployeeRequest
import com.froggyriia.shiftplanner.domain.model.PendingManagerRequest
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class EmployeesUiState(
    val employees: List<ManagedEmployee> = emptyList(),
    val positions: List<ManagedPosition> = emptyList(),
    val branches: List<ManagedBranch> = emptyList(),
    val pendingManagerRequests: List<PendingManagerRequest> = emptyList(),
    val pendingEmployeeRequests: List<PendingEmployeeRequest> = emptyList(),
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
    val statusMessage: String? = null
)

data class EmployeeCreationDraft(
    val fullName: String = "",
    val email: String = "",
    val positionId: Int? = null,
    val branchId: Int? = null
)

class EmployeesViewModel(
    private val repository: EmployeeManagementRepository,
    private val companyId: Int?
) : ViewModel() {

    private val _uiState = MutableStateFlow(EmployeesUiState())
    val uiState: StateFlow<EmployeesUiState> = _uiState.asStateFlow()

    private var hasLoaded = false

    fun loadData(force: Boolean = false) {
        // Branches always refresh — they can be added from CompanyScreen at any time
        viewModelScope.launch {
            try {
                val branches = repository.fetchBranches().sortedBy { it.name }
                _uiState.value = _uiState.value.copy(branches = branches)
            } catch (_: Exception) {}
        }

        if (hasLoaded && !force) return
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            try {
                val positions = repository.fetchPositions().sortedBy { it.title }
                val employees = repository.fetchEmployees().sortedBy { it.fullName }
                _uiState.value = _uiState.value.copy(
                    positions = positions,
                    employees = employees,
                    isLoading = false
                )
                hasLoaded = true
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(errorMessage = e.message, isLoading = false)
            }
        }
        loadPendingRequests()
    }

    fun loadPendingRequests() {
        viewModelScope.launch {
            try {
                val managerReqs = repository.fetchManagerRequests()
                val employeeReqs = repository.fetchEmployeeRequests()
                _uiState.value = _uiState.value.copy(
                    pendingManagerRequests = managerReqs,
                    pendingEmployeeRequests = employeeReqs
                )
            } catch (_: Exception) {}
        }
    }

    fun clearMessages() {
        _uiState.value = _uiState.value.copy(errorMessage = null, statusMessage = null)
    }

    // ── Employees ─────────────────────────────────────────────────────────────

    fun createEmployee(draft: EmployeeCreationDraft, onDone: (Boolean) -> Unit) {
        val name = draft.fullName.trim()
        val email = draft.email.trim()
        if (name.isEmpty()) { error("Employee name is required"); onDone(false); return }
        if (email.isEmpty()) { error("Employee email is required"); onDone(false); return }
        val positionId = draft.positionId ?: run { error("Position is required"); onDone(false); return }

        viewModelScope.launch {
            try {
                val created = repository.createEmployee(
                    fullName = name,
                    email = email,
                    positionId = positionId,
                    branchId = draft.branchId
                )
                val updated = (_uiState.value.employees + created).sortedBy { it.fullName }
                _uiState.value = _uiState.value.copy(
                    employees = updated,
                    statusMessage = "Employee added.",
                    errorMessage = null
                )
                onDone(true)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(errorMessage = e.message, statusMessage = null)
                onDone(false)
            }
        }
    }

    fun deleteEmployee(employee: ManagedEmployee) {
        viewModelScope.launch {
            try {
                repository.deleteEmployee(employee.id)
                val updated = _uiState.value.employees.filter { it.id != employee.id }
                _uiState.value = _uiState.value.copy(
                    employees = updated,
                    statusMessage = "Employee removed.",
                    errorMessage = null
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(errorMessage = e.message, statusMessage = null)
            }
        }
    }

    fun assignPosition(employee: ManagedEmployee, positionId: Int?) {
        viewModelScope.launch {
            try {
                val updated = repository.assignPosition(employee.id, positionId)
                val employees = _uiState.value.employees.map { if (it.id == employee.id) updated else it }
                _uiState.value = _uiState.value.copy(
                    employees = employees,
                    statusMessage = "Position updated.",
                    errorMessage = null
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(errorMessage = e.message, statusMessage = null)
            }
        }
    }

    fun assignBranch(employee: ManagedEmployee, branchId: Int?) {
        viewModelScope.launch {
            try {
                val updated = repository.assignBranch(employee.id, branchId)
                val employees = _uiState.value.employees.map { if (it.id == employee.id) updated else it }
                _uiState.value = _uiState.value.copy(
                    employees = employees,
                    statusMessage = "Branch updated.",
                    errorMessage = null
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(errorMessage = e.message, statusMessage = null)
            }
        }
    }

    // ── Positions ─────────────────────────────────────────────────────────────

    fun createPosition(title: String) {
        val trimmed = title.trim()
        if (trimmed.isEmpty()) { error("Title cannot be empty"); return }
        if (_uiState.value.positions.any { it.title.equals(trimmed, ignoreCase = true) }) {
            error("Position already exists"); return
        }
        val cId = companyId ?: run { error("No company context"); return }

        viewModelScope.launch {
            try {
                val created = repository.createPosition(trimmed, cId)
                val positions = (_uiState.value.positions + created).sortedBy { it.title }
                _uiState.value = _uiState.value.copy(
                    positions = positions,
                    statusMessage = "Position created.",
                    errorMessage = null
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(errorMessage = e.message, statusMessage = null)
            }
        }
    }

    fun deletePosition(position: ManagedPosition) {
        viewModelScope.launch {
            try {
                repository.deletePosition(position.id)
                val positions = _uiState.value.positions.filter { it.id != position.id }
                _uiState.value = _uiState.value.copy(
                    positions = positions,
                    statusMessage = "Position removed.",
                    errorMessage = null
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(errorMessage = e.message, statusMessage = null)
            }
        }
    }

    // ── Pending requests ──────────────────────────────────────────────────────

    fun acceptManagerRequest(req: PendingManagerRequest) {
        viewModelScope.launch {
            try {
                repository.acceptManagerRequest(req.id)
                val updated = _uiState.value.pendingManagerRequests.filter { it.id != req.id }
                _uiState.value = _uiState.value.copy(
                    pendingManagerRequests = updated,
                    statusMessage = "${req.fullName} принят как менеджер."
                )
                loadData(force = true)
            } catch (e: Exception) { error(e.message ?: "Ошибка") }
        }
    }

    fun declineManagerRequest(req: PendingManagerRequest) {
        viewModelScope.launch {
            try {
                repository.declineManagerRequest(req.id)
                val updated = _uiState.value.pendingManagerRequests.filter { it.id != req.id }
                _uiState.value = _uiState.value.copy(
                    pendingManagerRequests = updated,
                    statusMessage = "Заявка ${req.fullName} отклонена."
                )
            } catch (e: Exception) { error(e.message ?: "Ошибка") }
        }
    }

    fun acceptEmployeeRequest(req: PendingEmployeeRequest) {
        viewModelScope.launch {
            try {
                repository.acceptEmployeeRequest(req.id)
                val updated = _uiState.value.pendingEmployeeRequests.filter { it.id != req.id }
                _uiState.value = _uiState.value.copy(
                    pendingEmployeeRequests = updated,
                    statusMessage = "${req.fullName} принят как сотрудник."
                )
                loadData(force = true)
            } catch (e: Exception) { error(e.message ?: "Ошибка") }
        }
    }

    fun declineEmployeeRequest(req: PendingEmployeeRequest) {
        viewModelScope.launch {
            try {
                repository.declineEmployeeRequest(req.id)
                val updated = _uiState.value.pendingEmployeeRequests.filter { it.id != req.id }
                _uiState.value = _uiState.value.copy(
                    pendingEmployeeRequests = updated,
                    statusMessage = "Заявка ${req.fullName} отклонена."
                )
            } catch (e: Exception) { error(e.message ?: "Ошибка") }
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    fun positionTitle(employee: ManagedEmployee): String {
        val id = employee.positionId ?: return employee.positionTitle ?: "No position"
        return _uiState.value.positions.firstOrNull { it.id == id }?.title
            ?: employee.positionTitle ?: "No position"
    }

    fun branchTitle(employee: ManagedEmployee): String {
        val id = employee.branchId ?: return employee.branchName ?: "No branch"
        return _uiState.value.branches.firstOrNull { it.id == id }?.name
            ?: employee.branchName ?: "No branch"
    }

    private fun error(msg: String) {
        _uiState.value = _uiState.value.copy(errorMessage = msg, statusMessage = null)
    }
}
