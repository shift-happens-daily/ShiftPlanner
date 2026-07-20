package com.froggyriia.shiftplanner.presentation.employee.notifications

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.froggyriia.shiftplanner.data.absence.AbsenceRepository
import com.froggyriia.shiftplanner.data.schedule.ScheduleRepository
import com.froggyriia.shiftplanner.domain.model.AppAbsence
import com.froggyriia.shiftplanner.domain.model.AppSchedule
import com.froggyriia.shiftplanner.domain.model.AppScheduledShift
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.util.Calendar

data class EmployeeNotificationsUiState(
    /** Latest published schedule covering the employee (null when nothing is published). */
    val publishedSchedule: AppSchedule? = null,
    /** The employee's own upcoming shifts (today onward), sorted by date. */
    val upcomingShifts: List<AppScheduledShift> = emptyList(),
    /** The employee's own time-off requests and their approval status. */
    val absences: List<AppAbsence> = emptyList(),
    /** Company the employee belongs to — a join was approved when non-null. */
    val companyName: String? = null,
    val isLoading: Boolean = false,
    val errorMessage: String? = null
)

/**
 * Aggregates everything an employee should be notified about, derived from the
 * existing endpoints (there is no server-side notification store): a freshly
 * published schedule, shifts assigned to them, the status of their time-off
 * requests, and confirmation that their company membership is active.
 */
class EmployeeNotificationsViewModel(
    private val scheduleRepository: ScheduleRepository,
    private val absenceRepository: AbsenceRepository,
    private val companyName: String?
) : ViewModel() {

    private val _uiState = MutableStateFlow(EmployeeNotificationsUiState(companyName = companyName))
    val uiState: StateFlow<EmployeeNotificationsUiState> = _uiState.asStateFlow()

    init { load() }

    fun load() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            val published = runCatching { scheduleRepository.fetchLatestSchedule("published") }.getOrNull()
            val myShifts = runCatching { scheduleRepository.fetchMySchedule() }.getOrDefault(emptyList())
            val absences = runCatching { absenceRepository.fetchMyAbsences() }.getOrDefault(emptyList())

            val startOfToday = Calendar.getInstance().apply {
                set(Calendar.HOUR_OF_DAY, 0)
                set(Calendar.MINUTE, 0)
                set(Calendar.SECOND, 0)
                set(Calendar.MILLISECOND, 0)
            }.time

            _uiState.value = _uiState.value.copy(
                publishedSchedule = published,
                upcomingShifts = myShifts
                    .filter { !it.date.before(startOfToday) }
                    .sortedWith(compareBy<AppScheduledShift> { it.date }.thenBy { it.startMinutes }),
                absences = absences.sortedByDescending { it.startDate },
                companyName = companyName,
                isLoading = false
            )
        }
    }

}
