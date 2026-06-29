package com.froggyriia.shiftplanner.presentation.manager.schedule

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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronLeft
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Badge
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
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
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
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
import androidx.compose.ui.unit.dp
import com.froggyriia.shiftplanner.domain.model.AppAvailableEmployee
import com.froggyriia.shiftplanner.domain.model.AppEmployeeAvailabilityStatus
import com.froggyriia.shiftplanner.domain.model.AppScheduleStatus
import com.froggyriia.shiftplanner.domain.model.AppScheduledShift
import com.froggyriia.shiftplanner.domain.model.AppUnfilledRequirement
import com.froggyriia.shiftplanner.domain.model.AppUser
import java.text.SimpleDateFormat
import java.util.Locale

private val DAY_LABELS = listOf("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ScheduleScreen(
    user: AppUser,
    viewModel: ScheduleViewModel
) {
    val state by viewModel.uiState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }

    // Sheet state
    var showGenerateSheet by rememberSaveable { mutableStateOf(false) }
    var assigningShift by remember { mutableStateOf<AppScheduledShift?>(null) }
    var assigningReq by remember { mutableStateOf<AppUnfilledRequirement?>(null) }
    var deleteShift by remember { mutableStateOf<AppScheduledShift?>(null) }

    LaunchedEffect(state.statusMessage) {
        state.statusMessage?.let { snackbarHostState.showSnackbar(it); viewModel.clearMessages() }
    }
    LaunchedEffect(state.errorMessage) {
        state.errorMessage?.let { snackbarHostState.showSnackbar(it); viewModel.clearMessages() }
    }

    if (user.company == null) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text("No company — set up a company first.")
        }
        return
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Schedule") },
                actions = {
                    val schedule = state.schedule
                    if (schedule != null && schedule.status == AppScheduleStatus.DRAFT) {
                        if (state.isPublishing) {
                            CircularProgressIndicator(modifier = Modifier.padding(end = 12.dp))
                        } else {
                            TextButton(onClick = viewModel::publishSchedule) { Text("Publish") }
                        }
                    }
                }
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) }
    ) { padding ->
        when {
            state.isLoading -> Box(
                Modifier
                    .fillMaxSize()
                    .padding(padding),
                contentAlignment = Alignment.Center
            ) { CircularProgressIndicator() }

            state.schedule == null -> NoScheduleContent(
                weekStart = viewModel.currentWeekStart(),
                weekEnd = viewModel.currentWeekEnd(),
                isGenerating = state.isGenerating,
                onGenerate = { viewModel.generateSchedule(viewModel.currentWeekStart(), viewModel.currentWeekEnd()) },
                onCustomRange = { showGenerateSheet = true }
            )

            else -> ScheduleContent(
                state = state,
                viewModel = viewModel,
                onAssignShift = { shift ->
                    assigningShift = shift
                    viewModel.fetchAvailableEmployees(shift)
                },
                onAssignReq = { req ->
                    assigningReq = req
                    viewModel.fetchAvailableForRequirement(req)
                },
                onDeleteShift = { deleteShift = it }
            )
        }
    }

    // ── Generate with custom date range ───────────────────────────────────────
    if (showGenerateSheet) {
        GenerateDateRangeSheet(
            defaultStart = viewModel.currentWeekStart(),
            defaultEnd = viewModel.currentWeekEnd(),
            isGenerating = state.isGenerating,
            onGenerate = { start, end ->
                viewModel.generateSchedule(start, end)
                showGenerateSheet = false
            },
            onDismiss = { showGenerateSheet = false }
        )
    }

    // ── Assign employee to a shift ────────────────────────────────────────────
    if (assigningShift != null || assigningReq != null) {
        AssignEmployeeSheet(
            employees = state.availableEmployees,
            isLoading = state.loadingEmployees,
            onAssign = { emp ->
                assigningShift?.let { /* shifts already assigned; no separate assign endpoint for shifts */
                    // nothing needed — employee assignment goes through requirement endpoint
                }
                assigningReq?.let { req -> viewModel.assignRequirement(req.id, emp.id) }
                assigningShift = null
                assigningReq = null
                viewModel.clearAvailableEmployees()
            },
            onDismiss = {
                assigningShift = null
                assigningReq = null
                viewModel.clearAvailableEmployees()
            }
        )
    }

    // ── Delete confirm ─────────────────────────────────────────────────────────
    deleteShift?.let { shift ->
        AlertDialog(
            onDismissRequest = { deleteShift = null },
            title = { Text("Delete shift?") },
            text = {
                Text("Remove ${shift.positionName} shift for ${shift.employeeName ?: "unassigned"}?")
            },
            confirmButton = {
                Button(
                    onClick = { viewModel.deleteShift(shift); deleteShift = null },
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
                ) { Text("Delete") }
            },
            dismissButton = {
                TextButton(onClick = { deleteShift = null }) { Text("Cancel") }
            }
        )
    }
}

