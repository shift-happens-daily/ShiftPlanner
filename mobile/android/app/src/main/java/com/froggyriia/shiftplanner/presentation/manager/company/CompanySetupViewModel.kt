package com.froggyriia.shiftplanner.presentation.manager.company

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.froggyriia.shiftplanner.data.company.CompanyRepository
import com.froggyriia.shiftplanner.domain.model.AppBranchOption
import com.froggyriia.shiftplanner.domain.model.AppCompany
import com.froggyriia.shiftplanner.domain.model.CompanyBranchDraft
import com.froggyriia.shiftplanner.domain.model.withBranches
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class CompanySetupUiState(
    val companyName: String = "",
    val companyAddress: String = "",
    val hasBranches: Boolean = false,
    val branches: List<CompanyBranchDraft> = listOf(CompanyBranchDraft()),
    val isSaving: Boolean = false,
    val errorMessage: String? = null,
    val createdCompany: AppCompany? = null
) {
    val canCreate: Boolean
        get() = companyName.isNotBlank()
}

class CompanySetupViewModel(
    private val repository: CompanyRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(CompanySetupUiState())
    val uiState: StateFlow<CompanySetupUiState> = _uiState.asStateFlow()

    fun onNameChange(value: String) { _uiState.value = _uiState.value.copy(companyName = value) }
    fun onAddressChange(value: String) { _uiState.value = _uiState.value.copy(companyAddress = value) }
    fun onHasBranchesChange(value: Boolean) {
        _uiState.value = _uiState.value.copy(hasBranches = value)
    }

    fun addBranch() {
        val branches = _uiState.value.branches + CompanyBranchDraft()
        _uiState.value = _uiState.value.copy(branches = branches)
    }

    fun removeBranch(localId: String) {
        var branches = _uiState.value.branches.filter { it.localId != localId }
        if (branches.isEmpty()) branches = listOf(CompanyBranchDraft())
        _uiState.value = _uiState.value.copy(branches = branches)
    }

    fun updateBranchName(localId: String, name: String) {
        val branches = _uiState.value.branches.map {
            if (it.localId == localId) it.copy(name = name) else it
        }
        _uiState.value = _uiState.value.copy(branches = branches)
    }

    fun updateBranchAddress(localId: String, address: String) {
        val branches = _uiState.value.branches.map {
            if (it.localId == localId) it.copy(address = address) else it
        }
        _uiState.value = _uiState.value.copy(branches = branches)
    }

    fun clearError() { _uiState.value = _uiState.value.copy(errorMessage = null) }

    fun createCompany() {
        val state = _uiState.value
        val trimmedName = state.companyName.trim()
        if (trimmedName.isEmpty()) {
            _uiState.value = state.copy(errorMessage = "Company name is required")
            return
        }
        if (state.hasBranches && state.branches.all { it.name.isBlank() }) {
            _uiState.value = state.copy(errorMessage = "Add at least one branch")
            return
        }

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isSaving = true, errorMessage = null)
            try {
                val trimmedAddress = state.companyAddress.trim()
                var company = repository.createCompany(name = trimmedName)

                if (trimmedAddress.isNotEmpty()) {
                    company = repository.updateMyCompany(name = trimmedName, address = trimmedAddress)
                }

                if (state.hasBranches) {
                    val createdBranches = mutableListOf<AppBranchOption>()
                    for (draft in state.branches) {
                        val branchName = draft.name.trim()
                        if (branchName.isEmpty()) continue
                        val branchAddr = draft.address.trim().ifEmpty { null }
                        createdBranches += repository.createBranch(name = branchName, address = branchAddr)
                    }
                    company = company.withBranches(createdBranches)
                }

                _uiState.value = _uiState.value.copy(createdCompany = company, isSaving = false)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(errorMessage = e.message, isSaving = false)
            }
        }
    }
}
