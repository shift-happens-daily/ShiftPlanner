package com.froggyriia.shiftplanner.presentation.employee.schedule

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.froggyriia.shiftplanner.data.schedule.ScheduleRepository
import com.froggyriia.shiftplanner.domain.model.AppScheduledShift
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

data class MyScheduleUiState(
    val shifts: List<AppScheduledShift> = emptyList(),
    val weekDates: List<String> = emptyList(),
    val weekLabel: String = "",
    val isLoading: Boolean = false,
    val errorMessage: String? = null
)

class MyScheduleViewModel(
    private val repository: ScheduleRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(MyScheduleUiState())
    val uiState: StateFlow<MyScheduleUiState> = _uiState.asStateFlow()

    private var weekOffset = 0
    private val dateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.US)
    private val displayFormat = SimpleDateFormat("MMM d", Locale.US)

    init {
        refreshWeek()
        loadMySchedule()
    }

    fun previousWeek() { weekOffset--; refreshWeek() }
    fun nextWeek() { weekOffset++; refreshWeek() }

    fun loadMySchedule() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            try {
                // Wide window (±92 days) so past weeks and month navigation show
                // shifts from OLDER published schedules too — /schedule/my alone
                // only returns the latest schedule (backend retention is 3 months).
                val cal = Calendar.getInstance()
                cal.add(Calendar.DAY_OF_YEAR, -92)
                val start = dateFormat.format(cal.time)
                cal.add(Calendar.DAY_OF_YEAR, 184)
                val end = dateFormat.format(cal.time)
                val shifts = repository.fetchMySchedule(startDate = start, endDate = end)
                _uiState.value = _uiState.value.copy(shifts = shifts, isLoading = false)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isLoading = false, errorMessage = e.message)
            }
        }
    }

    fun shiftsForDate(date: String): List<AppScheduledShift> {
        val target = dateFormat.parse(date) ?: return emptyList()
        return _uiState.value.shifts
            .filter { isSameDay(it.date, target) }
            .sortedBy { it.startMinutes }
    }

    private fun refreshWeek() {
        val dates = weekDates(weekOffset)
        val label = "${displayFormat.format(dateFormat.parse(dates.first())!!)} – " +
                    "${displayFormat.format(dateFormat.parse(dates.last())!!)}"
        _uiState.value = _uiState.value.copy(weekDates = dates, weekLabel = label)
    }

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
}
