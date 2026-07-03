package com.froggyriia.shiftplanner.presentation.manager.requirements

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.froggyriia.shiftplanner.data.requirements.RequirementsRepository
import com.froggyriia.shiftplanner.domain.model.RequirementOccurrence
import com.froggyriia.shiftplanner.domain.model.RequirementPositionOption
import com.froggyriia.shiftplanner.domain.model.RequirementTemplateDraft
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

data class RequirementsUiState(
    val weekDates: List<String> = emptyList(),          // 7 ISO date strings, Mon..Sun
    val weekLabel: String = "",
    val requirements: List<RequirementOccurrence> = emptyList(),
    val positions: List<RequirementPositionOption> = emptyList(),
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
    val statusMessage: String? = null
)

data class RequirementDraft(
    val id: Int? = null,                // null = creating new
    val date: String = "",
    val positionId: Int? = null,
    val branchId: Int? = null,
    val quantity: Int = 1,
    val startSlot: Int = 16,            // 08:00
    val endSlot: Int = 32              // 16:00
)

class RequirementsViewModel(
    private val repository: RequirementsRepository,
    private val companyId: Int?
) : ViewModel() {

    private val _uiState = MutableStateFlow(RequirementsUiState())
    val uiState: StateFlow<RequirementsUiState> = _uiState.asStateFlow()

    private var weekOffset = 0
    private val dateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.US)
    private val displayFormat = SimpleDateFormat("MMM d", Locale.US)

    init {
        viewModelScope.launch {
            try {
                val positions = repository.fetchPositions()
                _uiState.value = _uiState.value.copy(positions = positions)
            } catch (e: Exception) { /* non-fatal */ }
            loadWeek()
        }
    }

    fun previousWeek() { weekOffset--; loadWeek() }
    fun nextWeek() { weekOffset++; loadWeek() }

    fun loadWeek(force: Boolean = false) {
        val dates = weekDates(weekOffset)
        val label = "${displayFormat.format(dateFormat.parse(dates.first())!!)} – ${displayFormat.format(dateFormat.parse(dates.last())!!)}"
        _uiState.value = _uiState.value.copy(
            weekDates = dates,
            weekLabel = label,
            isLoading = true,
            errorMessage = null
        )
        viewModelScope.launch {
            try {
                val reqs = repository.fetchRequirements(
                    startDate = dates.first(),
                    endDate = dates.last()
                )
                _uiState.value = _uiState.value.copy(requirements = reqs, isLoading = false)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isLoading = false, errorMessage = e.message)
            }
        }
    }

    fun createRequirement(draft: RequirementDraft, onDone: (Boolean) -> Unit) {
        val posId = draft.positionId ?: run {
            _uiState.value = _uiState.value.copy(errorMessage = "Select a position")
            onDone(false); return
        }
        viewModelScope.launch {
            try {
                val created = repository.createRequirement(
                    date = draft.date,
                    branchId = draft.branchId,
                    positionId = posId,
                    quantity = draft.quantity,
                    startSlot = draft.startSlot,
                    endSlot = draft.endSlot
                )
                val updated = (_uiState.value.requirements + created)
                    .sortedWith(compareBy({ it.date }, { it.startSlot }))
                _uiState.value = _uiState.value.copy(
                    requirements = updated,
                    statusMessage = "Requirement added.",
                    errorMessage = null
                )
                onDone(true)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(errorMessage = e.message)
                onDone(false)
            }
        }
    }

    fun updateRequirement(draft: RequirementDraft, onDone: (Boolean) -> Unit) {
        val id = draft.id ?: return
        val posId = draft.positionId ?: run {
            _uiState.value = _uiState.value.copy(errorMessage = "Select a position")
            onDone(false); return
        }
        viewModelScope.launch {
            try {
                val updated = repository.updateRequirement(
                    id = id,
                    date = draft.date,
                    branchId = draft.branchId,
                    positionId = posId,
                    quantity = draft.quantity,
                    startSlot = draft.startSlot,
                    endSlot = draft.endSlot
                )
                val list = _uiState.value.requirements.map { if (it.id == id) updated else it }
                    .sortedWith(compareBy({ it.date }, { it.startSlot }))
                _uiState.value = _uiState.value.copy(
                    requirements = list,
                    statusMessage = "Requirement updated.",
                    errorMessage = null
                )
                onDone(true)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(errorMessage = e.message)
                onDone(false)
            }
        }
    }

    fun deleteRequirement(req: RequirementOccurrence) {
        viewModelScope.launch {
            try {
                repository.deleteRequirement(req.id)
                val list = _uiState.value.requirements.filter { it.id != req.id }
                _uiState.value = _uiState.value.copy(
                    requirements = list,
                    statusMessage = "Requirement removed.",
                    errorMessage = null
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(errorMessage = e.message)
            }
        }
    }

    fun createBulk(
        startDate: String,
        endDate: String,
        weekdays: List<Int>,
        templates: List<RequirementTemplateDraft>,
        onDone: (Boolean) -> Unit
    ) {
        if (startDate.isBlank() || endDate.isBlank()) {
            _uiState.value = _uiState.value.copy(errorMessage = "Start and end dates are required.")
            onDone(false); return
        }
        if (weekdays.isEmpty()) {
            _uiState.value = _uiState.value.copy(errorMessage = "Select at least one weekday.")
            onDone(false); return
        }
        val validTemplates = templates.filter { it.positionId > 0 && it.endSlot > it.startSlot }
        if (validTemplates.isEmpty()) {
            _uiState.value = _uiState.value.copy(errorMessage = "Add at least one complete requirement template.")
            onDone(false); return
        }
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            try {
                val created = repository.createRequirementsBulk(startDate, endDate, weekdays, validTemplates)
                val merged = (_uiState.value.requirements + created)
                    .sortedWith(compareBy({ it.date }, { it.startSlot }))
                _uiState.value = _uiState.value.copy(
                    requirements = merged,
                    isLoading = false,
                    statusMessage = "${created.size} requirement(s) created."
                )
                onDone(true)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isLoading = false, errorMessage = e.message)
                onDone(false)
            }
        }
    }

    fun clearMessages() {
        _uiState.value = _uiState.value.copy(errorMessage = null, statusMessage = null)
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    fun requirementsForDate(date: String): List<RequirementOccurrence> =
        _uiState.value.requirements.filter { dateFormat.format(it.date) == date }

    fun positionName(positionId: Int): String =
        _uiState.value.positions.firstOrNull { it.id == positionId }?.name ?: "Unknown"

    companion object {
        fun slotToDisplayTime(slot: Int): String =
            "%02d:%02d".format(slot / 2, (slot % 2) * 30)

        val timeSlots: List<Pair<Int, String>> = (0..47).map { slot ->
            slot to "%02d:%02d".format(slot / 2, (slot % 2) * 30)
        }
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
