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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.froggyriia.shiftplanner.domain.model.AppCompany

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CompanySetupScreen(
    viewModel: CompanySetupViewModel,
    onBack: () -> Unit,
    onCreated: (AppCompany) -> Unit
) {
    val state by viewModel.uiState.collectAsState()

    LaunchedEffect(state.createdCompany) {
        state.createdCompany?.let { onCreated(it) }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Create Company") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .padding(16.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            OutlinedTextField(
                value = state.companyName,
                onValueChange = viewModel::onNameChange,
                label = { Text("Company name") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )

            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Has branches?", style = MaterialTheme.typography.bodyLarge)
                Switch(checked = state.hasBranches, onCheckedChange = viewModel::onHasBranchesChange)
            }

            if (state.hasBranches) {
                Text("Branches", style = MaterialTheme.typography.titleSmall)
                state.branches.forEachIndexed { index, draft ->
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        if (index > 0) HorizontalDivider()
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(
                                "Branch ${index + 1}",
                                style = MaterialTheme.typography.labelLarge
                            )
                            if (state.branches.size > 1) {
                                IconButton(onClick = { viewModel.removeBranch(draft.localId) }) {
                                    Icon(Icons.Default.Delete, contentDescription = "Remove branch")
                                }
                            }
                        }
                        OutlinedTextField(
                            value = draft.name,
                            onValueChange = { viewModel.updateBranchName(draft.localId, it) },
                            label = { Text("Branch name") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                        OutlinedTextField(
                            value = draft.address,
                            onValueChange = { viewModel.updateBranchAddress(draft.localId, it) },
                            label = { Text("Address (optional)") },
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                }
                TextButton(
                    onClick = viewModel::addBranch,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(Icons.Default.Add, contentDescription = null)
                    Text("Add branch")
                }
            } else {
                OutlinedTextField(
                    value = state.companyAddress,
                    onValueChange = viewModel::onAddressChange,
                    label = { Text("Address (optional)") },
                    modifier = Modifier.fillMaxWidth()
                )
            }

            state.errorMessage?.let { msg ->
                Text(msg, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
            }

            Spacer(modifier = Modifier.height(8.dp))

            Button(
                onClick = viewModel::createCompany,
                enabled = state.canCreate && !state.isSaving,
                modifier = Modifier.fillMaxWidth()
            ) {
                if (state.isSaving) {
                    CircularProgressIndicator(modifier = Modifier.height(18.dp))
                } else {
                    Text("Create Company")
                }
            }
        }
    }
}