// ── Sub-composables ───────────────────────────────────────────────────────────

@Composable
private fun NoScheduleContent(
    weekStart: String,
    weekEnd: String,
    isGenerating: Boolean,
    onGenerate: () -> Unit,
    onCustomRange: () -> Unit
) {
    Column(
        Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text("No schedule yet", style = MaterialTheme.typography.headlineSmall)
        Spacer(Modifier.height(8.dp))
        Text(
            "Generate a schedule for $weekStart – $weekEnd",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(Modifier.height(24.dp))
        if (isGenerating) {
            CircularProgressIndicator()
        } else {
            Button(onClick = onGenerate, modifier = Modifier.fillMaxWidth()) {
                Text("Generate this week")
            }
            Spacer(Modifier.height(8.dp))
            OutlinedButton(onClick = onCustomRange, modifier = Modifier.fillMaxWidth()) {
                Text("Pick date range…")
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ScheduleContent(
    state: ScheduleUiState,
    viewModel: ScheduleViewModel,
    onAssignShift: (AppScheduledShift) -> Unit,
    onAssignReq: (AppUnfilledRequirement) -> Unit,
    onDeleteShift: (AppScheduledShift) -> Unit
) {
    val schedule = state.schedule ?: return
    val isDraft = schedule.status == AppScheduleStatus.DRAFT

    Column {
        // Status badge
        Row(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 4.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Badge(
                containerColor = when (schedule.status) {
                    AppScheduleStatus.DRAFT -> MaterialTheme.colorScheme.secondaryContainer
                    AppScheduleStatus.PUBLISHED -> MaterialTheme.colorScheme.primaryContainer
                    AppScheduleStatus.ARCHIVED -> MaterialTheme.colorScheme.surfaceVariant
                }
            ) {
                Text(
                    schedule.status.name,
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                    style = MaterialTheme.typography.labelMedium
                )
            }
            if (isDraft) {
                TextButton(onClick = { viewModel.generateSchedule(
                    viewModel.currentWeekStart(), viewModel.currentWeekEnd()
                ) }) { Text("Regenerate") }
            }
        }

        // Week nav
        Row(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            IconButton(onClick = viewModel::previousWeek) { Icon(Icons.Default.ChevronLeft, "Prev") }
            Text(state.weekLabel, style = MaterialTheme.typography.titleMedium)
            IconButton(onClick = viewModel::nextWeek) { Icon(Icons.Default.ChevronRight, "Next") }
        }

        LazyColumn(Modifier.fillMaxSize()) {
            state.weekDates.forEachIndexed { index, date ->
                val shifts = viewModel.shiftsForDate(date)
                val unfilled = viewModel.unfilledForDate(date)

                if (shifts.isEmpty() && unfilled.isEmpty()) return@forEachIndexed

                item(key = "header_$date") {
                    ScheduleDayHeader(dayLabel = DAY_LABELS[index], date = date)
                }

                items(shifts, key = { "shift_${it.id}" }) { shift ->
                    ShiftCard(
                        shift = shift,
                        isDraft = isDraft,
                        onAssign = { onAssignShift(shift) },
                        onDelete = { onDeleteShift(shift) }
                    )
                }

                items(unfilled, key = { "req_${it.id}" }) { req ->
                    UnfilledRequirementCard(
                        req = req,
                        isDraft = isDraft,
                        onAssign = { onAssignReq(req) }
                    )
                }

                item(key = "divider_$date") { HorizontalDivider() }
            }
            item { Spacer(Modifier.height(16.dp)) }
        }
    }
}

@Composable
private fun ScheduleDayHeader(dayLabel: String, date: String) {
    val displayDate = remember(date) {
        try {
            val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.US)
            val out = SimpleDateFormat("MMM d", Locale.US)
            "$dayLabel, ${out.format(sdf.parse(date)!!)}"
        } catch (_: Exception) { dayLabel }
    }
    Text(
        displayDate,
        style = MaterialTheme.typography.titleSmall,
        modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 4.dp)
    )
}

@Composable
private fun ShiftCard(
    shift: AppScheduledShift,
    isDraft: Boolean,
    onAssign: () -> Unit,
    onDelete: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 3.dp)
    ) {
        Row(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(Modifier.weight(1f)) {
                Text(
                    shift.employeeName ?: "Unassigned",
                    style = MaterialTheme.typography.bodyLarge
                )
                Text(
                    "${shift.positionName}  •  " +
                    "${ScheduleViewModel.minutesToDisplay(shift.startMinutes)} – " +
                    ScheduleViewModel.minutesToDisplay(shift.endMinutes),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            if (isDraft) {
                if (!shift.hasAssignedEmployee) {
                    IconButton(onClick = onAssign) {
                        Icon(Icons.Default.PersonAdd, "Assign employee")
                    }
                }
                IconButton(onClick = onDelete) {
                    Icon(Icons.Default.Delete, "Delete shift")
                }
            }
        }
    }
}

@Composable
private fun UnfilledRequirementCard(
    req: AppUnfilledRequirement,
    isDraft: Boolean,
    onAssign: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 3.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.5f)
        )
    ) {
        Row(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(Modifier.weight(1f)) {
                Text(
                    "Unfilled: ${req.positionTitle}",
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.error
                )
                Text(
                    "${ScheduleViewModel.minutesToDisplay(req.startMinutes)} – " +
                    "${ScheduleViewModel.minutesToDisplay(req.endMinutes)}  " +
                    "×${req.missingStaff} missing",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            if (isDraft) {
                IconButton(onClick = onAssign) {
                    Icon(Icons.Default.PersonAdd, "Assign employee")
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AssignEmployeeSheet(
    employees: List<AppAvailableEmployee>,
    isLoading: Boolean,
    onAssign: (AppAvailableEmployee) -> Unit,
    onDismiss: () -> Unit
) {
    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            Modifier
                .fillMaxWidth()
                .padding(bottom = 32.dp)
        ) {
            Text(
                "Select Employee",
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
            )
            if (isLoading) {
                Box(Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            } else if (employees.isEmpty()) {
                Text(
                    "No available employees",
                    modifier = Modifier.padding(16.dp),
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            } else {
                LazyColumn {
                    items(employees) { emp ->
                        Row(
                            Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp, vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(Modifier.weight(1f)) {
                                Text(emp.fullName, style = MaterialTheme.typography.bodyLarge)
                                Text(
                                    "${emp.positionName}  •  ${
                                        if (emp.availabilityStatus == AppEmployeeAvailabilityStatus.AVAILABLE) "✓ Available"
                                        else "△ If needed"
                                    }  •  ${emp.assignedHours}h",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                            TextButton(onClick = { onAssign(emp) }) { Text("Assign") }
                        }
                        HorizontalDivider()
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun GenerateDateRangeSheet(
    defaultStart: String,
    defaultEnd: String,
    isGenerating: Boolean,
    onGenerate: (String, String) -> Unit,
    onDismiss: () -> Unit
) {
    var startDate by rememberSaveable { mutableStateOf(defaultStart) }
    var endDate by rememberSaveable { mutableStateOf(defaultEnd) }

    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp)
                .padding(bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text("Generate Schedule", style = MaterialTheme.typography.titleMedium)
            OutlinedTextField(
                value = startDate,
                onValueChange = { startDate = it },
                label = { Text("Start date (yyyy-MM-dd)") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
            OutlinedTextField(
                value = endDate,
                onValueChange = { endDate = it },
                label = { Text("End date (yyyy-MM-dd)") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                TextButton(onClick = onDismiss, modifier = Modifier.weight(1f)) { Text("Cancel") }
                Button(
                    onClick = { onGenerate(startDate, endDate) },
                    enabled = !isGenerating && startDate.isNotBlank() && endDate.isNotBlank(),
                    modifier = Modifier.weight(1f)
                ) {
                    if (isGenerating) CircularProgressIndicator(modifier = Modifier.height(18.dp))
                    else Text("Generate")
                }
            }
        }
    }
}
