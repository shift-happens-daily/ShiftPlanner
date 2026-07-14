package com.froggyriia.shiftplanner.presentation.manager.requirements

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Badge
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.froggyriia.shiftplanner.domain.model.AppUser
import com.froggyriia.shiftplanner.domain.model.RequirementOccurrence
import java.text.SimpleDateFormat
import java.util.Locale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.res.pluralStringResource
import com.froggyriia.shiftplanner.R

private val RU_DAY_LABELS = listOf("Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс")
private val displayFmt = SimpleDateFormat("dd.MM.yyyy", Locale.US)
private val isoFmt    = SimpleDateFormat("yyyy-MM-dd", Locale.US)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RequirementsScreen(user: AppUser, viewModel: RequirementsViewModel) {
    val state by viewModel.uiState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }
    var deleteTarget    by remember { mutableStateOf<RequirementOccurrence?>(null) }
    // dateLabel → list of IDs to batch-delete
    var deleteAllTarget by remember { mutableStateOf<Pair<String, List<Int>>?>(null) }

    LaunchedEffect(Unit) { viewModel.reloadDictionaries() }

    LaunchedEffect(state.statusMessage) {
        state.statusMessage?.let { snackbarHostState.showSnackbar(it); viewModel.clearMessages() }
    }
    LaunchedEffect(state.errorMessage) {
        state.errorMessage?.let { snackbarHostState.showSnackbar(it); viewModel.clearMessages() }
    }
    val context = LocalContext.current
    LaunchedEffect(state.statusMessageRes, state.errorMessageRes) {
        val res = state.statusMessageRes ?: state.errorMessageRes
        if (res != null) {
            snackbarHostState.showSnackbar(context.getString(res, *state.statusMessageArgs.toTypedArray()))
            viewModel.clearMessages()
        }
    }

    if (user.company == null) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text(stringResource(R.string.req_setup_company_first))
        }
        return
    }

    Scaffold(snackbarHost = { SnackbarHost(snackbarHostState) }) { padding ->
        LazyColumn(
            Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(bottom = 32.dp)
        ) {
            item { CreateSection(state = state, viewModel = viewModel) }

            item {
                Column(
                    Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    HorizontalDivider()
                    Spacer(Modifier.height(4.dp))
                    Row(
                        Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(stringResource(R.string.req_created_title), style = MaterialTheme.typography.titleMedium)
                        Badge(
                            containerColor = MaterialTheme.colorScheme.secondaryContainer,
                            contentColor = MaterialTheme.colorScheme.onSecondaryContainer
                        ) {
                            Text(
                                state.requirements.size.toString(),
                                style = MaterialTheme.typography.labelMedium,
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                            )
                        }
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Box(Modifier.weight(1f)) {
                            DatePickerField(
                                label = stringResource(R.string.common_from),
                                value = state.filterStartDate,
                                onValueChange = viewModel::updateFilterStart
                            )
                        }
                        Box(Modifier.weight(1f)) {
                            DatePickerField(
                                label = stringResource(R.string.common_to),
                                value = state.filterEndDate,
                                onValueChange = viewModel::updateFilterEnd
                            )
                        }
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(
                            onClick = { viewModel.loadFiltered() },
                            modifier = Modifier.weight(1f)
                        ) { Text(stringResource(R.string.req_show)) }
                        OutlinedButton(
                            onClick = viewModel::resetFilters,
                            modifier = Modifier.weight(1f)
                        ) { Text(stringResource(R.string.req_reset)) }
                    }
                }
            }

            if (state.isLoading) {
                item {
                    Box(Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator()
                    }
                }
            } else if (state.requirements.isEmpty()) {
                item {
                    Box(Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                        Text(
                            stringResource(R.string.req_none_for_period),
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            } else {
                val grouped = state.requirements.groupBy { formatDate(it.date) }
                grouped.forEach { (dateLabel, reqs) ->
                    item(key = "header_$dateLabel") {
                        DateGroupHeader(
                            dateLabel = dateLabel,
                            count = reqs.size,
                            onDeleteAll = {
                                deleteAllTarget = dateLabel to reqs.map { it.id }
                            }
                        )
                    }
                    items(reqs, key = { it.id }) { req ->
                        RequirementItem(
                            req = req,
                            branchName = viewModel.branchName(req.branchId),
                            onDelete = { deleteTarget = req }
                        )
                    }
                }
            }
        }
    }

    deleteTarget?.let { req ->
        AlertDialog(
            onDismissRequest = { deleteTarget = null },
            title = { Text(stringResource(R.string.req_delete_title)) },
            text = { Text("${req.positionName} · ${formatDate(req.date)}") },
            confirmButton = {
                Button(
                    onClick = { viewModel.deleteRequirement(req); deleteTarget = null },
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
                ) { Text(stringResource(R.string.delete)) }
            },
            dismissButton = { TextButton(onClick = { deleteTarget = null }) { Text(stringResource(R.string.cancel)) } }
        )
    }

    deleteAllTarget?.let { (dateLabel, ids) ->
        AlertDialog(
            onDismissRequest = { deleteAllTarget = null },
            title = { Text(stringResource(R.string.req_delete_all_title, dateLabel)) },
            text = { Text(stringResource(R.string.req_delete_all_text, pluralStringResource(R.plurals.req_plural, ids.size, ids.size))) },
            confirmButton = {
                Button(
                    onClick = { viewModel.deleteRequirements(ids); deleteAllTarget = null },
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
                ) { Text(stringResource(R.string.req_delete_all)) }
            },
            dismissButton = { TextButton(onClick = { deleteAllTarget = null }) { Text(stringResource(R.string.cancel)) } }
        )
    }
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

@Composable
private fun CreateSection(state: RequirementsUiState, viewModel: RequirementsViewModel) {
    var selectedTab by rememberSaveable { mutableStateOf(0) }
    Column(Modifier.fillMaxWidth()) {
        TabRow(selectedTabIndex = selectedTab) {
            Tab(selected = selectedTab == 0, onClick = { selectedTab = 0 },
                text = { Text(stringResource(R.string.req_tab_single)) })
            Tab(selected = selectedTab == 1, onClick = { selectedTab = 1 },
                text = { Text(stringResource(R.string.req_tab_bulk)) })
        }
        when (selectedTab) {
            0 -> SingleRequirementForm(state = state, viewModel = viewModel)
            1 -> BulkCreateForm(state = state, viewModel = viewModel)
        }
    }
}

// ── Single form ───────────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SingleRequirementForm(state: RequirementsUiState, viewModel: RequirementsViewModel) {
    var branchId   by rememberSaveable { mutableStateOf<Int?>(null) }
    var positionId by rememberSaveable { mutableStateOf<Int?>(null) }
    var date       by rememberSaveable { mutableStateOf("") }
    var quantity   by rememberSaveable { mutableStateOf("1") }
    var startSlot  by rememberSaveable { mutableStateOf(18) }  // 09:00
    var endSlot    by rememberSaveable { mutableStateOf(36) }  // 18:00

    Column(
        Modifier.fillMaxWidth().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        if (state.branches.isNotEmpty()) {
            ReqDropdown(
                label = stringResource(R.string.req_branch),
                options = listOf(null to stringResource(R.string.req_any)) + state.branches.map { it.id to it.name },
                selectedId = branchId,
                onSelect = { branchId = it }
            )
        }
        ReqDropdown(
            label = stringResource(R.string.req_position),
            options = state.positions.map { it.id to it.name },
            selectedId = positionId,
            onSelect = { positionId = it }
        )
        DatePickerField(label = stringResource(R.string.req_date), value = date, onValueChange = { date = it })
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Box(Modifier.weight(1f)) {
                OutlinedTextField(
                    value = quantity,
                    onValueChange = { quantity = it.filter { c -> c.isDigit() }.take(3) },
                    label = { Text(stringResource(R.string.req_staff)) },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
            }
            Box(Modifier.weight(1f)) {
                ReqDropdown(stringResource(R.string.req_start), RequirementsViewModel.timeSlots, startSlot) { it?.let { v -> startSlot = v } }
            }
            Box(Modifier.weight(1f)) {
                ReqDropdown(stringResource(R.string.req_end), RequirementsViewModel.timeSlots, endSlot) { it?.let { v -> endSlot = v } }
            }
        }
        Button(
            onClick = {
                viewModel.createRequirement(RequirementDraft(
                    date = date, positionId = positionId, branchId = branchId,
                    quantity = quantity.toIntOrNull()?.coerceAtLeast(1) ?: 1,
                    startSlot = startSlot, endSlot = endSlot
                )) { ok -> if (ok) { date = ""; positionId = null; quantity = "1" } }
            },
            enabled = positionId != null && date.isNotBlank() && endSlot > startSlot,
            modifier = Modifier.fillMaxWidth()
        ) { Text(stringResource(R.string.req_create)) }
    }
}

// ── Bulk form ─────────────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
private fun BulkCreateForm(state: RequirementsUiState, viewModel: RequirementsViewModel) {
    var branchId         by rememberSaveable { mutableStateOf<Int?>(null) }
    var positionId       by rememberSaveable { mutableStateOf<Int?>(null) }
    var startDate        by rememberSaveable { mutableStateOf("") }
    var endDate          by rememberSaveable { mutableStateOf("") }
    var quantity         by rememberSaveable { mutableStateOf("1") }
    var startSlot        by rememberSaveable { mutableStateOf(18) }
    var endSlot          by rememberSaveable { mutableStateOf(36) }
    var selectedWeekdays by rememberSaveable { mutableStateOf(setOf(0, 1, 2, 3, 4)) }

    Column(
        Modifier.fillMaxWidth().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        if (state.branches.isNotEmpty()) {
            ReqDropdown(
                label = stringResource(R.string.req_branch),
                options = listOf(null to stringResource(R.string.req_any)) + state.branches.map { it.id to it.name },
                selectedId = branchId,
                onSelect = { branchId = it }
            )
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Box(Modifier.weight(1f)) {
                DatePickerField(stringResource(R.string.req_period_start), startDate) { startDate = it }
            }
            Box(Modifier.weight(1f)) {
                DatePickerField(stringResource(R.string.req_period_end), endDate) { endDate = it }
            }
        }
        ReqDropdown(
            label = stringResource(R.string.req_position),
            options = state.positions.map { it.id to it.name },
            selectedId = positionId,
            onSelect = { positionId = it }
        )
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Box(Modifier.weight(1f)) {
                OutlinedTextField(
                    value = quantity,
                    onValueChange = { quantity = it.filter { c -> c.isDigit() }.take(3) },
                    label = { Text(stringResource(R.string.req_staff)) },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
            }
            Box(Modifier.weight(1f)) {
                ReqDropdown(stringResource(R.string.req_start), RequirementsViewModel.timeSlots, startSlot) { it?.let { v -> startSlot = v } }
            }
            Box(Modifier.weight(1f)) {
                ReqDropdown(stringResource(R.string.req_end), RequirementsViewModel.timeSlots, endSlot) { it?.let { v -> endSlot = v } }
            }
        }
        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            RU_DAY_LABELS.forEachIndexed { idx, label ->
                FilterChip(
                    selected = idx in selectedWeekdays,
                    onClick = {
                        selectedWeekdays = if (idx in selectedWeekdays)
                            selectedWeekdays - idx else selectedWeekdays + idx
                    },
                    label = { Text(label) }
                )
            }
        }
        Button(
            onClick = {
                val posId = positionId ?: return@Button
                viewModel.createBulk(
                    startDate = startDate, endDate = endDate,
                    weekdays = selectedWeekdays.sorted(),
                    positionId = posId,
                    quantity = quantity.toIntOrNull()?.coerceAtLeast(1) ?: 1,
                    startSlot = startSlot, endSlot = endSlot
                ) { ok -> if (ok) { startDate = ""; endDate = ""; positionId = null; quantity = "1" } }
            },
            enabled = positionId != null && startDate.isNotBlank() && endDate.isNotBlank()
                    && selectedWeekdays.isNotEmpty() && endSlot > startSlot,
            modifier = Modifier.fillMaxWidth()
        ) { Text(stringResource(R.string.req_create)) }
    }
}

// ── Requirement card ──────────────────────────────────────────────────────────

@Composable
private fun RequirementItem(
    req: RequirementOccurrence,
    branchName: String,
    onDelete: () -> Unit
) {
    Card(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp)) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(Modifier.weight(1f)) {
                Text(req.positionName, style = MaterialTheme.typography.bodyLarge)
                Text(
                    buildString {
                        if (branchName.isNotBlank()) { append(branchName); append(" · ") }
                        append(formatDate(req.date))
                    },
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    "${RequirementsViewModel.slotToDisplayTime(req.startSlot)} — " +
                    "${RequirementsViewModel.slotToDisplayTime(req.endSlot)}  · " +
                    stringResource(R.string.req_staff_line, req.quantity),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            Button(
                onClick = onDelete,
                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error),
                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 0.dp),
                modifier = Modifier.height(32.dp)
            ) { Text(stringResource(R.string.delete), style = MaterialTheme.typography.labelSmall) }
        }
    }
}

