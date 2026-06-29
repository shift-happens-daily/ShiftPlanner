package com.froggyriia.shiftplanner.presentation.manager.schedule

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.froggyriia.shiftplanner.data.schedule.ScheduleRepository
import com.froggyriia.shiftplanner.domain.model.AppAvailableEmployee
import com.froggyriia.shiftplanner.domain.model.AppSchedule
import com.froggyriia.shiftplanner.domain.model.AppScheduleStatus
import com.froggyriia.shiftplanner.domain.model.AppScheduledShift
import com.froggyriia.shiftplanner.domain.model.AppUnfilledRequirement
import com.froggyriia.shiftplanner.domain.model.ScheduleShiftMutation
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

data class ScheduleUiState(
    val schedule: AppSchedule? = null,
    val weekDates: List<String> = emptyList(),
    val weekLabel: String = "",
    val isLoading: Boolean = false,
    val isGenerating: Boolean = false,
    val isPublishing: Boolean = false,
    val errorMessage: String? = null,
    val statusMessage: String? = null,
    val availableEmployees: List<AppAvailableEmployee> = emptyList(),
    val loadingEmployees: Boolean = false
)

class ScheduleViewModel(
    private val repository: ScheduleRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(ScheduleUiState())
    val uiState: StateFlow<ScheduleUiState> = _uiState.asStateFlow()

    private var weekOffset = 0
    private val dateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.US)
    private val displayFormat = SimpleDateFormat("MMM d", Locale.US)

    init {
        refreshWeek()
        loadLatestSchedule()
    }

    fun loadLatestSchedule() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            try {
                val schedule = repository.fetchLatestSchedule()
                _uiState.value = _uiState.value.copy(schedule = schedule, isLoading = false)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isLoading = false, errorMessage = e.message)
            }
        }
    }

    fun generateSchedule(startDate: String, endDate: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isGenerating = true, errorMessage = null)
            try {
                val schedule = repository.generateSchedule(startDate, endDate)
                _uiState.value = _uiState.value.copy(
                    schedule = schedule,
                    isGenerating = false,
                    statusMessage = "Schedule generated."
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isGenerating = false, errorMessage = e.message)
            }
        }
    }

    fun publishSchedule() {
        val id = _uiState.value.schedule?.id ?: return
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isPublishing = true, errorMessage = null)
            try {
                val published = repository.publishSchedule(id)
                _uiState.value = _uiState.value.copy(
                    schedule = published,
                    isPublishing = false,
                    statusMessage = "Schedule published!"
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isPublishing = false, errorMessage = e.message)
            }
        }
    }

    fun deleteShift(shift: AppScheduledShift) {
        val schedId = _uiState.value.schedule?.id ?: return
        viewModelScope.launch {
            try {
                val updated = repository.deleteShift(schedId, shift.id)
                _uiState.value = _uiState.value.copy(
                    schedule = updated,
                    statusMessage = "Shift removed."
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(errorMessage = e.message)
            }
        }
    }

    fun fetchAvailableEmployees(shift: AppScheduledShift) {
        val schedId = _uiState.value.schedule?.id ?: return
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(loadingEmployees = true)
            try {
                val employees = repository.fetchAvailableEmployees(schedId, shift, null)
                _uiState.value = _uiState.value.copy(
                    availableEmployees = employees,
                    loadingEmployees = false
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    loadingEmployees = false,
                    errorMessage = e.message
                )
            }
        }
    }

    fun fetchAvailableForRequirement(req: AppUnfilledRequirement) {
        val schedId = _uiState.value.schedule?.id ?: return
        // Fake a shift to reuse the same endpoint
        val fakeShift = AppScheduledShift(
            id = req.id,
            employeeId = null,
            employeeName = null,
            positionId = req.positionId,
            positionName = req.positionTitle,
            date = req.date,
            startMinutes = req.startMinutes,
            endMinutes = req.endMinutes
        )
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(loadingEmployees = true)
            try {
                val employees = repository.fetchAvailableEmployees(schedId, fakeShift, null)
                _uiState.value = _uiState.value.copy(
                    availableEmployees = employees,
                    loadingEmployees = false
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    loadingEmployees = false,
                    errorMessage = e.message
                )
            }
        }
    }

    fun assignRequirement(requirementId: Int, employeeId: Int) {
        val schedId = _uiState.value.schedule?.id ?: return
        viewModelScope.launch {
            try {
                val updated = repository.assignRequirement(schedId, requirementId, employeeId)
                _uiState.value = _uiState.value.copy(
                    schedule = updated,
                    availableEmployees = emptyList(),
                    statusMessage = "Employee assigned."
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(errorMessage = e.message)
            }
        }
    }

    fun clearAvailableEmployees() {
        _uiState.value = _uiState.value.copy(availableEmployees = emptyList())
    }

    fun clearMessages() {
        _uiState.value = _uiState.value.copy(errorMessage = null, statusMessage = null)
    }

    // ── Week navigation ───────────────────────────────────────────────────────

    fun previousWeek() { weekOffset--; refreshWeek() }
    fun nextWeek() { weekOffset++; refreshWeek() }

    private fun refreshWeek() {
        val dates = weekDates(weekOffset)
        val label = "${displayFormat.format(dateFormat.parse(dates.first())!!)} – " +
                    "${displayFormat.format(dateFormat.parse(dates.last())!!)}"
        _uiState.value = _uiState.value.copy(weekDates = dates, weekLabel = label)
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    fun shiftsForDate(date: String): List<AppScheduledShift> {
        val target = dateFormat.parse(date) ?: return emptyList()
        return _uiState.value.schedule?.shifts
            ?.filter { isSameDay(it.date, target) }
            ?.sortedBy { it.startMinutes }
            ?: emptyList()
    }

    fun unfilledForDate(date: String): List<AppUnfilledRequirement> {
        val target = dateFormat.parse(date) ?: return emptyList()
        return _uiState.value.schedule?.unfilledRequirements
            ?.filter { isSameDay(it.date, target) }
            ?.sortedBy { it.startMinutes }
            ?: emptyList()
    }

    fun currentWeekStart(): String = _uiState.value.weekDates.firstOrNull() ?: todayString()
    fun currentWeekEnd(): String = _uiState.value.weekDates.lastOrNull() ?: todayString()

    private fun isSameDay(a: Date, b: Date): Boolean {
        val ca = Calendar.getInstance().apply { time = a }
        val cb = Calendar.getInstance().apply { time = b }
        return ca.get(Calendar.YEAR) == cb.get(Calendar.YEAR) &&
               ca.get(Calendar.DAY_OF_YEAR) == cb.get(Calendar.DAY_OF_YEAR)
    }

    private fun weekDates(offset: Int): List<String> {
        val cal = Calendar.getInstance()
        val dow = cal.get(Calendar.DAY_OF_WEEK)
        val daysToMon = (dow - Calendar.MONDAY + 7) % 7
        cal.add(Calendar.DAY_OF_YEAR, -daysToMon + offset * 7)
        return (0..6).map { i ->
            val c = cal.clone() as Calendar
            c.add(Calendar.DAY_OF_YEAR, i)
            "%04d-%02d-%02d".format(
                c.get(Calendar.YEAR),
                c.get(Calendar.MONTH) + 1,
                c.get(Calendar.DAY_OF_MONTH)
            )
        }
    }

    private fun todayString(): String {
        val cal = Calendar.getInstance()
        return "%04d-%02d-%02d".format(
            cal.get(Calendar.YEAR),
            cal.get(Calendar.MONTH) + 1,
            cal.get(Calendar.DAY_OF_MONTH)
        )
    }

    companion object {
        fun minutesToDisplay(minutes: Int): String =
            "%02d:%02d".format(minutes / 60, minutes % 60)
    }
}
