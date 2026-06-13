package com.froggyriia.shiftplanner.presentation.auth

import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

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
    val currentUser = uiState.currentUser

    if (currentUser != null) {
        MainScreen(
            name = currentUser.name,
            email = currentUser.email,
            role = currentUser.role.title,
            onLogout = {
                viewModel.logout()
            }
        )
    } else {
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
}

@Composable
private fun MainScreen(
    name: String,
    email: String,
    role: String,
    onLogout: () -> Unit
) {
    Column(
        modifier = androidx.compose.ui.Modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = androidx.compose.foundation.layout.Arrangement.Center,
        horizontalAlignment = androidx.compose.ui.Alignment.CenterHorizontally
    ) {
        Text("Welcome, $name")
        Text("Email: $email")
        Text("Role: $role")

        Spacer(modifier = androidx.compose.ui.Modifier.padding(8.dp))

        Button(onClick = onLogout) {
            Text("Logout")
        }
    }
}