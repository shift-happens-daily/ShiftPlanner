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
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
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
import androidx.compose.ui.res.stringResource
import com.froggyriia.shiftplanner.R
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.foundation.layout.width

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
    onUserUpdated: (AppUser) -> Unit,
    onNotificationsClick: () -> Unit = {}
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

    var showJoinSheet by remember { mutableStateOf(false) }

    // A manager who has requested to join a company is awaiting approval.
    if (user.isManagerPending) {
        ManagerPendingContent()
        return
    }

    when (navState) {
        CompanyNavState.Landing -> CompanyLanding(
            onCreateClick = { navState = CompanyNavState.Creating },
            onJoinClick = { showJoinSheet = true }
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
            viewModel = detailsVm,
            onNotificationsClick = onNotificationsClick,
            onCompanyDeleted = {
                onUserUpdated(user.copy(company = null))
                navState = CompanyNavState.Landing
            }
        )
        else -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator()
        }
    }

    if (showJoinSheet) {
        ManagerJoinSheet(
            viewModel = inviteVm,
            onDismiss = { showJoinSheet = false },
            onJoined = { updatedUser ->
                onUserUpdated(updatedUser)
                showJoinSheet = false
            }
        )
    }
}

@Composable
private fun CompanyLanding(
    onCreateClick: () -> Unit,
    onJoinClick: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            stringResource(R.string.company_none_title),
            style = MaterialTheme.typography.headlineSmall
        )
        Spacer(Modifier.height(8.dp))
        Text(
            stringResource(R.string.company_none_subtitle),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(Modifier.height(32.dp))
        Button(
            onClick = onCreateClick,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text(stringResource(R.string.company_create))
        }
        Spacer(Modifier.height(12.dp))
        OutlinedButton(
            onClick = onJoinClick,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text(stringResource(R.string.company_join_as_manager))
        }
    }
}

