package com.froggyriia.shiftplanner.presentation.manager.company

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.unit.dp
import com.froggyriia.shiftplanner.domain.model.AppUser
import androidx.compose.ui.res.stringResource
import com.froggyriia.shiftplanner.R

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CompanyInviteSheet(
    viewModel: CompanyInviteViewModel,
    onDismiss: () -> Unit,
    onUserJoined: (AppUser) -> Unit
) {
    val state by viewModel.uiState.collectAsState()

    LaunchedEffect(state.joinedUser) {
        state.joinedUser?.let { onUserJoined(it) }
    }

    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            modifier = Modifier
                .padding(horizontal = 20.dp)
                .padding(bottom = 32.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text(stringResource(R.string.invite_join_company), style = MaterialTheme.typography.headlineSmall)

            OutlinedTextField(
                value = state.inviteCode,
                onValueChange = viewModel::onCodeChange,
                label = { Text(stringResource(R.string.invite_code_label)) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )

            Button(
                onClick = viewModel::previewCompany,
                enabled = !state.isLoading,
                modifier = Modifier.fillMaxWidth()
            ) {
                if (state.isLoading && state.preview == null) {
                    CircularProgressIndicator(modifier = Modifier.height(18.dp))
                } else {
                    Text(stringResource(R.string.invite_preview))
                }
            }

            state.preview?.let { preview ->
                HorizontalDivider()

                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(preview.name, style = MaterialTheme.typography.titleMedium)
                    Text(
                        stringResource(R.string.invite_code_line, preview.inviteCode),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    if (preview.branches.isNotEmpty()) {
                        Text(
                            stringResource(R.string.invite_branches_line, preview.branches.joinToString { it.name }),
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                    if (preview.positions.isNotEmpty()) {
                        Text(
                            stringResource(R.string.invite_positions_line, preview.positions.joinToString { it.name }),
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                }

                if (preview.branches.isNotEmpty()) {
                    NullableDropdown(
                        label = stringResource(R.string.invite_branch_optional),
                        options = preview.branches.map { it.id to it.name },
                        selected = state.selectedBranchId,
                        onSelect = viewModel::onBranchSelect
                    )
                }

                if (preview.positions.isNotEmpty()) {
                    NullableDropdown(
                        label = stringResource(R.string.invite_position_optional),
                        options = preview.positions.map { it.id to it.name },
                        selected = state.selectedPositionId,
                        onSelect = viewModel::onPositionSelect
                    )
                }

                Button(
                    onClick = viewModel::joinCompany,
                    enabled = state.canJoin,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    if (state.isLoading) {
                        CircularProgressIndicator(modifier = Modifier.height(18.dp))
                    } else {
                        Text(stringResource(R.string.invite_join_button))
                    }
                }
            }

            (state.errorMessage ?: state.errorMessageRes?.let { stringResource(it) })?.let { msg ->
                Text(
                    msg,
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodySmall
                )
            }

            Spacer(modifier = Modifier.height(8.dp))
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun NullableDropdown(
    label: String,
    options: List<Pair<Int, String>>,
    selected: Int?,
    onSelect: (Int?) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }
    val selectedLabel = options.firstOrNull { it.first == selected }?.second ?: stringResource(R.string.common_none)

    ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { expanded = it }) {
        OutlinedTextField(
            value = selectedLabel,
            onValueChange = {},
            readOnly = true,
            label = { Text(label) },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
            modifier = Modifier
                .fillMaxWidth()
                .menuAnchor()
        )
        ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            DropdownMenuItem(
                text = { Text(stringResource(R.string.common_none)) },
                onClick = { onSelect(null); expanded = false }
            )
            options.forEach { (id, name) ->
                DropdownMenuItem(
                    text = { Text(name) },
                    onClick = { onSelect(id); expanded = false }
                )
            }
        }
    }
}
