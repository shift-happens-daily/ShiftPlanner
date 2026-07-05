package com.froggyriia.shiftplanner.presentation.manager.company

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import androidx.lifecycle.viewmodel.compose.viewModel
import com.froggyriia.shiftplanner.data.company.CompanyRepository
import com.froggyriia.shiftplanner.domain.model.AppCompany
import com.froggyriia.shiftplanner.domain.model.AppUser
import com.froggyriia.shiftplanner.domain.model.asAppCompany

private sealed class CompanyNavState {
    object Loading : CompanyNavState()
    object Landing : CompanyNavState()  // no company yet
    object Creating : CompanyNavState() // create company form
    object Details : CompanyNavState()  // existing company
}

@Composable
fun CompanyScreen(
    user: AppUser,
    repository: CompanyRepository,
    onUserUpdated: (AppUser) -> Unit
) {
    // remember (not rememberSaveable): CompanyNavState is not Parcelable/Serializable
    var navState by remember { mutableStateOf<CompanyNavState>(
        if (user.hasCompany) CompanyNavState.Details else CompanyNavState.Landing
    ) }

    val setupVm: CompanySetupViewModel = viewModel(
        key = "company_setup",
        factory = remember { CompanySetupVmFactory(repository) }
    )
    val detailsVm: CompanyDetailsViewModel = viewModel(
        key = "company_details",
        factory = remember { CompanyDetailsVmFactory(repository) }
    )
    val inviteVm: CompanyInviteViewModel = viewModel(
        key = "company_invite",
        factory = remember { CompanyInviteVmFactory(repository) }
    )

    // Pre-populate details VM with user summary so it shows immediately
    LaunchedEffect(user) {
        user.company?.asAppCompany()?.let { detailsVm.setInitialCompany(it) }
        if (user.hasCompany) {
            detailsVm.loadCompany()
        }
    }

    when (navState) {
        CompanyNavState.Landing -> CompanyLanding(
            onCreateClick = { navState = CompanyNavState.Creating },
        )
        CompanyNavState.Creating -> CompanySetupScreen(
            viewModel = setupVm,
            onBack = { navState = CompanyNavState.Landing },
            onCreated = { company ->
                detailsVm.setInitialCompany(company)
                navState = CompanyNavState.Details
            }
        )
        CompanyNavState.Details -> CompanyDetailsContent(
            viewModel = detailsVm
        )
        else -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator()
        }
    }
}

