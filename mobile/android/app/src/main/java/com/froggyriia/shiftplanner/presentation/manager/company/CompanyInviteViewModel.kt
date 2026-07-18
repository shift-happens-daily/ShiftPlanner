package com.froggyriia.shiftplanner.presentation.manager.company

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.froggyriia.shiftplanner.data.company.CompanyRepository
import com.froggyriia.shiftplanner.domain.model.AppCompanyInvitePreview
import com.froggyriia.shiftplanner.domain.model.AppUser
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import com.froggyriia.shiftplanner.R

data class CompanyInviteUiState(
    val inviteCode: String = "",
    val preview: AppCompanyInvitePreview? = null,
    val selectedBranchId: Int? = null,
    val selectedPositionId: Int? = null,
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
    val errorMessageRes: Int? = null,
    val statusMessageRes: Int? = null,
    val joinedUser: AppUser? = null
) {
    val canJoin: Boolean get() = !isLoading && preview != null
}

class CompanyInviteViewModel(
    private val repository: CompanyRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(CompanyInviteUiState())
    val uiState: StateFlow<CompanyInviteUiState> = _uiState.asStateFlow()

    fun onCodeChange(value: String) { _uiState.value = _uiState.value.copy(inviteCode = value, preview = null) }
    fun onBranchSelect(id: Int?) { _uiState.value = _uiState.value.copy(selectedBranchId = id) }
    fun onPositionSelect(id: Int?) { _uiState.value = _uiState.value.copy(selectedPositionId = id) }
    fun clearError() { _uiState.value = _uiState.value.copy(errorMessage = null) }

    fun previewCompany() {
        val code = _uiState.value.inviteCode.trim().uppercase()
        if (code.isEmpty()) {
            _uiState.value = _uiState.value.copy(errorMessageRes = R.string.invite_enter_code)
            return
        }
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            try {
                val preview = repository.previewInvite(code)
                _uiState.value = _uiState.value.copy(
                    preview = preview,
                    selectedBranchId = null,
                    selectedPositionId = null,
                    isLoading = false
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    preview = null,
                    errorMessage = e.message,
                    isLoading = false
                )
            }
        }
    }

    fun joinCompany() {
        val state = _uiState.value
        val code = state.inviteCode.trim().uppercase()
        if (code.isEmpty()) {
            _uiState.value = state.copy(errorMessageRes = R.string.invite_enter_code)
            return
        }
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            try {
                val user = repository.joinCompany(
                    inviteCode = code,
                    branchId = state.selectedBranchId,
                    positionId = state.selectedPositionId
                )
                _uiState.value = _uiState.value.copy(joinedUser = user, isLoading = false)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(errorMessage = e.message, isLoading = false)
            }
        }
    }

    /** Second manager requests to join an existing company by invite code. */
    fun joinAsManager() {
        val state = _uiState.value
        val code = state.inviteCode.trim().uppercase()
        if (code.isEmpty()) {
            _uiState.value = state.copy(errorMessageRes = R.string.invite_enter_code)
            return
        }
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            try {
                val user = repository.joinCompanyAsManager(code)
                _uiState.value = _uiState.value.copy(joinedUser = user, isLoading = false)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(errorMessage = e.message, isLoading = false)
            }
        }
    }
}