@Composable
private fun ManagerPendingContent() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            stringResource(R.string.company_pending_title),
            style = MaterialTheme.typography.headlineSmall,
            textAlign = androidx.compose.ui.text.style.TextAlign.Center
        )
        Spacer(Modifier.height(8.dp))
        Text(
            stringResource(R.string.company_pending_subtitle),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = androidx.compose.ui.text.style.TextAlign.Center
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ManagerJoinSheet(
    viewModel: CompanyInviteViewModel,
    onDismiss: () -> Unit,
    onJoined: (AppUser) -> Unit
) {
    val state by viewModel.uiState.collectAsState()

    LaunchedEffect(state.joinedUser) {
        state.joinedUser?.let { onJoined(it) }
    }

    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp)
                .padding(bottom = 32.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text(
                stringResource(R.string.company_join_as_manager),
                style = MaterialTheme.typography.headlineSmall
            )
            Text(
                stringResource(R.string.company_join_as_manager_hint),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

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
                Text(preview.name, style = MaterialTheme.typography.titleMedium)
                Button(
                    onClick = viewModel::joinAsManager,
                    enabled = state.canJoin,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    if (state.isLoading) CircularProgressIndicator(modifier = Modifier.height(18.dp))
                    else Text(stringResource(R.string.company_join_request_send))
                }
            }

            (state.errorMessage ?: state.errorMessageRes?.let { stringResource(it) })?.let { msg ->
                Text(msg, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CompanyDetailsContent(
    viewModel: CompanyDetailsViewModel,
    onNotificationsClick: () -> Unit,
    onCompanyDeleted: () -> Unit
) {
    val state by viewModel.uiState.collectAsState()
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var didCopy by remember { mutableStateOf(false) }
    var showDeleteConfirm by remember { mutableStateOf(false) }
    // Branch whose working hours are being edited
    var workingHoursBranch by remember { mutableStateOf<com.froggyriia.shiftplanner.domain.model.AppBranchOption?>(null) }
    val snackbarHostState = remember { SnackbarHostState() }
    LaunchedEffect(state.statusMessageRes) {
        state.statusMessageRes?.let {
            snackbarHostState.showSnackbar(context.getString(it))
            viewModel.clearError()
        }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = { Text(state.company?.name ?: stringResource(R.string.nav_company)) },
                actions = {
                    IconButton(onClick = onNotificationsClick) {
                        Icon(Icons.Default.Notifications, contentDescription = stringResource(R.string.nav_notifications))
                    }
                    if (!state.isEditing) {
                        IconButton(onClick = viewModel::startEditing) {
                            Icon(Icons.Default.Edit, contentDescription = stringResource(R.string.edit))
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
                            // "Invite code" label + Regenerate button on same row
                            Row(
                                Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(stringResource(R.string.invite_code_label), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                if (state.isRegeneratingCode) {
                                    CircularProgressIndicator(
                                        modifier = Modifier
                                            .height(20.dp)
                                            .padding(end = 4.dp),
                                        strokeWidth = 2.dp
                                    )
                                } else {
                                    OutlinedButton(
                                        onClick = viewModel::regenerateInviteCode,
                                        contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                                        modifier = Modifier.height(32.dp)
                                    ) {
                                        Icon(
                                            Icons.Default.Edit,
                                            contentDescription = null,
                                            modifier = Modifier
                                                .height(14.dp)
                                                .padding(end = 4.dp)
                                        )
                                        Text(stringResource(R.string.company_new_code), style = MaterialTheme.typography.labelSmall)
                                    }
                                }
                            }
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
                                    Text(if (didCopy) stringResource(R.string.invite_code_copied) else stringResource(R.string.invite_code_copy))
                                }
                                // Share button
                                Button(
                                    onClick = {
                                        val shareText = context.getString(R.string.company_share_text, company.name, company.inviteCode)
                                        val intent = Intent(Intent.ACTION_SEND).apply {
                                            type = "text/plain"
                                            putExtra(Intent.EXTRA_TEXT, shareText)
                                            putExtra(Intent.EXTRA_SUBJECT, "ShiftPlanner invite")
                                        }
                                        context.startActivity(Intent.createChooser(intent, context.getString(R.string.company_share_invite)).apply {
                                            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                                        })
                                    },
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Icon(Icons.Default.Share, null, modifier = Modifier.padding(end = 4.dp))
                                    Text(stringResource(R.string.company_share))
                                }
                            }

                            if (company.address != null) {
                                Text(company.address, style = MaterialTheme.typography.bodyMedium)
                            }
                        }
                    }

                    if (company.branches.isNotEmpty()) {
                        Text(stringResource(R.string.company_branches), style = MaterialTheme.typography.titleSmall)
                        company.branches.forEach { branch ->
                            Card(modifier = Modifier.fillMaxWidth()) {
                                Row(
                                    modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 4.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column(modifier = Modifier.weight(1f).padding(vertical = 8.dp)) {
                                        Text(branch.name, style = MaterialTheme.typography.bodyLarge)
                                        branch.address?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                                    }
                                    TextButton(onClick = { workingHoursBranch = branch }) {
                                        Text(stringResource(R.string.company_working_hours), style = MaterialTheme.typography.labelMedium)
                                    }
                                }
                            }
                        }
                    }
                    OutlinedButton(
                        onClick = { showDeleteConfirm = true },
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error)
                    ) { Text(stringResource(R.string.company_delete)) }
                } else {
                    // ── Edit form ──
                    OutlinedTextField(
                        value = state.companyName,
                        onValueChange = viewModel::onNameChange,
                        label = { Text(stringResource(R.string.company_name_label)) },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )

                    if (state.showAddressField) {
                        OutlinedTextField(
                            value = state.companyAddress,
                            onValueChange = viewModel::onAddressChange,
                            label = { Text(stringResource(R.string.company_address_optional)) },
                            modifier = Modifier.fillMaxWidth()
                        )
                    }

                    Text(stringResource(R.string.company_branches), style = MaterialTheme.typography.titleSmall)
                    state.branchDrafts.forEachIndexed { index, draft ->
                        if (index > 0) HorizontalDivider()
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween,
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text(stringResource(R.string.company_branch_n, index + 1), style = MaterialTheme.typography.labelLarge)
                                IconButton(onClick = { viewModel.removeBranchDraft(draft.localId) }) {
                                    Icon(Icons.Default.Delete, contentDescription = stringResource(R.string.common_remove))
                                }
                            }
                            OutlinedTextField(
                                value = draft.name,
                                onValueChange = { viewModel.updateDraftName(draft.localId, it) },
                                label = { Text(stringResource(R.string.company_branch_name)) },
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth()
                            )
                            OutlinedTextField(
                                value = draft.address,
                                onValueChange = { viewModel.updateDraftAddress(draft.localId, it) },
                                label = { Text(stringResource(R.string.company_address_optional)) },
                                modifier = Modifier.fillMaxWidth()
                            )
                        }
                    }

                    TextButton(
                        onClick = viewModel::addBranchDraft,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Icon(Icons.Default.Add, null)
                        Text(stringResource(R.string.company_add_branch))
                    }

                    (state.errorMessage ?: state.errorMessageRes?.let { stringResource(it) })?.let { msg ->
                        Text(msg, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                    }

                    Row(
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        OutlinedButton(
                            onClick = { viewModel.cancelEditing() },
                            modifier = Modifier.weight(1f)
                        ) { Text(stringResource(R.string.cancel)) }
                        Button(
                            onClick = viewModel::saveChanges,
                            enabled = state.canSave,
                            modifier = Modifier.weight(1f)
                        ) {
                            if (state.isSaving) CircularProgressIndicator(modifier = Modifier.height(18.dp))
                            else Text(stringResource(R.string.save))
                        }
                    }
                }
            }

            (state.errorMessage ?: state.errorMessageRes?.let { stringResource(it) })?.let { msg ->
                if (!state.isEditing) {
                    Text(msg, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                }
            }
        }
    }

    // ── Branch working hours editor ────────────────────────────────────────────
    workingHoursBranch?.let { branch ->
        val companyId = state.company?.id
        if (companyId != null) {
            BranchWorkingHoursSheet(
                branchName = branch.name,
                load = { onResult -> viewModel.loadBranchWorkingHours(companyId, branch.id, onResult) },
                save = { hours, onDone -> viewModel.saveBranchWorkingHours(companyId, branch.id, hours, onDone) },
                onDismiss = { workingHoursBranch = null }
            )
        }
    }

    if (showDeleteConfirm) {
        AlertDialog(
            onDismissRequest = { showDeleteConfirm = false },
            title = { Text(stringResource(R.string.company_delete_confirm_title)) },
            text = { Text(stringResource(R.string.company_delete_confirm_body)) },
            confirmButton = {
                TextButton(onClick = {
                    showDeleteConfirm = false
                    viewModel.deleteCompany { ok -> if (ok) onCompanyDeleted() }
                }) { Text(stringResource(R.string.company_delete)) }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteConfirm = false }) { Text(stringResource(R.string.cancel)) }
            }
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun BranchWorkingHoursSheet(
    branchName: String,
    load: ((Map<Int, com.froggyriia.shiftplanner.domain.model.WorkingHoursRange>?) -> Unit) -> Unit,
    save: (Map<Int, com.froggyriia.shiftplanner.domain.model.WorkingHoursRange>, (Boolean) -> Unit) -> Unit,
    onDismiss: () -> Unit
) {
    val dayLabels = androidx.compose.ui.res.stringArrayResource(R.array.weekdays_short)
    var loading by remember { mutableStateOf(true) }
    var saving by remember { mutableStateOf(false) }
    // weekday -> (enabled, startSlot, endSlot)
    val days = remember { mutableStateMapOf<Int, Triple<Boolean, Int, Int>>() }

    LaunchedEffect(Unit) {
        load { hours ->
            for (d in 0..6) {
                val range = hours?.get(d)
                days[d] = if (range != null) Triple(true, range.startSlot, range.endSlot)
                else Triple(false, 18, 36) // default 09:00–18:00 when enabled
            }
            loading = false
        }
    }

    fun slotLabel(slot: Int) = "%02d:%02d".format(slot / 2, (slot % 2) * 30)
    val slotOptions = (0..48).map { it to slotLabel(it) }

    androidx.compose.material3.ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            Modifier.fillMaxWidth().padding(horizontal = 16.dp).padding(bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Text(
                "${stringResource(R.string.company_working_hours)} — $branchName",
                style = MaterialTheme.typography.titleMedium
            )
            if (loading) {
                Box(Modifier.fillMaxWidth().padding(24.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            } else {
                for (d in 0..6) {
                    val entry = days[d] ?: Triple(false, 18, 36)
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        androidx.compose.material3.Checkbox(
                            checked = entry.first,
                            onCheckedChange = { days[d] = entry.copy(first = it) }
                        )
                        Text(
                            dayLabels.getOrElse(d) { "$d" },
                            modifier = Modifier.width(36.dp),
                            style = MaterialTheme.typography.bodyMedium
                        )
                        if (entry.first) {
                            Box(Modifier.weight(1f)) {
                                WhSlotDropdown(slotOptions.dropLast(1), entry.second) {
                                    days[d] = entry.copy(second = it, third = maxOf(entry.third, it + 1))
                                }
                            }
                            Text("–", modifier = Modifier.padding(horizontal = 4.dp))
                            Box(Modifier.weight(1f)) {
                                WhSlotDropdown(slotOptions.filter { it.first > entry.second }, entry.third) {
                                    days[d] = entry.copy(third = it)
                                }
                            }
                        } else {
                            Text(
                                stringResource(R.string.company_wh_closed),
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                style = MaterialTheme.typography.bodyMedium
                            )
                        }
                    }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 8.dp)) {
                    TextButton(onClick = onDismiss, modifier = Modifier.weight(1f)) {
                        Text(stringResource(R.string.cancel))
                    }
                    Button(
                        onClick = {
                            saving = true
                            val hours = days
                                .filterValues { it.first }
                                .mapValues { (_, v) ->
                                    com.froggyriia.shiftplanner.domain.model.WorkingHoursRange(v.second, v.third)
                                }
                            save(hours) { ok -> saving = false; if (ok) onDismiss() }
                        },
                        enabled = !saving,
                        modifier = Modifier.weight(1f)
                    ) {
                        if (saving) CircularProgressIndicator(Modifier.height(18.dp))
                        else Text(stringResource(R.string.save))
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun WhSlotDropdown(
    options: List<Pair<Int, String>>,
    selected: Int,
    onSelect: (Int) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }
    androidx.compose.material3.ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { expanded = it }) {
        OutlinedTextField(
            value = options.firstOrNull { it.first == selected }?.second ?: "%02d:%02d".format(selected / 2, (selected % 2) * 30),
            onValueChange = {},
            readOnly = true,
            textStyle = MaterialTheme.typography.bodySmall,
            modifier = Modifier.fillMaxWidth().menuAnchor()
        )
        ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            options.forEach { (slot, label) ->
                androidx.compose.material3.DropdownMenuItem(
                    text = { Text(label) },
                    onClick = { onSelect(slot); expanded = false }
                )
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
