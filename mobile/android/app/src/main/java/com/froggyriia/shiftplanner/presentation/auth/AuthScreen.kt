package com.froggyriia.shiftplanner.presentation.auth

import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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

    if (uiState.emailVerificationPending) {
        AlertDialog(
            onDismissRequest = {
                viewModel.dismissEmailVerification()
                screenMode = AuthScreenMode.LOGIN
            },
            title = { Text("Check your email") },
            text = { Text("We sent a confirmation link to ${uiState.email}. Click it to verify your account, then log in.") },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.dismissEmailVerification()
                    screenMode = AuthScreenMode.LOGIN
                }) {
                    Text("Got it")
                }
            }
        )
    }
}
