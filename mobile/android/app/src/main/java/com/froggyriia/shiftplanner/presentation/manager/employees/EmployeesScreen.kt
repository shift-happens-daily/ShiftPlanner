package com.froggyriia.shiftplanner.presentation.manager.employees

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Link
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.froggyriia.shiftplanner.domain.model.AppUser
import com.froggyriia.shiftplanner.domain.model.ManagedEmployee
import com.froggyriia.shiftplanner.domain.model.ManagedPosition
import com.froggyriia.shiftplanner.domain.model.PendingEmployeeRequest
import com.froggyriia.shiftplanner.domain.model.PendingManagerRequest
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import com.froggyriia.shiftplanner.R
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.text.input.KeyboardType

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EmployeesScreen(
    user: AppUser,
    viewModel: EmployeesViewModel
) {
    LaunchedEffect(Unit) { viewModel.loadData() }

    val state by viewModel.uiState.collectAsState()
    val snackbar = remember { SnackbarHostState() }

    val context = LocalContext.current
    LaunchedEffect(state.statusMessage) {
        state.statusMessage?.let { snackbar.showSnackbar(it); viewModel.clearMessages() }
    }
    LaunchedEffect(state.statusMessageRes) {
        state.statusMessageRes?.let {
            snackbar.showSnackbar(context.getString(it, *state.statusMessageArgs.toTypedArray()))
            viewModel.clearMessages()
        }
    }

    var tabIndex by rememberSaveable { mutableIntStateOf(0) }
    var showLinkByIdSheet by remember { mutableStateOf(false) }
    var showAddPositionDialog by remember { mutableStateOf(false) }
    var employeeToDelete by remember { mutableStateOf<ManagedEmployee?>(null) }
    var workLimitsTarget by remember { mutableStateOf<ManagedEmployee?>(null) }
    workLimitsTarget?.let { emp ->
        WorkLimitsSheet(
            employee = emp,
            load = { onResult -> viewModel.loadWorkLimits(emp.id, onResult) },
            save = { week, day, onDone -> viewModel.saveWorkLimits(emp.id, week, day, onDone) },
            onDismiss = { workLimitsTarget = null }
        )
    }

    var positionToDelete by remember { mutableStateOf<ManagedPosition?>(null) }
    var positionPickerEmployee by remember { mutableStateOf<ManagedEmployee?>(null) }
    var branchPickerEmployee by remember { mutableStateOf<ManagedEmployee?>(null) }

    if (!user.hasCompany) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text(stringResource(R.string.emp_join_hint))
        }
        return
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.emp_title)) },
                actions = {
                    when (tabIndex) {
                        0 -> IconButton(onClick = { showLinkByIdSheet = true }) {
                            Icon(Icons.Default.Link, contentDescription = stringResource(R.string.emp_link_by_id))
                        }
                        1 -> IconButton(onClick = { showAddPositionDialog = true }) {
                            Icon(Icons.Default.Add, contentDescription = stringResource(R.string.emp_add_position))
                        }
                        2 -> IconButton(onClick = { viewModel.loadPendingRequests() }) {
                            Icon(Icons.Default.Refresh, contentDescription = stringResource(R.string.emp_refresh_requests))
                        }
                    }
                }
            )
        },
        snackbarHost = { SnackbarHost(snackbar) }
    ) { padding ->
        Column(modifier = Modifier.padding(padding)) {
            val pendingCount = state.pendingManagerRequests.size + state.pendingEmployeeRequests.size
            TabRow(selectedTabIndex = tabIndex) {
                Tab(selected = tabIndex == 0, onClick = { tabIndex = 0 }) { Text(stringResource(R.string.emp_tab_employees), modifier = Modifier.padding(vertical = 12.dp)) }
                Tab(selected = tabIndex == 1, onClick = { tabIndex = 1 }) { Text(stringResource(R.string.emp_tab_positions), modifier = Modifier.padding(vertical = 12.dp)) }
                Tab(selected = tabIndex == 2, onClick = { tabIndex = 2 }) {
                    val label = if (pendingCount > 0) stringResource(R.string.emp_tab_requests_n, pendingCount) else stringResource(R.string.emp_tab_requests)
                    Text(label, modifier = Modifier.padding(vertical = 12.dp))
                }
            }

            if (state.isLoading) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            } else when (tabIndex) {
                0 -> EmployeeListTab(
                    employees = state.employees,
                    viewModel = viewModel,
                    onEditLimits = { workLimitsTarget = it },
                    onDeleteEmployee = { employeeToDelete = it },
                    onPickPosition = { positionPickerEmployee = it },
                    onPickBranch = if (state.branches.isNotEmpty()) { { branchPickerEmployee = it } } else null
                )
                1 -> PositionListTab(
                    positions = state.positions,
                    onAddClick = { showAddPositionDialog = true },
                    onDeletePosition = { positionToDelete = it }
                )
                2 -> PendingRequestsTab(
                    managerRequests = state.pendingManagerRequests,
                    employeeRequests = state.pendingEmployeeRequests,
                    onAcceptManager = { viewModel.acceptManagerRequest(it) },
                    onDeclineManager = { viewModel.declineManagerRequest(it) },
                    onAcceptEmployee = { viewModel.acceptEmployeeRequest(it) },
                    onDeclineEmployee = { viewModel.declineEmployeeRequest(it) }
                )
            }

            (state.errorMessage ?: state.errorMessageRes?.let { stringResource(it) })?.let { msg ->
                Text(
                    msg,
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp)
                )
            }
        }
    }

    // ── Link by Public ID Sheet ───────────────────────────────────────────────

    if (showLinkByIdSheet) {
        var publicId by remember { mutableStateOf("") }
        var linkBranchId by remember { mutableStateOf<Int?>(null) }
        var linkPositionId by remember { mutableStateOf<Int?>(null) }
        ModalBottomSheet(onDismissRequest = { showLinkByIdSheet = false }) {
            Column(
                modifier = Modifier
                    .padding(horizontal = 20.dp)
                    .padding(bottom = 32.dp)
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text(stringResource(R.string.emp_add_by_id), style = MaterialTheme.typography.headlineSmall)
                OutlinedTextField(
                    value = publicId,
                    onValueChange = { if (it.length <= 16) publicId = it },
                    label = { Text(stringResource(R.string.emp_public_id_label)) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    supportingText = { Text("${publicId.length}/16") }
                )
                if (state.branches.isNotEmpty()) {
                    NullableDropdown(
                        label = stringResource(R.string.invite_branch_optional),
                        options = state.branches.map { it.id to it.name },
                        selected = linkBranchId,
                        onSelect = { linkBranchId = it }
                    )
                }
                if (state.positions.isNotEmpty()) {
                    NullableDropdown(
                        label = stringResource(R.string.invite_position_optional),
                        options = state.positions.map { it.id to it.title },
                        selected = linkPositionId,
                        onSelect = { linkPositionId = it }
                    )
                }
                Spacer(Modifier.height(8.dp))
                Button(
                    onClick = {
                        viewModel.linkEmployeeByPublicId(publicId, linkBranchId, linkPositionId) { success ->
                            if (success) showLinkByIdSheet = false
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                    enabled = publicId.length == 16
                ) { Text(stringResource(R.string.emp_link_button)) }
            }
        }
    }

    // ── Add Position Dialog ───────────────────────────────────────────────────

    if (showAddPositionDialog) {
        var positionName by remember { mutableStateOf("") }
        AlertDialog(
            onDismissRequest = { showAddPositionDialog = false },
            title = { Text(stringResource(R.string.emp_add_position)) },
            text = {
                OutlinedTextField(
                    value = positionName,
                    onValueChange = { positionName = it },
                    label = { Text(stringResource(R.string.emp_position_title)) },
                    singleLine = true
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.createPosition(positionName)
                    showAddPositionDialog = false
                }) { Text(stringResource(R.string.add)) }
            },
            dismissButton = {
                TextButton(onClick = { showAddPositionDialog = false }) { Text(stringResource(R.string.cancel)) }
            }
        )
    }

    // ── Delete Employee Confirm ───────────────────────────────────────────────

    employeeToDelete?.let { emp ->
        AlertDialog(
            onDismissRequest = { employeeToDelete = null },
            title = { Text(stringResource(R.string.emp_remove_employee_title)) },
            text = { Text(stringResource(R.string.emp_remove_employee_text, emp.fullName)) },
            confirmButton = {
                TextButton(
                    onClick = { viewModel.deleteEmployee(emp); employeeToDelete = null },
                ) { Text(stringResource(R.string.common_remove), color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = {
                TextButton(onClick = { employeeToDelete = null }) { Text(stringResource(R.string.cancel)) }
            }
        )
    }

    // ── Delete Position Confirm ───────────────────────────────────────────────

    positionToDelete?.let { pos ->
        AlertDialog(
            onDismissRequest = { positionToDelete = null },
            title = { Text(stringResource(R.string.emp_delete_position_title)) },
            text = { Text(stringResource(R.string.emp_delete_position_text, pos.title)) },
            confirmButton = {
                TextButton(
                    onClick = { viewModel.deletePosition(pos); positionToDelete = null }
                ) { Text(stringResource(R.string.delete), color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = {
                TextButton(onClick = { positionToDelete = null }) { Text(stringResource(R.string.cancel)) }
            }
        )
    }

    // ── Position Picker Sheet ─────────────────────────────────────────────────

    positionPickerEmployee?.let { emp ->
        ModalBottomSheet(onDismissRequest = { positionPickerEmployee = null }) {
            Column(
                modifier = Modifier.padding(horizontal = 20.dp).padding(bottom = 32.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text(stringResource(R.string.emp_set_position_for, emp.fullName), style = MaterialTheme.typography.titleMedium)
                state.positions.forEach { pos ->
                    val isSelected = emp.positionId == pos.id
                    TextButton(
                        onClick = {
                            viewModel.assignPosition(emp, pos.id)
                            positionPickerEmployee = null
                        },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            pos.title,
                            color = if (isSelected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface
                        )
                    }
                }
                TextButton(
                    onClick = {
                        viewModel.assignPosition(emp, null)
                        positionPickerEmployee = null
                    },
                    modifier = Modifier.fillMaxWidth()
                ) { Text(stringResource(R.string.emp_remove_position), color = MaterialTheme.colorScheme.error) }
            }
        }
    }

    // ── Branch Picker Sheet ───────────────────────────────────────────────────

    branchPickerEmployee?.let { emp ->
        ModalBottomSheet(onDismissRequest = { branchPickerEmployee = null }) {
            Column(
                modifier = Modifier.padding(horizontal = 20.dp).padding(bottom = 32.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text(stringResource(R.string.emp_set_branch_for, emp.fullName), style = MaterialTheme.typography.titleMedium)
                TextButton(
                    onClick = {
                        viewModel.assignBranch(emp, null)
                        branchPickerEmployee = null
                    },
                    modifier = Modifier.fillMaxWidth()
                ) { Text(stringResource(R.string.emp_no_branch)) }
                state.branches.forEach { branch ->
                    val isSelected = emp.branchId == branch.id
                    TextButton(
                        onClick = {
                            viewModel.assignBranch(emp, branch.id)
                            branchPickerEmployee = null
                        },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            branch.name,
                            color = if (isSelected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface
                        )
                    }
                }
            }
        }
    }
}

// ── Employee List Tab ──────────────────────────────────────────────────────────

@Composable
private fun EmployeeListTab(
    employees: List<ManagedEmployee>,
    viewModel: EmployeesViewModel,
    onEditLimits: (ManagedEmployee) -> Unit,
    onDeleteEmployee: (ManagedEmployee) -> Unit,
    onPickPosition: (ManagedEmployee) -> Unit,
    onPickBranch: ((ManagedEmployee) -> Unit)?
) {
    if (employees.isEmpty()) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text(stringResource(R.string.emp_none), color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        return
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        items(employees, key = { it.id }) { emp ->
            EmployeeCard(
                employee = emp,
                positionTitle = viewModel.positionTitle(emp),
                branchTitle = viewModel.branchTitle(emp),
                onPickPosition = { onPickPosition(emp) },
                onPickBranch = onPickBranch?.let { { it(emp) } },
                onEditLimits = { onEditLimits(emp) },
                onDelete = { onDeleteEmployee(emp) }
            )
        }
    }
}

@Composable
private fun EmployeeCard(
    employee: ManagedEmployee,
    positionTitle: String,
    branchTitle: String,
    onPickPosition: () -> Unit,
    onPickBranch: (() -> Unit)?,
    onEditLimits: () -> Unit,
    onDelete: () -> Unit
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(employee.fullName, style = MaterialTheme.typography.titleMedium)
                    Text(employee.email, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                IconButton(onClick = onEditLimits) {
                    Icon(Icons.Default.Schedule, contentDescription = stringResource(R.string.emp_edit_limits))
                }
                IconButton(onClick = onDelete) {
                    Icon(Icons.Default.Delete, contentDescription = "Delete", tint = MaterialTheme.colorScheme.error)
                }
            }

            HorizontalDivider()

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                TextButton(onClick = onPickPosition) {
                    Text(stringResource(R.string.emp_position_line, positionTitle), style = MaterialTheme.typography.bodySmall)
                }
                if (onPickBranch != null) {
                    TextButton(onClick = onPickBranch) {
                        Text(stringResource(R.string.emp_branch_line, branchTitle), style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
        }
    }
}

// ── Position List Tab ──────────────────────────────────────────────────────────

@Composable
private fun PositionListTab(
    positions: List<ManagedPosition>,
    onAddClick: () -> Unit,
    onDeletePosition: (ManagedPosition) -> Unit
) {
    if (positions.isEmpty()) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(stringResource(R.string.emp_no_positions), color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(Modifier.height(8.dp))
                Button(onClick = onAddClick) { Text(stringResource(R.string.emp_add_position)) }
            }
        }
        return
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        items(positions, key = { it.id }) { pos ->
            Card(modifier = Modifier.fillMaxWidth()) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp).fillMaxWidth()
                ) {
                    Text(pos.title, style = MaterialTheme.typography.bodyLarge)
                    IconButton(onClick = { onDeletePosition(pos) }) {
                        Icon(Icons.Default.Delete, contentDescription = "Delete", tint = MaterialTheme.colorScheme.error)
                    }
                }
            }
        }
    }
}

// ── Pending Requests Tab ───────────────────────────────────────────────────────

@Composable
private fun PendingRequestsTab(
    managerRequests: List<PendingManagerRequest>,
    employeeRequests: List<PendingEmployeeRequest>,
    onAcceptManager: (PendingManagerRequest) -> Unit,
    onDeclineManager: (PendingManagerRequest) -> Unit,
    onAcceptEmployee: (PendingEmployeeRequest) -> Unit,
    onDeclineEmployee: (PendingEmployeeRequest) -> Unit
) {
    if (managerRequests.isEmpty() && employeeRequests.isEmpty()) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text(stringResource(R.string.emp_no_requests), color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        return
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        if (managerRequests.isNotEmpty()) {
            item {
                Text(
                    stringResource(R.string.emp_manager_requests),
                    style = MaterialTheme.typography.titleSmall,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.padding(vertical = 4.dp)
                )
            }
            items(managerRequests, key = { "mgr_${it.id}" }) { req ->
                PendingRequestCard(
                    fullName = req.fullName,
                    email = req.email,
                    subtitle = if (req.managerRole == "owner") stringResource(R.string.emp_owner) else stringResource(R.string.emp_manager),
                    onAccept = { onAcceptManager(req) },
                    onDecline = { onDeclineManager(req) }
                )
            }
        }

        if (employeeRequests.isNotEmpty()) {
            item {
                if (managerRequests.isNotEmpty()) Spacer(Modifier.height(8.dp))
                Text(
                    stringResource(R.string.emp_employee_requests),
                    style = MaterialTheme.typography.titleSmall,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.padding(vertical = 4.dp)
                )
            }
            items(employeeRequests, key = { "emp_${it.id}" }) { req ->
                PendingRequestCard(
                    fullName = req.fullName,
                    email = req.email,
                    subtitle = null,
                    onAccept = { onAcceptEmployee(req) },
                    onDecline = { onDeclineEmployee(req) }
                )
            }
        }
    }
}

@Composable
private fun PendingRequestCard(
    fullName: String,
    email: String,
    subtitle: String?,
    onAccept: () -> Unit,
    onDecline: () -> Unit
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(fullName, style = MaterialTheme.typography.titleMedium)
                    Text(email, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    if (subtitle != null) {
                        Text(subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.secondary)
                    }
                }
            }
            HorizontalDivider()
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = onAccept, modifier = Modifier.weight(1f)) { Text(stringResource(R.string.emp_accept)) }
                TextButton(
                    onClick = onDecline,
                    modifier = Modifier.weight(1f)
                ) { Text(stringResource(R.string.emp_decline), color = MaterialTheme.colorScheme.error) }
            }
        }
    }
}

