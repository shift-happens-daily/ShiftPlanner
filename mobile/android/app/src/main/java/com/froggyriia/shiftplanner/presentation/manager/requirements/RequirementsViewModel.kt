package com.froggyriia.shiftplanner.presentation.manager.requirements

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.froggyriia.shiftplanner.data.company.CompanyRepository
import com.froggyriia.shiftplanner.data.requirements.RequirementsRepository
import com.froggyriia.shiftplanner.domain.model.AppBranchOption
import com.froggyriia.shiftplanner.domain.model.RequirementsImportResult
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
import java.util.TimeZone
import com.froggyriia.shiftplanner.R

data class RequirementsUiState(
    val requirements: List<RequirementOccurrence> = emptyList(),
    val positions: List<RequirementPositionOption> = emptyList(),
    val branches: List<AppBranchOption> = emptyList(),
    val filterStartDate: String = "",
    val filterEndDate: String = "",
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
    val statusMessage: String? = null,
    val errorMessageRes: Int? = null,
    val statusMessageRes: Int? = null,
    val statusMessageArgs: List<Any> = emptyList(),
    val importResult: RequirementsImportResult? = null
)

data class RequirementDraft(
    val id: Int? = null,
    val date: String = "",
    val positionId: Int? = null,
    val branchId: Int? = null,
    val quantity: Int = 1,
    val startSlot: Int = 18,   // 09:00
    val endSlot: Int = 36      // 18:00
)

