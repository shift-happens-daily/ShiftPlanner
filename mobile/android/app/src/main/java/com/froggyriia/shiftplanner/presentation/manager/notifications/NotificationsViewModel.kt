package com.froggyriia.shiftplanner.presentation.manager.notifications

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.froggyriia.shiftplanner.data.absence.AbsenceRepository
import com.froggyriia.shiftplanner.data.employees.EmployeeManagementRepository
import com.froggyriia.shiftplanner.data.schedule.ScheduleRepository
import com.froggyriia.shiftplanner.domain.model.AppAbsence
import com.froggyriia.shiftplanner.domain.model.PendingEmployeeRequest
import com.froggyriia.shiftplanner.domain.model.PendingManagerRequest
import com.froggyriia.shiftplanner.domain.model.PendingShiftExchange
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/** One employee's time-off entry, carried with the owning employee so the manager can act on it. */
data class ManagerTimeOffItem(
    val employeeId: Int,
    val employeeName: String,
    val absence: AppAbsence
)

data class NotificationsUiState(
    val exchangeRequests: List<PendingShiftExchange> = emptyList(),
    val timeOff: List<ManagerTimeOffItem> = emptyList(),
    val employeeRequests: List<PendingEmployeeRequest> = emptyList(),
    val managerRequests: List<PendingManagerRequest> = emptyList(),
    val isLoading: Boolean = false,
    val errorMessage: String? = null
)

/**
 * Aggregates everything a manager must act on: shift-exchange requests, time-off
 * requests (collected per employee — there is no company-wide absence endpoint),
 * and join requests from new employees and managers.
 */
class NotificationsViewModel(
    private val scheduleRepository: ScheduleRepository,
    private val employeeRepository: EmployeeManagementRepository,
    private val absenceRepository: AbsenceRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(NotificationsUiState())
    val uiState: StateFlow<NotificationsUiState> = _uiState.asStateFlow()

    init { load() }

    fun load() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            val exchange = runCatching { scheduleRepository.fetchExchangeRequests() }.getOrDefault(emptyList())
            val employees = runCatching { employeeRepository.fetchEmployees() }.getOrDefault(emptyList())
            val requests = runCatching { employeeRepository.fetchEmployeeRequests() }.getOrDefault(emptyList())
            val managers = runCatching { employeeRepository.fetchManagerRequests() }.getOrDefault(emptyList())

            // Fan out absence lookups per employee (no aggregate endpoint exists).
            val timeOff = runCatching {
                coroutineScope {
                    employees.map { emp ->
                        async {
                            runCatching { absenceRepository.fetchEmployeeAbsences(emp.id) }
                                .getOrDefault(emptyList())
                                .map { ManagerTimeOffItem(emp.id, emp.fullName, it) }
                        }
                    }.awaitAll().flatten()
                }
            }.getOrDefault(emptyList())
                .sortedByDescending { it.absence.startDate }

            _uiState.value = _uiState.value.copy(
                exchangeRequests = exchange,
                timeOff = timeOff,
                employeeRequests = requests,
                managerRequests = managers,
                isLoading = false
            )
        }
    }

    fun approveExchange(request: PendingShiftExchange) = mutate { scheduleRepository.updateExchangeRequest(request.id, approved = true) }
    fun rejectExchange(request: PendingShiftExchange) = mutate { scheduleRepository.updateExchangeRequest(request.id, approved = false) }
    fun deleteTimeOff(item: ManagerTimeOffItem) = mutate { absenceRepository.deleteAbsence(item.employeeId, item.absence.id) }
    fun acceptEmployee(request: PendingEmployeeRequest) = mutate { employeeRepository.acceptEmployeeRequest(request.id) }
    fun declineEmployee(request: PendingEmployeeRequest) = mutate { employeeRepository.declineEmployeeRequest(request.id) }
    fun acceptManager(request: PendingManagerRequest) = mutate { employeeRepository.acceptManagerRequest(request.id) }
    fun declineManager(request: PendingManagerRequest) = mutate { employeeRepository.declineManagerRequest(request.id) }

    private fun mutate(action: suspend () -> Unit) {
        viewModelScope.launch {
            try {
                action()
                load()
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(errorMessage = e.message)
            }
        }
    }
}
