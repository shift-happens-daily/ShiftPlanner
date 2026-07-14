package com.froggyriia.shiftplanner.presentation.manager.company

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.froggyriia.shiftplanner.data.company.CompanyRepository
import com.froggyriia.shiftplanner.domain.model.WorkingHoursRange
import com.froggyriia.shiftplanner.domain.model.AppBranchOption
import com.froggyriia.shiftplanner.domain.model.AppCompany
import com.froggyriia.shiftplanner.domain.model.CompanyBranchDraft
import com.froggyriia.shiftplanner.domain.model.withBranches
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import com.froggyriia.shiftplanner.R

data class CompanyDetailsUiState(
    val company: AppCompany? = null,
    val branches: List<AppBranchOption> = emptyList(),
    val branchDrafts: List<CompanyBranchDraft> = emptyList(),
    val companyName: String = "",
    val companyAddress: String = "",
    val isEditing: Boolean = false,
    val isLoading: Boolean = false,
    val isSaving: Boolean = false,
    val isRegeneratingCode: Boolean = false,
    val errorMessage: String? = null,
    val errorMessageRes: Int? = null,
    val statusMessageRes: Int? = null
) {
    val canSave: Boolean get() = companyName.isNotBlank() && !isSaving
    val showAddressField: Boolean get() = branchDrafts.isEmpty()
}

class CompanyDetailsViewModel(
    private val repository: CompanyRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(CompanyDetailsUiState())
    val uiState: StateFlow<CompanyDetailsUiState> = _uiState.asStateFlow()

    private var hasLoaded = false

    fun loadCompany(forceRefresh: Boolean = false) {
        if (hasLoaded && !forceRefresh) return
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            try {
                val company = repository.fetchMyCompany()
                val branches = try { repository.fetchBranches() } catch (_: Throwable) { emptyList() }
                val full = company.withBranches(branches)
                applyCompany(full, branches)
                hasLoaded = true
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(errorMessage = e.message, isLoading = false)
            }
        }
    }

    fun setInitialCompany(company: AppCompany) {
        if (hasLoaded) return
        applyCompany(company, company.branches)
    }

    fun startEditing() {
        val s = _uiState.value
        _uiState.value = s.copy(isEditing = true, errorMessage = null)
    }

    fun cancelEditing() {
        val company = _uiState.value.company ?: return
        applyCompany(company, _uiState.value.branches)
        _uiState.value = _uiState.value.copy(isEditing = false, errorMessage = null)
    }

    fun onNameChange(value: String) { _uiState.value = _uiState.value.copy(companyName = value) }
    fun onAddressChange(value: String) { _uiState.value = _uiState.value.copy(companyAddress = value) }
    fun clearError() {
        _uiState.value = _uiState.value.copy(errorMessage = null, errorMessageRes = null, statusMessageRes = null)
    }

    fun addBranchDraft() {
        val drafts = _uiState.value.branchDrafts + CompanyBranchDraft()
        _uiState.value = _uiState.value.copy(branchDrafts = drafts)
    }

    fun removeBranchDraft(localId: String) {
        val drafts = _uiState.value.branchDrafts.filter { it.localId != localId }
        _uiState.value = _uiState.value.copy(branchDrafts = drafts)
    }

    fun updateDraftName(localId: String, name: String) {
        val drafts = _uiState.value.branchDrafts.map {
            if (it.localId == localId) it.copy(name = name) else it
        }
        _uiState.value = _uiState.value.copy(branchDrafts = drafts)
    }

    fun updateDraftAddress(localId: String, address: String) {
        val drafts = _uiState.value.branchDrafts.map {
            if (it.localId == localId) it.copy(address = address) else it
        }
        _uiState.value = _uiState.value.copy(branchDrafts = drafts)
    }

    fun regenerateInviteCode() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isRegeneratingCode = true, errorMessage = null)
            try {
                val regenerated = repository.regenerateInviteCode()
                val branches = _uiState.value.branches
                val updated = regenerated.withBranches(branches)
                applyCompany(updated, branches)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(errorMessage = e.message, isRegeneratingCode = false)
                return@launch
            }
            _uiState.value = _uiState.value.copy(isRegeneratingCode = false)
        }
    }

    fun saveChanges() {
        val state = _uiState.value
        val trimmedName = state.companyName.trim()
        if (trimmedName.isEmpty()) {
            _uiState.value = state.copy(errorMessageRes = R.string.company_name_required)
            return
        }
        for (draft in state.branchDrafts) {
            if ((draft.remoteId != null || draft.name.isNotBlank()) && draft.name.isBlank()) {
                _uiState.value = state.copy(errorMessageRes = R.string.company_branch_name_required)
                return
            }
        }

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isSaving = true, errorMessage = null)
            try {
                val useCompanyAddress = state.branchDrafts.isEmpty()
                val trimmedAddr = state.companyAddress.trim().ifEmpty { null }
                var updated = repository.updateMyCompany(
                    name = trimmedName,
                    address = if (useCompanyAddress) trimmedAddr else null
                )

                val existingIds = state.branches.map { it.id }.toSet()
                val keptIds = state.branchDrafts.mapNotNull { it.remoteId }.toSet()
                for (id in existingIds - keptIds) {
                    runCatching { repository.deleteBranch(id) }
                }

                val savedBranches = mutableListOf<AppBranchOption>()
                for (draft in state.branchDrafts) {
                    val name = draft.name.trim()
                    if (name.isEmpty()) continue
                    val addr = draft.address.trim().ifEmpty { null }
                    if (draft.remoteId != null) {
                        savedBranches += repository.updateBranch(draft.remoteId, name, addr)
                    } else {
                        savedBranches += repository.createBranch(name, addr)
                    }
                }

                updated = updated.withBranches(savedBranches)
                applyCompany(updated, savedBranches)
                _uiState.value = _uiState.value.copy(isEditing = false, isSaving = false)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(errorMessage = e.message, isSaving = false)
            }
        }
    }

    private fun applyCompany(company: AppCompany, branches: List<AppBranchOption>) {
        _uiState.value = _uiState.value.copy(
            company = company,
            branches = branches,
            companyName = company.name,
            companyAddress = company.address ?: "",
            branchDrafts = branches.map {
                CompanyBranchDraft(
                    remoteId = it.id,
                    name = it.name,
                    address = it.address ?: ""
                )
            },
            isLoading = false,
            isSaving = false
        )
    }

    // ── Branch working hours ──────────────────────────────────────────────────

    fun loadBranchWorkingHours(
        companyId: Int,
        branchId: Int,
        onResult: (Map<Int, WorkingHoursRange>?) -> Unit
    ) {
        viewModelScope.launch {
            val hours = runCatching {
                repository.fetchBranchWorkingHours(companyId, branchId)
            }.getOrNull()
            onResult(hours)
        }
    }

    fun saveBranchWorkingHours(
        companyId: Int,
        branchId: Int,
        hours: Map<Int, WorkingHoursRange>,
        onDone: (Boolean) -> Unit
    ) {
        viewModelScope.launch {
            try {
                repository.updateBranchWorkingHours(companyId, branchId, hours)
                _uiState.value = _uiState.value.copy(statusMessageRes = R.string.company_wh_saved)
                onDone(true)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(errorMessage = e.message)
                onDone(false)
            }
        }
    }
}