class RequirementsViewModel(
    private val repository: RequirementsRepository,
    private val companyRepository: CompanyRepository,
    private val companyId: Int?
) : ViewModel() {

    private val _uiState = MutableStateFlow(RequirementsUiState())
    val uiState: StateFlow<RequirementsUiState> = _uiState.asStateFlow()

    init {
        val today = todayString()
        val end = daysLaterString(30)
        _uiState.value = _uiState.value.copy(filterStartDate = today, filterEndDate = end)
        viewModelScope.launch {
            try {
                val positions = repository.fetchPositions()
                _uiState.value = _uiState.value.copy(positions = positions)
            } catch (_: Exception) {}
            try {
                val branches = companyRepository.fetchBranches()
                _uiState.value = _uiState.value.copy(branches = branches)
            } catch (_: Exception) {}
            loadFiltered(today, end)
        }
    }

    /** Positions/branches can change in other tabs — refresh them on tab visit. */
    fun reloadDictionaries() {
        viewModelScope.launch {
            runCatching { repository.fetchPositions() }.getOrNull()?.let {
                _uiState.value = _uiState.value.copy(positions = it)
            }
            runCatching { companyRepository.fetchBranches() }.getOrNull()?.let {
                _uiState.value = _uiState.value.copy(branches = it)
            }
        }
    }

    fun importXlsx(fileBytes: ByteArray, fileName: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            try {
                val result = repository.importRequirementsXlsx(fileBytes, fileName)
                _uiState.value = _uiState.value.copy(isLoading = false, importResult = result)
                loadFiltered()
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isLoading = false, errorMessage = e.message)
            }
        }
    }

    fun clearImportResult() {
        _uiState.value = _uiState.value.copy(importResult = null)
    }

    fun loadFiltered(
        startDate: String = _uiState.value.filterStartDate,
        endDate: String = _uiState.value.filterEndDate
    ) {
        if (startDate.isBlank() || endDate.isBlank()) return
        _uiState.value = _uiState.value.copy(
            filterStartDate = startDate,
            filterEndDate = endDate,
            isLoading = true,
            errorMessage = null
        )
        viewModelScope.launch {
            try {
                val reqs = repository.fetchRequirements(startDate, endDate)
                _uiState.value = _uiState.value.copy(requirements = reqs, isLoading = false)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isLoading = false, errorMessage = e.message)
            }
        }
    }

    fun updateFilterStart(date: String) { _uiState.value = _uiState.value.copy(filterStartDate = date) }
    fun updateFilterEnd(date: String)   { _uiState.value = _uiState.value.copy(filterEndDate = date) }

    fun resetFilters() { loadFiltered(todayString(), daysLaterString(30)) }

    fun createRequirement(draft: RequirementDraft, onDone: (Boolean) -> Unit) {
        val posId = draft.positionId ?: run {
            _uiState.value = _uiState.value.copy(errorMessageRes = R.string.req_err_position)
            onDone(false); return
        }
        if (draft.date.isBlank()) {
            _uiState.value = _uiState.value.copy(errorMessageRes = R.string.req_err_date)
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
                    statusMessageRes = R.string.req_msg_created,
                    errorMessage = null
                )
                onDone(true)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(errorMessage = e.message)
                onDone(false)
            }
        }
    }

    fun createBulk(
        startDate: String,
        endDate: String,
        weekdays: List<Int>,
        positionId: Int,
        quantity: Int,
        startSlot: Int,
        endSlot: Int,
        onDone: (Boolean) -> Unit
    ) {
        if (startDate.isBlank() || endDate.isBlank()) {
            _uiState.value = _uiState.value.copy(errorMessageRes = R.string.req_err_period)
            onDone(false); return
        }
        if (weekdays.isEmpty()) {
            _uiState.value = _uiState.value.copy(errorMessageRes = R.string.req_err_weekday)
            onDone(false); return
        }
        if (endSlot <= startSlot) {
            _uiState.value = _uiState.value.copy(errorMessageRes = R.string.req_err_time)
            onDone(false); return
        }
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            try {
                val template = RequirementTemplateDraft(
                    positionId = positionId,
                    quantity = quantity,
                    startSlot = startSlot,
                    endSlot = endSlot
                )
                val created = repository.createRequirementsBulk(startDate, endDate, weekdays, listOf(template))
                val merged = (_uiState.value.requirements + created)
                    .sortedWith(compareBy({ it.date }, { it.startSlot }))
                _uiState.value = _uiState.value.copy(
                    requirements = merged,
                    isLoading = false,
                    statusMessageRes = R.string.req_msg_bulk_created,
                    statusMessageArgs = listOf(created.size)
                )
                onDone(true)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isLoading = false, errorMessage = e.message)
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
                    statusMessageRes = R.string.req_msg_deleted,
                    errorMessage = null
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(errorMessage = e.message)
            }
        }
    }

    fun deleteRequirements(ids: List<Int>) {
        viewModelScope.launch {
            var deleted = 0
            ids.forEach { id ->
                runCatching { repository.deleteRequirement(id) }.onSuccess { deleted++ }
            }
            val remaining = _uiState.value.requirements.filter { it.id !in ids }
            _uiState.value = _uiState.value.copy(
                requirements = remaining,
                statusMessageRes = R.string.req_msg_deleted_n,
                statusMessageArgs = listOf(deleted),
                errorMessage = null
            )
        }
    }

    private fun pluralReqs(n: Int) = when {
        n % 10 == 1 && n % 100 != 11 -> "требование"
        n % 10 in 2..4 && n % 100 !in 12..14 -> "требования"
        else -> "требований"
    }

    fun clearMessages() {
        _uiState.value = _uiState.value.copy(
            errorMessage = null, statusMessage = null,
            errorMessageRes = null, statusMessageRes = null, statusMessageArgs = emptyList()
        )
    }

    fun branchName(branchId: Int?): String =
        _uiState.value.branches.firstOrNull { it.id == branchId }?.name ?: ""

    fun positionName(positionId: Int): String =
        _uiState.value.positions.firstOrNull { it.id == positionId }?.name ?: "—"

    companion object {
        fun slotToDisplayTime(slot: Int): String =
            "%02d:%02d".format(slot / 2, (slot % 2) * 30)

        val timeSlots: List<Pair<Int, String>> = (0..47).map { slot ->
            slot to "%02d:%02d".format(slot / 2, (slot % 2) * 30)
        }

        fun millisToDateString(millis: Long): String {
            val cal = Calendar.getInstance(TimeZone.getTimeZone("UTC"))
            cal.timeInMillis = millis
            return "%04d-%02d-%02d".format(
                cal.get(Calendar.YEAR),
                cal.get(Calendar.MONTH) + 1,
                cal.get(Calendar.DAY_OF_MONTH)
            )
        }

        fun dateStringToMillis(dateStr: String): Long? = runCatching {
            val fmt = SimpleDateFormat("yyyy-MM-dd", Locale.US)
            fmt.timeZone = TimeZone.getTimeZone("UTC")
            fmt.parse(dateStr)?.time
        }.getOrNull()

        private fun todayString(): String {
            val cal = Calendar.getInstance()
            return "%04d-%02d-%02d".format(
                cal.get(Calendar.YEAR), cal.get(Calendar.MONTH) + 1, cal.get(Calendar.DAY_OF_MONTH)
            )
        }

        private fun daysLaterString(days: Int): String {
            val cal = Calendar.getInstance()
            cal.add(Calendar.DAY_OF_YEAR, days)
            return "%04d-%02d-%02d".format(
                cal.get(Calendar.YEAR), cal.get(Calendar.MONTH) + 1, cal.get(Calendar.DAY_OF_MONTH)
            )
        }
    }

    private fun todayString() = Companion.todayString()
    private fun daysLaterString(days: Int) = Companion.daysLaterString(days)
}
