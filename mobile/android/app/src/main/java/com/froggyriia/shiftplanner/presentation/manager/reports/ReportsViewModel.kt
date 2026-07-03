package com.froggyriia.shiftplanner.presentation.manager.reports

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.froggyriia.shiftplanner.data.reports.ReportsRepository
import com.froggyriia.shiftplanner.domain.model.EmployeeReport
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

data class ReportsUiState(
    val reports: List<EmployeeReport> = emptyList(),
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
    val startDate: String = "",
    val endDate: String = ""
)

class ReportsViewModel(
    private val repository: ReportsRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(ReportsUiState())
    val uiState: StateFlow<ReportsUiState> = _uiState.asStateFlow()

    private val fmt = SimpleDateFormat("yyyy-MM-dd", Locale.US)

    init {
        // Default to current month
        val cal = Calendar.getInstance()
        val endDate = fmt.format(cal.time)
        cal.set(Calendar.DAY_OF_MONTH, 1)
        val startDate = fmt.format(cal.time)
        _uiState.value = _uiState.value.copy(startDate = startDate, endDate = endDate)
        load()
    }

    fun setStartDate(date: String) {
        _uiState.value = _uiState.value.copy(startDate = date)
    }

    fun setEndDate(date: String) {
        _uiState.value = _uiState.value.copy(endDate = date)
    }

    fun load() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            try {
                val state = _uiState.value
                val reports = repository.fetchEmployeeReports(
                    startDate = state.startDate.ifBlank { null },
                    endDate = state.endDate.ifBlank { null }
                )
                _uiState.value = _uiState.value.copy(reports = reports, isLoading = false)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isLoading = false, errorMessage = e.message)
            }
        }
    }

    /** Builds CSV content from current report data. */
    fun buildCsv(): String {
        val sb = StringBuilder()
        sb.appendLine("Employee,Position,Total Shifts,Total Hours")
        _uiState.value.reports.forEach { r ->
            sb.appendLine(
                "${csvEsc(r.fullName)},${csvEsc(r.position)},${r.totalShifts},${"%.1f".format(r.totalHours)}"
            )
        }
        return sb.toString()
    }

    private fun csvEsc(value: String): String =
        if (value.contains(',') || value.contains('"') || value.contains('\n'))
            "\"${value.replace("\"", "\"\"")}\""
        else value
}
