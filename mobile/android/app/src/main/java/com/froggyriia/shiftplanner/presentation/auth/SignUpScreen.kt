package com.froggyriia.shiftplanner.presentation.auth

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.res.stringResource
import com.froggyriia.shiftplanner.R
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.froggyriia.shiftplanner.domain.model.UserRole

@Composable
fun SignUpScreen(
    uiState: AuthUiState,
    onNameChange: (String) -> Unit,
    onEmailChange: (String) -> Unit,
    onPasswordChange: (String) -> Unit,
    onConfirmPasswordChange: (String) -> Unit,
    onRoleChange: (UserRole) -> Unit,
    onSignUpClick: () -> Unit,
    onShowLogin: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text("ShiftPlanner")
        Text(stringResource(R.string.auth_create_account))

        Spacer(modifier = Modifier.padding(8.dp))

        Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            UserRole.entries.forEach { role ->
                FilterChip(
                    selected = uiState.selectedRole == role,
                    onClick = { onRoleChange(role) },
                    label = { Text(role.title) }
                )
            }
        }

        Spacer(modifier = Modifier.padding(4.dp))

        OutlinedTextField(
            value = uiState.name,
            onValueChange = onNameChange,
            label = { Text(stringResource(R.string.auth_name_label)) },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.padding(4.dp))

        OutlinedTextField(
            value = uiState.email,
            onValueChange = onEmailChange,
            label = { Text(stringResource(R.string.email_label)) },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.padding(4.dp))

        OutlinedTextField(
            value = uiState.password,
            onValueChange = onPasswordChange,
            label = { Text(stringResource(R.string.password_label)) },
            singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.padding(4.dp))

        OutlinedTextField(
            value = uiState.confirmPassword,
            onValueChange = onConfirmPasswordChange,
            label = { Text(stringResource(R.string.auth_repeat_password)) },
            singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            isError = uiState.confirmPassword.isNotEmpty() && !uiState.passwordsMatch,
            modifier = Modifier.fillMaxWidth()
        )

        if (uiState.confirmPassword.isNotEmpty() && !uiState.passwordsMatch) {
            Text(stringResource(R.string.auth_passwords_mismatch))
        }

        val errorText = uiState.errorMessage ?: uiState.errorMessageRes?.let { stringResource(it) }
        if (errorText != null) {
            Spacer(modifier = Modifier.padding(4.dp))
            Text(errorText)
        }

        Spacer(modifier = Modifier.padding(8.dp))

        Button(
            onClick = onSignUpClick,
            enabled = !uiState.isLoading && uiState.canSignUp,
            modifier = Modifier.fillMaxWidth()
        ) {
            if (uiState.isLoading) {
                CircularProgressIndicator()
            } else {
                Text(stringResource(R.string.signup_button))
            }
        }

        TextButton(
            onClick = onShowLogin,
            enabled = !uiState.isLoading
        ) {
            Text(stringResource(R.string.auth_have_account))
        }
    }
}