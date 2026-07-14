package com.froggyriia.shiftplanner.presentation.employee.reports

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.froggyriia.shiftplanner.data.reports.ReportsRepository
import com.froggyriia.shiftplanner.domain.model.MySelfReport
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.util.Calendar

data class MyReportUiState(
    val report: MySelfReport? = null,
    val startDate: String = "",
    val endDate: String = "",
    val isLoading: Boolean = false,
    val errorMessage: String? = null
)

class MyReportViewModel(
    private val repository: ReportsRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(MyReportUiState())
    val uiState: StateFlow<MyReportUiState> = _uiState.asStateFlow()

    init {
        setCurrentMonth()
    }

    fun setPeriod(startDate: String, endDate: String) {
        _uiState.value = _uiState.value.copy(startDate = startDate, endDate = endDate)
        load()
    }

    fun setCurrentWeek() {
        val cal = Calendar.getInstance()
        val back = (cal.get(Calendar.DAY_OF_WEEK) - Calendar.MONDAY + 7) % 7
        cal.add(Calendar.DAY_OF_YEAR, -back)
        val start = fmt(cal)
        cal.add(Calendar.DAY_OF_YEAR, 6)
        setPeriod(start, fmt(cal))
    }

    fun setCurrentMonth() {
        val cal = Calendar.getInstance()
        cal.set(Calendar.DAY_OF_MONTH, 1)
        val start = fmt(cal)
        cal.set(Calendar.DAY_OF_MONTH, cal.getActualMaximum(Calendar.DAY_OF_MONTH))
        setPeriod(start, fmt(cal))
    }

    fun load() {
        val start = _uiState.value.startDate.takeIf { it.isNotBlank() }
        val end = _uiState.value.endDate.takeIf { it.isNotBlank() }
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            try {
                val report = repository.fetchMyReport(start, end)
                _uiState.value = _uiState.value.copy(report = report, isLoading = false)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isLoading = false, errorMessage = e.message)
            }
        }
    }

    fun clearMessages() {
        _uiState.value = _uiState.value.copy(errorMessage = null)
    }

    private fun fmt(cal: Calendar): String = "%04d-%02d-%02d".format(
        cal.get(Calendar.YEAR),
        cal.get(Calendar.MONTH) + 1,
        cal.get(Calendar.DAY_OF_MONTH)
    )
}
