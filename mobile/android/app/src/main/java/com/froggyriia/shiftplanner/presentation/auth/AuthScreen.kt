package com.froggyriia.shiftplanner.presentation.auth

import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue

private enum class AuthScreenMode {
    LOGIN,
    SIGN_UP
}

@Composable
fun AuthScreen(
    viewModel: AuthViewModel
) {
    val uiState by viewModel.uiState.collectAsState()
    var screenMode by remember { mutableStateOf(AuthScreenMode.LOGIN) }

    when (screenMode) {
        AuthScreenMode.LOGIN -> {
            LoginScreen(
                uiState = uiState,
                onEmailChange = viewModel::onEmailChange,
                onPasswordChange = viewModel::onPasswordChange,
                onLoginClick = viewModel::login,
                onShowSignUp = {
                    viewModel.clearError()
                    screenMode = AuthScreenMode.SIGN_UP
                }
            )
        }

        AuthScreenMode.SIGN_UP -> {
            SignUpScreen(
                uiState = uiState,
                onNameChange = viewModel::onNameChange,
                onEmailChange = viewModel::onEmailChange,
                onPasswordChange = viewModel::onPasswordChange,
                onConfirmPasswordChange = viewModel::onConfirmPasswordChange,
                onRoleChange = viewModel::onRoleChange,
                onSignUpClick = viewModel::signUp,
                onShowLogin = {
                    viewModel.clearError()
                    screenMode = AuthScreenMode.LOGIN
                }
            )
        }
    }
}
