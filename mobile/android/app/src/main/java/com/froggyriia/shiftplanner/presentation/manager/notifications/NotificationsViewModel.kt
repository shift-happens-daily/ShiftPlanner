package com.froggyriia.shiftplanner.presentation.manager.notifications

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.froggyriia.shiftplanner.data.employees.EmployeeManagementRepository
import com.froggyriia.shiftplanner.data.schedule.ScheduleRepository
import com.froggyriia.shiftplanner.domain.model.PendingEmployeeRequest
import com.froggyriia.shiftplanner.domain.model.PendingManagerRequest
import com.froggyriia.shiftplanner.domain.model.PendingShiftExchange
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class NotificationsUiState(
    val exchangeRequests: List<PendingShiftExchange> = emptyList(),
    val employeeRequests: List<PendingEmployeeRequest> = emptyList(),
    val managerRequests: List<PendingManagerRequest> = emptyList(),
    val isLoading: Boolean = false,
    val errorMessage: String? = null
)

/**
 * Aggregates everything a manager must act on: shift-exchange requests,
 * time-off requests (scaffolded — no backend approval flow yet), and join
 * requests from new employees and managers.
 */
class NotificationsViewModel(
    private val scheduleRepository: ScheduleRepository,
    private val employeeRepository: EmployeeManagementRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(NotificationsUiState())
    val uiState: StateFlow<NotificationsUiState> = _uiState.asStateFlow()

    init { load() }

    fun load() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            val exchange = runCatching { scheduleRepository.fetchExchangeRequests() }.getOrDefault(emptyList())
            val employees = runCatching { employeeRepository.fetchEmployeeRequests() }.getOrDefault(emptyList())
            val managers = runCatching { employeeRepository.fetchManagerRequests() }.getOrDefault(emptyList())
            _uiState.value = _uiState.value.copy(
                exchangeRequests = exchange,
                employeeRequests = employees,
                managerRequests = managers,
                isLoading = false
            )
        }
    }

    fun approveExchange(request: PendingShiftExchange) = mutate { scheduleRepository.updateExchangeRequest(request.id, approved = true) }
    fun rejectExchange(request: PendingShiftExchange) = mutate { scheduleRepository.updateExchangeRequest(request.id, approved = false) }
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
