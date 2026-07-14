package com.froggyriia.shiftplanner.presentation.employee.absence

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.froggyriia.shiftplanner.data.absence.AbsenceRepository
import com.froggyriia.shiftplanner.domain.model.AppAbsence
import com.froggyriia.shiftplanner.domain.model.AppAbsenceType
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import com.froggyriia.shiftplanner.R

data class AbsencesUiState(
    val absences: List<AppAbsence> = emptyList(),
    val isLoading: Boolean = false,
    val isSubmitting: Boolean = false,
    val errorMessage: String? = null,
    val statusMessage: String? = null,
    val errorMessageRes: Int? = null,
    val statusMessageRes: Int? = null
)

class AbsencesViewModel(
    private val repository: AbsenceRepository,
    private val employeeId: Int
) : ViewModel() {

    private val _uiState = MutableStateFlow(AbsencesUiState())
    val uiState: StateFlow<AbsencesUiState> = _uiState.asStateFlow()

    init {
        loadAbsences()
    }

    fun loadAbsences() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            try {
                val absences = repository.fetchMyAbsences()
                    .sortedByDescending { it.startDate }
                _uiState.value = _uiState.value.copy(absences = absences, isLoading = false)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isLoading = false, errorMessage = e.message)
            }
        }
    }

    fun createAbsence(
        type: AppAbsenceType,
        startDate: String,
        endDate: String,
        comment: String?,
        onDone: (Boolean) -> Unit
    ) {
        if (startDate.isBlank() || endDate.isBlank()) {
            _uiState.value = _uiState.value.copy(errorMessageRes = R.string.abs_err_dates)
            onDone(false); return
        }
        if (endDate < startDate) {
            _uiState.value = _uiState.value.copy(errorMessageRes = R.string.abs_err_order)
            onDone(false); return
        }
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isSubmitting = true, errorMessage = null)
            try {
                repository.createMyAbsence(
                    type = type,
                    startDate = startDate,
                    endDate = endDate,
                    comment = comment?.takeIf { it.isNotBlank() }
                )
                _uiState.value = _uiState.value.copy(
                    isSubmitting = false,
                    statusMessageRes = R.string.abs_added
                )
                loadAbsences()
                onDone(true)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isSubmitting = false, errorMessage = e.message)
                onDone(false)
            }
        }
    }

    fun deleteAbsence(absence: AppAbsence) {
        viewModelScope.launch {
            try {
                repository.deleteAbsence(employeeId = employeeId, absenceId = absence.id)
                _uiState.value = _uiState.value.copy(
                    absences = _uiState.value.absences.filterNot { it.id == absence.id },
                    statusMessageRes = R.string.abs_deleted
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(errorMessage = e.message)
            }
        }
    }

    fun clearMessages() {
        _uiState.value = _uiState.value.copy(
            errorMessage = null, statusMessage = null,
            errorMessageRes = null, statusMessageRes = null
        )
    }
}
