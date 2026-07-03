package com.froggyriia.shiftplanner.presentation.manager.schedule

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.froggyriia.shiftplanner.data.requirements.RequirementsRepository
import com.froggyriia.shiftplanner.data.schedule.ScheduleRepository
import com.froggyriia.shiftplanner.domain.model.AppAvailableEmployee
import com.froggyriia.shiftplanner.domain.model.AppSchedule
import com.froggyriia.shiftplanner.domain.model.AppScheduleStatus
import com.froggyriia.shiftplanner.domain.model.AppScheduledShift
import com.froggyriia.shiftplanner.domain.model.AppUnfilledRequirement
import com.froggyriia.shiftplanner.domain.model.RequirementPositionOption
import com.froggyriia.shiftplanner.domain.model.ScheduleShiftMutation
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

// ── View mode / filter ────────────────────────────────────────────────────────

enum class ScheduleViewMode { LIST, CALENDAR }
enum class ShiftFilter { ALL, FILLED, UNFILLED }

// ── Draft models ──────────────────────────────────────────────────────────────

data class ShiftDraft(
    val shiftId: Int? = null,
    val date: String = "",
    val positionId: Int? = null,
    val startMinutes: Int = 8 * 60,
    val endMinutes: Int = 16 * 60
)

data class UnfilledReqDraft(
    val requirementId: Int,
    val date: String,
    val positionId: Int,
    val startMinutes: Int,
    val endMinutes: Int,
    val quantity: Int
)

// ── UI state ──────────────────────────────────────────────────────────────────

data class ScheduleUiState(
    val schedule: AppSchedule? = null,
    val positions: List<RequirementPositionOption> = emptyList(),
    val weekDates: List<String> = emptyList(),
    val weekLabel: String = "",
    val viewMode: ScheduleViewMode = ScheduleViewMode.LIST,
    val shiftFilter: ShiftFilter = ShiftFilter.ALL,
    val isLoading: Boolean = false,
    val isGenerating: Boolean = false,
    val isPublishing: Boolean = false,
    val errorMessage: String? = null,
    val statusMessage: String? = null,
    val availableEmployees: List<AppAvailableEmployee> = emptyList(),
    val loadingEmployees: Boolean = false
)

// ── ViewModel ─────────────────────────────────────────────────────────────────

