package com.froggyriia.shiftplanner.presentation.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.froggyriia.shiftplanner.data.auth.AuthRepository
import com.froggyriia.shiftplanner.domain.model.AppUser
import com.froggyriia.shiftplanner.domain.model.UserRole
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import com.froggyriia.shiftplanner.R

class AuthViewModel(
    private val repository: AuthRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(AuthUiState())
    val uiState: StateFlow<AuthUiState> = _uiState.asStateFlow()

    init {
        restoreSession()
    }

    fun onEmailChange(value: String) {
        _uiState.value = _uiState.value.copy(email = value)
    }

    fun onPasswordChange(value: String) {
        _uiState.value = _uiState.value.copy(password = value)
    }

    fun onConfirmPasswordChange(value: String) {
        _uiState.value = _uiState.value.copy(confirmPassword = value)
    }

    fun onNameChange(value: String) {
        _uiState.value = _uiState.value.copy(name = value)
    }

    fun onRoleChange(value: UserRole) {
        _uiState.value = _uiState.value.copy(selectedRole = value)
    }

    fun clearError() {
        _uiState.value = _uiState.value.copy(errorMessage = null)
    }

    fun dismissEmailVerification() {
        _uiState.value = _uiState.value.copy(emailVerificationPending = false)
    }

    fun login() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(
                isLoading = true,
                errorMessage = null
            )

            try {
                val state = _uiState.value

                val user = repository.login(
                    email = state.email.trim(),
                    password = state.password
                )

                _uiState.value = _uiState.value.copy(
                    currentUser = user,
                    isLoading = false
                )

            } catch (error: Exception) {
                _uiState.value = _uiState.value.copy(
                    errorMessage = error.message ?: "Failed to login",
                    isLoading = false
                )
            }
        }
    }

    fun signUp() {
        val state = _uiState.value

        if (state.password != state.confirmPassword) {
            _uiState.value = state.copy(
                errorMessageRes = R.string.authm_passwords_mismatch
            )
            return
        }

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(
                isLoading = true,
                errorMessage = null
            )

            try {
                val currentState = _uiState.value

                val user = repository.signUp(
                    email = currentState.email.trim(),
                    password = currentState.password,
                    name = currentState.name.trim(),
                    role = currentState.selectedRole
                )

                if (user == null) {
                    // Email verification required — stay on auth screen, show message
                    _uiState.value = _uiState.value.copy(
                        emailVerificationPending = true,
                        isLoading = false
                    )
                } else {
                    _uiState.value = _uiState.value.copy(
                        currentUser = user,
                        isLoading = false
                    )
                }
            } catch (error: Exception) {
                _uiState.value = _uiState.value.copy(
                    errorMessage = error.message ?: "Failed to sign up",
                    isLoading = false
                )
            }
        }
    }

    fun logout() {
        viewModelScope.launch {
            repository.logout()
            _uiState.value = AuthUiState()
        }
    }

    fun updateUser(user: AppUser) {
        _uiState.value = _uiState.value.copy(currentUser = user)
    }

    fun deleteAccount() {
        viewModelScope.launch {
            runCatching { repository.deleteAccount() }
            _uiState.value = AuthUiState()
        }
    }

    private fun restoreSession() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            val user = repository.getCurrentUser()
            _uiState.value = _uiState.value.copy(
                currentUser = user,
                isLoading = false
            )
        }
    }
}


data class AuthUiState(
    val email: String = "",
    val password: String = "",
    val confirmPassword: String = "",
    val name: String = "",
    val selectedRole: UserRole = UserRole.EMPLOYEE,
    val currentUser: AppUser? = null,
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
    val errorMessageRes: Int? = null,
    val statusMessageRes: Int? = null,
    val emailVerificationPending: Boolean = false
) {
    val passwordsMatch: Boolean
        get() = password == confirmPassword

    val canSignUp: Boolean
        get() = name.isNotBlank() &&
                email.isNotBlank() &&
                password.isNotBlank() &&
                confirmPassword.isNotBlank() &&
                passwordsMatch
}