// ── Date group header ─────────────────────────────────────────────────────────

@Composable
private fun DateGroupHeader(dateLabel: String, count: Int, onDeleteAll: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(start = 16.dp, end = 8.dp, top = 16.dp, bottom = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column {
            Text(
                dateLabel,
                style = MaterialTheme.typography.titleSmall,
                color = MaterialTheme.colorScheme.primary
            )
            Text(
                pluralStringResource(R.plurals.req_plural, count, count),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        TextButton(
            onClick = onDeleteAll,
            colors = androidx.compose.material3.ButtonDefaults.textButtonColors(
                contentColor = MaterialTheme.colorScheme.error
            ),
            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp)
        ) {
            Text(stringResource(R.string.req_delete_all), style = MaterialTheme.typography.labelSmall)
        }
    }
    HorizontalDivider(Modifier.padding(horizontal = 16.dp))
}

private fun pluralReqs(n: Int) = when {
    n % 10 == 1 && n % 100 != 11 -> "требование"
    n % 10 in 2..4 && n % 100 !in 12..14 -> "требования"
    else -> "требований"
}

// ── Date picker field ─────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DatePickerField(label: String, value: String, onValueChange: (String) -> Unit) {
    var showDialog by remember { mutableStateOf(false) }
    val initialMillis = remember(value) { RequirementsViewModel.dateStringToMillis(value) }
    val pickerState = rememberDatePickerState(initialSelectedDateMillis = initialMillis)

    val displayValue = remember(value) {
        if (value.isBlank()) ""
        else runCatching { displayFmt.format(isoFmt.parse(value)!!) }.getOrDefault(value)
    }

    Box {
        OutlinedTextField(
            value = displayValue,
            onValueChange = {},
            readOnly = true,
            label = { Text(label) },
            trailingIcon = { Icon(Icons.Default.DateRange, contentDescription = null) },
            modifier = Modifier.fillMaxWidth()
        )
        Box(Modifier.matchParentSize().clickable { showDialog = true })
    }

    if (showDialog) {
        DatePickerDialog(
            onDismissRequest = { showDialog = false },
            confirmButton = {
                TextButton(onClick = {
                    pickerState.selectedDateMillis?.let {
                        onValueChange(RequirementsViewModel.millisToDateString(it))
                    }
                    showDialog = false
                }) { Text(stringResource(R.string.common_ok)) }
            },
            dismissButton = { TextButton(onClick = { showDialog = false }) { Text(stringResource(R.string.cancel)) } }
        ) {
            DatePicker(state = pickerState)
        }
    }
}

// ── Dropdown ──────────────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ReqDropdown(
    label: String,
    options: List<Pair<Int?, String>>,
    selectedId: Int?,
    onSelect: (Int?) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }
    val selectedLabel = options.firstOrNull { it.first == selectedId }?.second ?: "Выбрать…"

    ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { expanded = it }) {
        OutlinedTextField(
            value = selectedLabel, onValueChange = {}, readOnly = true,
            label = { Text(label) },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded) },
            modifier = Modifier.fillMaxWidth().menuAnchor()
        )
        ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            options.forEach { (id, name) ->
                DropdownMenuItem(text = { Text(name) }, onClick = { onSelect(id); expanded = false })
            }
        }
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

private fun formatDate(date: java.util.Date): String =
    runCatching { displayFmt.format(date) }.getOrDefault("")