class ScheduleViewModel(
    private val repository: ScheduleRepository,
    private val requirementsRepository: RequirementsRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(ScheduleUiState())
    val uiState: StateFlow<ScheduleUiState> = _uiState.asStateFlow()

    private var weekOffset = 0
    private val dateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.US)
    private val displayFormat = SimpleDateFormat("MMM d", Locale.US)

    init {
        refreshWeek()
        viewModelScope.launch {
            launch {
                runCatching { requirementsRepository.fetchPositions() }
                    .getOrNull()
                    ?.let { _uiState.value = _uiState.value.copy(positions = it) }
            }
            loadLatestSchedule()
        }
    }

    // ── View mode / filter ────────────────────────────────────────────────────

    fun setViewMode(mode: ScheduleViewMode) {
        _uiState.value = _uiState.value.copy(viewMode = mode)
    }

    fun setFilter(filter: ShiftFilter) {
        _uiState.value = _uiState.value.copy(shiftFilter = filter)
    }

    // ── Schedule lifecycle ────────────────────────────────────────────────────

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

    // ── Shift CRUD ────────────────────────────────────────────────────────────

    fun createShift(draft: ShiftDraft, onDone: (Boolean) -> Unit) {
        val schedId = _uiState.value.schedule?.id ?: return
        val posId = draft.positionId ?: run {
            _uiState.value = _uiState.value.copy(errorMessage = "Select a position.")
            onDone(false); return
        }
        if (draft.endMinutes <= draft.startMinutes) {
            _uiState.value = _uiState.value.copy(errorMessage = "End time must be after start time.")
            onDone(false); return
        }
        viewModelScope.launch {
            try {
                val parsedDate = dateFormat.parse(draft.date) ?: Date()
                val updated = repository.createShift(
                    scheduleId = schedId,
                    mutation = ScheduleShiftMutation(
                        date = parsedDate,
                        startMinutes = draft.startMinutes,
                        endMinutes = draft.endMinutes,
                        positionId = posId,
                        employeeId = null
                    )
                )
                _uiState.value = _uiState.value.copy(
                    schedule = updated, statusMessage = "Shift created.", errorMessage = null
                )
                onDone(true)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(errorMessage = e.message)
                onDone(false)
            }
        }
    }

    fun updateShift(draft: ShiftDraft, onDone: (Boolean) -> Unit) {
        val schedId = _uiState.value.schedule?.id ?: return
        val shiftId = draft.shiftId ?: return
        val posId = draft.positionId ?: run {
            _uiState.value = _uiState.value.copy(errorMessage = "Select a position.")
            onDone(false); return
        }
        if (draft.endMinutes <= draft.startMinutes) {
            _uiState.value = _uiState.value.copy(errorMessage = "End time must be after start time.")
            onDone(false); return
        }
        viewModelScope.launch {
            try {
                val parsedDate = dateFormat.parse(draft.date) ?: Date()
                val existing = _uiState.value.schedule?.shifts?.firstOrNull { it.id == shiftId }
                val updated = repository.updateShift(
                    scheduleId = schedId,
                    shiftId = shiftId,
                    mutation = ScheduleShiftMutation(
                        date = parsedDate,
                        startMinutes = draft.startMinutes,
                        endMinutes = draft.endMinutes,
                        positionId = posId,
                        employeeId = existing?.employeeId
                    )
                )
                _uiState.value = _uiState.value.copy(
                    schedule = updated, statusMessage = "Shift updated.", errorMessage = null
                )
                onDone(true)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(errorMessage = e.message)
                onDone(false)
            }
        }
    }

    fun deleteShift(shift: AppScheduledShift) {
        val schedId = _uiState.value.schedule?.id ?: return
        viewModelScope.launch {
            try {
                val updated = repository.deleteShift(schedId, shift.id)
                _uiState.value = _uiState.value.copy(schedule = updated, statusMessage = "Shift removed.")
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(errorMessage = e.message)
            }
        }
    }

    // ── Unfilled requirement CRUD ─────────────────────────────────────────────

    fun updateScheduleRequirement(draft: UnfilledReqDraft, onDone: (Boolean) -> Unit) {
        val schedId = _uiState.value.schedule?.id ?: return
        if (draft.endMinutes <= draft.startMinutes) {
            _uiState.value = _uiState.value.copy(errorMessage = "End time must be after start time.")
            onDone(false); return
        }
        viewModelScope.launch {
            try {
                val parsedDate = dateFormat.parse(draft.date) ?: Date()
                val updated = repository.updateScheduleRequirement(
                    scheduleId = schedId,
                    requirementId = draft.requirementId,
                    mutation = ScheduleShiftMutation(
                        date = parsedDate,
                        startMinutes = draft.startMinutes,
                        endMinutes = draft.endMinutes,
                        positionId = draft.positionId,
                        employeeId = null
                    ),
                    quantity = draft.quantity
                )
                _uiState.value = _uiState.value.copy(
                    schedule = updated, statusMessage = "Requirement updated.", errorMessage = null
                )
                onDone(true)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(errorMessage = e.message)
                onDone(false)
            }
        }
    }

    // ── Employee assignment ───────────────────────────────────────────────────

    fun fetchAvailableEmployees(shift: AppScheduledShift) {
        val schedId = _uiState.value.schedule?.id ?: return
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(loadingEmployees = true)
            try {
                val employees = repository.fetchAvailableEmployees(schedId, shift, null, includeUnavailable = true)
                _uiState.value = _uiState.value.copy(availableEmployees = employees, loadingEmployees = false)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(loadingEmployees = false, errorMessage = e.message)
            }
        }
    }

    fun fetchAvailableForRequirement(req: AppUnfilledRequirement) {
        val schedId = _uiState.value.schedule?.id ?: return
        val fakeShift = AppScheduledShift(
            id = req.id, employeeId = null, employeeName = null,
            positionId = req.positionId, positionName = req.positionTitle,
            date = req.date, startMinutes = req.startMinutes, endMinutes = req.endMinutes
        )
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(loadingEmployees = true)
            try {
                val employees = repository.fetchAvailableEmployees(schedId, fakeShift, null, includeUnavailable = true)
                _uiState.value = _uiState.value.copy(availableEmployees = employees, loadingEmployees = false)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(loadingEmployees = false, errorMessage = e.message)
            }
        }
    }

    fun assignShift(shiftId: Int, employeeId: Int) {
        val schedId = _uiState.value.schedule?.id ?: return
        val existing = _uiState.value.schedule?.shifts?.firstOrNull { it.id == shiftId } ?: return
        viewModelScope.launch {
            try {
                val updated = repository.updateShift(
                    scheduleId = schedId,
                    shiftId = shiftId,
                    mutation = ScheduleShiftMutation(
                        date = existing.date,
                        startMinutes = existing.startMinutes,
                        endMinutes = existing.endMinutes,
                        positionId = existing.positionId,
                        employeeId = employeeId
                    )
                )
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

    // ── Filtered helpers ──────────────────────────────────────────────────────

    fun shiftsForDate(date: String): List<AppScheduledShift> {
        val target = dateFormat.parse(date) ?: return emptyList()
        val filter = _uiState.value.shiftFilter
        return _uiState.value.schedule?.shifts
            ?.filter { isSameDay(it.date, target) }
            ?.filter { shift ->
                when (filter) {
                    ShiftFilter.ALL -> true
                    ShiftFilter.FILLED -> shift.hasAssignedEmployee
                    ShiftFilter.UNFILLED -> !shift.hasAssignedEmployee
                }
            }
            ?.sortedBy { it.startMinutes }
            ?: emptyList()
    }

    fun unfilledForDate(date: String): List<AppUnfilledRequirement> {
        val target = dateFormat.parse(date) ?: return emptyList()
        // Unfilled reqs only shown in ALL or UNFILLED filter
        if (_uiState.value.shiftFilter == ShiftFilter.FILLED) return emptyList()
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
        val daysToMon = (cal.get(Calendar.DAY_OF_WEEK) - Calendar.MONDAY + 7) % 7
        cal.add(Calendar.DAY_OF_YEAR, -daysToMon + offset * 7)
        return (0..6).map { i ->
            val c = cal.clone() as Calendar
            c.add(Calendar.DAY_OF_YEAR, i)
            "%04d-%02d-%02d".format(c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH))
        }
    }

    private fun todayString(): String {
        val cal = Calendar.getInstance()
        return "%04d-%02d-%02d".format(cal.get(Calendar.YEAR), cal.get(Calendar.MONTH) + 1, cal.get(Calendar.DAY_OF_MONTH))
    }

    companion object {
        fun minutesToDisplay(minutes: Int): String = "%02d:%02d".format(minutes / 60, minutes % 60)

        val minuteOptions: List<Pair<Int, String>> = (0..47).map { slot ->
            val m = slot * 30
            m to "%02d:%02d".format(m / 60, m % 60)
        }
    }
}