// ── Dropdown helper ───────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun NullableDropdown(
    label: String,
    options: List<Pair<Int, String>>,
    selected: Int?,
    onSelect: (Int?) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }
    val label2 = options.firstOrNull { it.first == selected }?.second ?: stringResource(R.string.common_none)

    ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { expanded = it }) {
        OutlinedTextField(
            value = label2,
            onValueChange = {},
            readOnly = true,
            label = { Text(label) },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
            modifier = Modifier.fillMaxWidth().menuAnchor()
        )
        ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            DropdownMenuItem(text = { Text(stringResource(R.string.common_none)) }, onClick = { onSelect(null); expanded = false })
            options.forEach { (id, name) ->
                DropdownMenuItem(text = { Text(name) }, onClick = { onSelect(id); expanded = false })
            }
        }
    }
}


// ── Work-hours limits sheet ─────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun WorkLimitsSheet(
    employee: ManagedEmployee,
    load: ((com.froggyriia.shiftplanner.domain.model.WorkLimits?) -> Unit) -> Unit,
    save: (Int, Int, (Boolean) -> Unit) -> Unit,
    onDismiss: () -> Unit
) {
    var loading by remember { mutableStateOf(true) }
    var saving by remember { mutableStateOf(false) }
    var maxWeek by remember { mutableStateOf("40") }
    var maxDay by remember { mutableStateOf("12") }

    LaunchedEffect(Unit) {
        load { limits ->
            if (limits != null) {
                maxWeek = limits.maxHoursPerWeek.toString()
                maxDay = limits.maxHoursPerDay.toString()
            }
            loading = false
        }
    }

    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            Modifier.fillMaxWidth().padding(horizontal = 16.dp).padding(bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                "${stringResource(R.string.emp_work_limits_title)} — ${employee.fullName}",
                style = MaterialTheme.typography.titleMedium
            )
            if (loading) {
                Box(Modifier.fillMaxWidth().padding(24.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            } else {
                OutlinedTextField(
                    value = maxWeek,
                    onValueChange = { v -> if (v.all { it.isDigit() } && v.length <= 3) maxWeek = v },
                    label = { Text(stringResource(R.string.emp_max_week)) },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = maxDay,
                    onValueChange = { v -> if (v.all { it.isDigit() } && v.length <= 2) maxDay = v },
                    label = { Text(stringResource(R.string.emp_max_day)) },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    TextButton(onClick = onDismiss, modifier = Modifier.weight(1f)) {
                        Text(stringResource(R.string.cancel))
                    }
                    Button(
                        onClick = {
                            val week = maxWeek.toIntOrNull() ?: return@Button
                            val day = (maxDay.toIntOrNull() ?: return@Button).coerceIn(1, 24)
                            saving = true
                            save(week.coerceAtLeast(1), day) { ok -> saving = false; if (ok) onDismiss() }
                        },
                        enabled = !saving && maxWeek.isNotBlank() && maxDay.isNotBlank(),
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