@Composable
private fun CompanyLanding(
    onCreateClick: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            "No company yet",
            style = MaterialTheme.typography.headlineSmall
        )
        Spacer(Modifier.height(8.dp))
        Text(
            "Create a company to start scheduling",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(Modifier.height(32.dp))
        Button(
            onClick = onCreateClick,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Create Company")
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CompanyDetailsContent(
    viewModel: CompanyDetailsViewModel
) {
    val state by viewModel.uiState.collectAsState()
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var didCopy by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(state.company?.name ?: "Company") },
                actions = {
                    if (!state.isEditing) {
                        IconButton(onClick = viewModel::startEditing) {
                            Icon(Icons.Default.Edit, contentDescription = "Edit")
                        }
                    }
                }
            )
        }
    ) { padding ->
        if (state.isLoading && state.company == null) {
            Box(
                Modifier
                    .fillMaxSize()
                    .padding(padding),
                contentAlignment = Alignment.Center
            ) { CircularProgressIndicator() }
            return@Scaffold
        }

        Column(
            modifier = Modifier
                .padding(padding)
                .padding(16.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            state.company?.let { company ->
                if (!state.isEditing) {
                    // ── Read-only company info ──
                    Card(modifier = Modifier.fillMaxWidth()) {
                        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text("Invite code", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Text(
                                company.inviteCode,
                                style = MaterialTheme.typography.titleLarge,
                                fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace
                            )
                            Row(
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                // Copy button with "Copied!" feedback
                                OutlinedButton(
                                    onClick = {
                                        val cm = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                                        cm.setPrimaryClip(ClipData.newPlainText("Invite code", company.inviteCode))
                                        didCopy = true
                                        scope.launch {
                                            delay(2000)
                                            didCopy = false
                                        }
                                    },
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Icon(Icons.Default.ContentCopy, null, modifier = Modifier.padding(end = 4.dp))
                                    Text(if (didCopy) "Copied!" else "Copy code")
                                }
                                // Share button
                                Button(
                                    onClick = {
                                        val shareText = "Join ${company.name} in ShiftPlanner with invite code: ${company.inviteCode}"
                                        val intent = Intent(Intent.ACTION_SEND).apply {
                                            type = "text/plain"
                                            putExtra(Intent.EXTRA_TEXT, shareText)
                                            putExtra(Intent.EXTRA_SUBJECT, "ShiftPlanner invite")
                                        }
                                        context.startActivity(Intent.createChooser(intent, "Share invite").apply {
                                            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                                        })
                                    },
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Icon(Icons.Default.Share, null, modifier = Modifier.padding(end = 4.dp))
                                    Text("Share")
                                }
                            }
                            // Regenerate code
                            if (state.isRegeneratingCode) {
                                CircularProgressIndicator(modifier = Modifier.height(20.dp))
                            } else {
                                TextButton(onClick = viewModel::regenerateInviteCode) {
                                    Text("Generate new code", style = MaterialTheme.typography.labelSmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                            }

                            if (company.address != null) {
                                Text(company.address, style = MaterialTheme.typography.bodyMedium)
                            }
                        }
                    }

                    if (company.branches.isNotEmpty()) {
                        Text("Branches", style = MaterialTheme.typography.titleSmall)
                        company.branches.forEach { branch ->
                            Card(modifier = Modifier.fillMaxWidth()) {
                                Column(modifier = Modifier.padding(12.dp)) {
                                    Text(branch.name, style = MaterialTheme.typography.bodyLarge)
                                    branch.address?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                                }
                            }
                        }
                    }
                } else {
                    // ── Edit form ──
                    OutlinedTextField(
                        value = state.companyName,
                        onValueChange = viewModel::onNameChange,
                        label = { Text("Company name") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )

                    if (state.showAddressField) {
                        OutlinedTextField(
                            value = state.companyAddress,
                            onValueChange = viewModel::onAddressChange,
                            label = { Text("Address (optional)") },
                            modifier = Modifier.fillMaxWidth()
                        )
                    }

                    Text("Branches", style = MaterialTheme.typography.titleSmall)
                    state.branchDrafts.forEachIndexed { index, draft ->
                        if (index > 0) HorizontalDivider()
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween,
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text("Branch ${index + 1}", style = MaterialTheme.typography.labelLarge)
                                IconButton(onClick = { viewModel.removeBranchDraft(draft.localId) }) {
                                    Icon(Icons.Default.Delete, contentDescription = "Remove")
                                }
                            }
                            OutlinedTextField(
                                value = draft.name,
                                onValueChange = { viewModel.updateDraftName(draft.localId, it) },
                                label = { Text("Branch name") },
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth()
                            )
                            OutlinedTextField(
                                value = draft.address,
                                onValueChange = { viewModel.updateDraftAddress(draft.localId, it) },
                                label = { Text("Address (optional)") },
                                modifier = Modifier.fillMaxWidth()
                            )
                        }
                    }

                    TextButton(
                        onClick = viewModel::addBranchDraft,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Icon(Icons.Default.Add, null)
                        Text("Add branch")
                    }

                    state.errorMessage?.let { msg ->
                        Text(msg, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                    }

                    Row(
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        OutlinedButton(
                            onClick = { viewModel.cancelEditing() },
                            modifier = Modifier.weight(1f)
                        ) { Text("Cancel") }
                        Button(
                            onClick = viewModel::saveChanges,
                            enabled = state.canSave,
                            modifier = Modifier.weight(1f)
                        ) {
                            if (state.isSaving) CircularProgressIndicator(modifier = Modifier.height(18.dp))
                            else Text("Save")
                        }
                    }
                }
            }

            state.errorMessage?.let { msg ->
                if (!state.isEditing) {
                    Text(msg, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                }
            }
        }
    }
}

// ── ViewModel Factories ────────────────────────────────────────────────────────

private class CompanySetupVmFactory(private val repo: CompanyRepository) :
    androidx.lifecycle.ViewModelProvider.Factory {
    override fun <T : androidx.lifecycle.ViewModel> create(modelClass: Class<T>): T {
        @Suppress("UNCHECKED_CAST")
        return CompanySetupViewModel(repo) as T
    }
}

private class CompanyDetailsVmFactory(private val repo: CompanyRepository) :
    androidx.lifecycle.ViewModelProvider.Factory {
    override fun <T : androidx.lifecycle.ViewModel> create(modelClass: Class<T>): T {
        @Suppress("UNCHECKED_CAST")
        return CompanyDetailsViewModel(repo) as T
    }
}

private class CompanyInviteVmFactory(private val repo: CompanyRepository) :
    androidx.lifecycle.ViewModelProvider.Factory {
    override fun <T : androidx.lifecycle.ViewModel> create(modelClass: Class<T>): T {
        @Suppress("UNCHECKED_CAST")
        return CompanyInviteViewModel(repo) as T
    }
}
