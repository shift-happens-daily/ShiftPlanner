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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EmployeesScreen(
    user: AppUser,
    viewModel: EmployeesViewModel
) {
    LaunchedEffect(Unit) { viewModel.loadData() }

    val state by viewModel.uiState.collectAsState()
    val snackbar = remember { SnackbarHostState() }

    LaunchedEffect(state.statusMessage) {
        state.statusMessage?.let { snackbar.showSnackbar(it); viewModel.clearMessages() }
    }

    var tabIndex by rememberSaveable { mutableIntStateOf(0) }
    var showAddEmployeeSheet by remember { mutableStateOf(false) }
    var showAddPositionDialog by remember { mutableStateOf(false) }
    var employeeToDelete by remember { mutableStateOf<ManagedEmployee?>(null) }
    var positionToDelete by remember { mutableStateOf<ManagedPosition?>(null) }
    var positionPickerEmployee by remember { mutableStateOf<ManagedEmployee?>(null) }
    var branchPickerEmployee by remember { mutableStateOf<ManagedEmployee?>(null) }

    if (!user.hasCompany) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text("Join a company to manage employees")
        }
        return
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Сотрудники") },
                actions = {
                    when (tabIndex) {
                        0 -> IconButton(
                            onClick = { showAddEmployeeSheet = true },
                            enabled = state.positions.isNotEmpty()
                        ) { Icon(Icons.Default.Add, contentDescription = "Добавить сотрудника") }
                        1 -> IconButton(onClick = { showAddPositionDialog = true }) {
                            Icon(Icons.Default.Add, contentDescription = "Добавить должность")
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
                Tab(selected = tabIndex == 0, onClick = { tabIndex = 0 }) { Text("Сотрудники", modifier = Modifier.padding(vertical = 12.dp)) }
                Tab(selected = tabIndex == 1, onClick = { tabIndex = 1 }) { Text("Должности", modifier = Modifier.padding(vertical = 12.dp)) }
                Tab(selected = tabIndex == 2, onClick = { tabIndex = 2 }) {
                    val label = if (pendingCount > 0) "Заявки ($pendingCount)" else "Заявки"
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
                    onAddClick = { showAddEmployeeSheet = true },
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

            state.errorMessage?.let { msg ->
                Text(
                    msg,
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp)
                )
            }
        }
    }

    // ── Add Employee Sheet ────────────────────────────────────────────────────

    if (showAddEmployeeSheet) {
        var draft by remember { mutableStateOf(
            EmployeeCreationDraft(
                positionId = state.positions.firstOrNull()?.id,
                branchId = state.branches.firstOrNull()?.id
            )
        ) }
        ModalBottomSheet(onDismissRequest = { showAddEmployeeSheet = false }) {
            Column(
                modifier = Modifier
                    .padding(horizontal = 20.dp)
                    .padding(bottom = 32.dp)
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text("Add Employee", style = MaterialTheme.typography.headlineSmall)
                OutlinedTextField(
                    value = draft.fullName,
                    onValueChange = { draft = draft.copy(fullName = it) },
                    label = { Text("Full name") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = draft.email,
                    onValueChange = { draft = draft.copy(email = it) },
                    label = { Text("Email") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                NullableDropdown(
                    label = "Position",
                    options = state.positions.map { it.id to it.title },
                    selected = draft.positionId,
                    onSelect = { draft = draft.copy(positionId = it) }
                )
                if (state.branches.isNotEmpty()) {
                    NullableDropdown(
                        label = "Branch (optional)",
                        options = state.branches.map { it.id to it.name },
                        selected = draft.branchId,
                        onSelect = { draft = draft.copy(branchId = it) }
                    )
                }
                Spacer(Modifier.height(8.dp))
                Button(
                    onClick = {
                        viewModel.createEmployee(draft) { success ->
                            if (success) showAddEmployeeSheet = false
                        }
                    },
                    modifier = Modifier.fillMaxWidth()
                ) { Text("Add") }
            }
        }
    }

    // ── Add Position Dialog ───────────────────────────────────────────────────

    if (showAddPositionDialog) {
        var positionName by remember { mutableStateOf("") }
        AlertDialog(
            onDismissRequest = { showAddPositionDialog = false },
            title = { Text("Add position") },
            text = {
                OutlinedTextField(
                    value = positionName,
                    onValueChange = { positionName = it },
                    label = { Text("Position title") },
                    singleLine = true
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.createPosition(positionName)
                    showAddPositionDialog = false
                }) { Text("Add") }
            },
            dismissButton = {
                TextButton(onClick = { showAddPositionDialog = false }) { Text("Cancel") }
            }
        )
    }

    // ── Delete Employee Confirm ───────────────────────────────────────────────

    employeeToDelete?.let { emp ->
        AlertDialog(
            onDismissRequest = { employeeToDelete = null },
            title = { Text("Remove employee?") },
            text = { Text("${emp.fullName} will be removed from the company.") },
            confirmButton = {
                TextButton(
                    onClick = { viewModel.deleteEmployee(emp); employeeToDelete = null },
                ) { Text("Remove", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = {
                TextButton(onClick = { employeeToDelete = null }) { Text("Cancel") }
            }
        )
    }

    // ── Delete Position Confirm ───────────────────────────────────────────────

    positionToDelete?.let { pos ->
        AlertDialog(
            onDismissRequest = { positionToDelete = null },
            title = { Text("Delete position?") },
            text = { Text("\"${pos.title}\" will be deleted. This will fail if it is still in use.") },
            confirmButton = {
                TextButton(
                    onClick = { viewModel.deletePosition(pos); positionToDelete = null }
                ) { Text("Delete", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = {
                TextButton(onClick = { positionToDelete = null }) { Text("Cancel") }
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
                Text("Set position for ${emp.fullName}", style = MaterialTheme.typography.titleMedium)
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
                ) { Text("Remove position", color = MaterialTheme.colorScheme.error) }
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
                Text("Set branch for ${emp.fullName}", style = MaterialTheme.typography.titleMedium)
                TextButton(
                    onClick = {
                        viewModel.assignBranch(emp, null)
                        branchPickerEmployee = null
                    },
                    modifier = Modifier.fillMaxWidth()
                ) { Text("No branch") }
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
    onAddClick: () -> Unit,
    onDeleteEmployee: (ManagedEmployee) -> Unit,
    onPickPosition: (ManagedEmployee) -> Unit,
    onPickBranch: ((ManagedEmployee) -> Unit)?
) {
    if (employees.isEmpty()) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text("No employees yet", color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(Modifier.height(8.dp))
                Button(onClick = onAddClick) { Text("Add employee") }
            }
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
                IconButton(onClick = onDelete) {
                    Icon(Icons.Default.Delete, contentDescription = "Delete", tint = MaterialTheme.colorScheme.error)
                }
            }

            HorizontalDivider()

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                TextButton(onClick = onPickPosition) {
                    Text("Position: $positionTitle", style = MaterialTheme.typography.bodySmall)
                }
                if (onPickBranch != null) {
                    TextButton(onClick = onPickBranch) {
                        Text("Branch: $branchTitle", style = MaterialTheme.typography.bodySmall)
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
                Text("No positions yet", color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(Modifier.height(8.dp))
                Button(onClick = onAddClick) { Text("Add position") }
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
            Text("Нет ожидающих заявок", color = MaterialTheme.colorScheme.onSurfaceVariant)
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
                    "Заявки менеджеров",
                    style = MaterialTheme.typography.titleSmall,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.padding(vertical = 4.dp)
                )
            }
            items(managerRequests, key = { "mgr_${it.id}" }) { req ->
                PendingRequestCard(
                    fullName = req.fullName,
                    email = req.email,
                    subtitle = if (req.managerRole == "owner") "Владелец" else "Менеджер",
                    onAccept = { onAcceptManager(req) },
                    onDecline = { onDeclineManager(req) }
                )
            }
        }

        if (employeeRequests.isNotEmpty()) {
            item {
                if (managerRequests.isNotEmpty()) Spacer(Modifier.height(8.dp))
                Text(
                    "Заявки сотрудников",
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
                Button(onClick = onAccept, modifier = Modifier.weight(1f)) { Text("Принять") }
                TextButton(
                    onClick = onDecline,
                    modifier = Modifier.weight(1f)
                ) { Text("Отклонить", color = MaterialTheme.colorScheme.error) }
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
    val label2 = options.firstOrNull { it.first == selected }?.second ?: "None"

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
            DropdownMenuItem(text = { Text("None") }, onClick = { onSelect(null); expanded = false })
            options.forEach { (id, name) ->
                DropdownMenuItem(text = { Text(name) }, onClick = { onSelect(id); expanded = false })
            }
        }
    }
}
