package com.froggyriia.shiftplanner.presentation.manager.schedule

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.MediaStore
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.ChevronLeft
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.List
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Badge
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.IconButtonDefaults
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
import androidx.compose.material3.VerticalDivider
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
import androidx.compose.ui.platform.LocalContext
import androidx.core.net.toUri
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.rememberDatePickerState
import com.froggyriia.shiftplanner.domain.model.AppAvailableEmployee
import com.froggyriia.shiftplanner.domain.model.AppBranchOption
import com.froggyriia.shiftplanner.domain.model.AppEmployeeAvailabilityStatus
import com.froggyriia.shiftplanner.domain.model.AppScheduleStatus
import com.froggyriia.shiftplanner.domain.model.AppScheduledShift
import com.froggyriia.shiftplanner.domain.model.AppUnfilledRequirement
import com.froggyriia.shiftplanner.domain.model.AppUser
import com.froggyriia.shiftplanner.domain.model.RequirementPositionOption
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import androidx.compose.ui.res.stringResource
import com.froggyriia.shiftplanner.R

private val DAY_LABELS = listOf("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")

/** Cross-branch assignment awaiting user confirmation. */
private data class PendingReqAssignment(
    val requirement: AppUnfilledRequirement,
    val employee: AppAvailableEmployee
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ScheduleScreen(
    user: AppUser,
    viewModel: ScheduleViewModel
) {
    val state by viewModel.uiState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }

    val context = LocalContext.current
    val dateFmt = remember { SimpleDateFormat("yyyy-MM-dd", Locale.US) }
    var showGenerateSheet by rememberSaveable { mutableStateOf(false) }
    var showDeleteScheduleDialog by remember { mutableStateOf(false) }
    var showPublishConfirmDialog by remember { mutableStateOf(false) }
    var shiftDraft by remember { mutableStateOf<ShiftDraft?>(null) }
    // When true: edit sheet is hidden, assign sheet is open; on selection we restore the draft
    var draftWaitingForEmployee by remember { mutableStateOf(false) }
    var unfilledDraft by remember { mutableStateOf<UnfilledReqDraft?>(null) }
    var assigningShift by remember { mutableStateOf<AppScheduledShift?>(null) }
    var assigningReq by remember { mutableStateOf<AppUnfilledRequirement?>(null) }
    var deleteShiftTarget by remember { mutableStateOf<AppScheduledShift?>(null) }
    // Requirement + employee pending confirmation because the employee belongs
    // to another branch (the backend will keep counting the requirement as
    // unfilled even though the shift is created).
    var crossBranchReqAssign by remember {
        mutableStateOf<PendingReqAssignment?>(null)
    }

    // Data may be edited in other tabs (or on the web) — reload on each visit.
    LaunchedEffect(Unit) { viewModel.refresh(silent = true) }

    LaunchedEffect(state.statusMessage) {
        state.statusMessage?.let { snackbarHostState.showSnackbar(it); viewModel.clearMessages() }
    }
    LaunchedEffect(state.errorMessage) {
        state.errorMessage?.let { snackbarHostState.showSnackbar(it); viewModel.clearMessages() }
    }
    LaunchedEffect(state.statusMessageRes, state.errorMessageRes) {
        val res = state.statusMessageRes ?: state.errorMessageRes
        if (res != null) {
            val args = if (state.statusMessageRes != null) state.statusMessageArgs else state.errorMessageArgs
            snackbarHostState.showSnackbar(context.getString(res, *args.toTypedArray()))
            viewModel.clearMessages()
        }
    }

    if (user.company == null) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text(stringResource(R.string.sch_no_company))
        }
        return
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.nav_schedule)) },
                actions = {
                    // Manual refresh: changes made in the web app don't arrive
                    // automatically.
                    IconButton(onClick = viewModel::refresh, enabled = !state.isLoading) {
                        Icon(Icons.Default.Refresh, contentDescription = stringResource(R.string.common_refresh))
                    }
                    val schedule = state.schedule
                    if (schedule != null) {
                        IconButton(onClick = { showDeleteScheduleDialog = true }) {
                            Icon(Icons.Default.Delete, contentDescription = stringResource(R.string.sch_delete_schedule),
                                tint = MaterialTheme.colorScheme.error)
                        }
                        IconButton(
                            onClick = {
                                val csv = viewModel.buildScheduleCsv()
                                val uri = saveScheduleCsv(context, csv)
                                if (uri != null) shareFile(context, uri, "text/csv")
                            }
                        ) {
                            Icon(Icons.Default.Download, contentDescription = stringResource(R.string.common_export_csv))
                        }
                        if (schedule.status == AppScheduleStatus.DRAFT) {
                            if (state.isPublishing) {
                                CircularProgressIndicator(modifier = Modifier.padding(end = 12.dp))
                            } else {
                                TextButton(onClick = {
                                    val hasUnfilled = schedule.shifts.any { !it.hasAssignedEmployee } ||
                                        schedule.unfilledRequirements.isNotEmpty()
                                    if (hasUnfilled) showPublishConfirmDialog = true
                                    else viewModel.publishSchedule()
                                }) { Text(stringResource(R.string.schedule_publish)) }
                            }
                        }
                    }
                }
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) }
    ) { padding ->
        when {
            state.isLoading -> Box(
                Modifier.fillMaxSize().padding(padding),
                contentAlignment = Alignment.Center
            ) { CircularProgressIndicator() }

            state.schedule == null -> NoScheduleContent(
                weekStart = viewModel.currentWeekStart(),
                weekEnd = viewModel.currentWeekEnd(),
                isGenerating = state.isGenerating,
                onGenerate = { viewModel.generateSchedule(viewModel.currentWeekStart(), viewModel.currentWeekEnd()) },
                onCustomRange = { showGenerateSheet = true },
                modifier = Modifier.padding(padding)
            )

            else -> ScheduleContent(
                state = state,
                viewModel = viewModel,
                modifier = Modifier.padding(padding),
                onAddShift = { date -> shiftDraft = ShiftDraft(date = date) },
                onEditShift = { shift ->
                    shiftDraft = ShiftDraft(
                        shiftId = shift.id,
                        date = dateFmt.format(shift.date),
                        positionId = shift.positionId,
                        startMinutes = shift.startMinutes,
                        endMinutes = shift.endMinutes,
                        employeeId = shift.employeeId,
                        employeeName = shift.employeeName
                    )
                },
                onAssignShift = { shift ->
                    assigningShift = shift
                    viewModel.fetchAvailableEmployees(shift)
                },
                onEditReq = { req ->
                    unfilledDraft = UnfilledReqDraft(
                        requirementId = req.id,
                        date = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(req.date),
                        positionId = req.positionId,
                        startMinutes = req.startMinutes,
                        endMinutes = req.endMinutes,
                        quantity = req.missingStaff
                    )
                },
                onAssignReq = { req ->
                    assigningReq = req
                    viewModel.fetchAvailableForRequirement(req)
                },
                onDeleteShift = { deleteShiftTarget = it }
            )
        }
    }

    // ── Generate sheet ────────────────────────────────────────────────────────
    if (showGenerateSheet) {
        GenerateDateRangeSheet(
            defaultStart = viewModel.currentWeekStart(),
            branches = state.branches,
            isGenerating = state.isGenerating,
            onGenerate = { start, end, branchId ->
                viewModel.generateSchedule(start, end, branchId)
                showGenerateSheet = false
            },
            onDismiss = { showGenerateSheet = false }
        )
    }

    // ── Create / Edit shift sheet ─────────────────────────────────────────────
    // Only show edit sheet when not waiting for employee pick
    if (shiftDraft != null && !draftWaitingForEmployee) {
        val draft = shiftDraft!!
        ShiftEditSheet(
            draft = draft,
            positions = state.positions,
            onDraftChange = { shiftDraft = it },
            onSave = {
                if (draft.shiftId == null) {
                    viewModel.createShift(draft) { ok -> if (ok) shiftDraft = null }
                } else {
                    viewModel.updateShift(draft) { ok -> if (ok) shiftDraft = null }
                }
            },
            onChangeEmployee = {
                // Temporarily hide edit sheet, open assign sheet
                val positionId = draft.positionId ?: return@ShiftEditSheet
                val fakeShift = AppScheduledShift(
                    id = draft.shiftId ?: 0,
                    employeeId = draft.employeeId,
                    employeeName = draft.employeeName,
                    positionId = positionId,
                    positionName = state.positions.firstOrNull { it.id == positionId }?.name ?: "",
                    date = runCatching { dateFmt.parse(draft.date)!! }.getOrDefault(java.util.Date()),
                    startMinutes = draft.startMinutes,
                    endMinutes = draft.endMinutes
                )
                draftWaitingForEmployee = true
                viewModel.fetchAvailableEmployees(fakeShift)
            },
            onDismiss = { shiftDraft = null }
        )
    }

    // ── Edit unfilled requirement sheet ───────────────────────────────────────
    unfilledDraft?.let { draft ->
        UnfilledReqEditSheet(
            draft = draft,
            positions = state.positions,
            onDraftChange = { unfilledDraft = it },
            onSave = {
                viewModel.updateScheduleRequirement(draft) { ok -> if (ok) unfilledDraft = null }
            },
            onDismiss = { unfilledDraft = null }
        )
    }

    // ── Assign employee sheet ─────────────────────────────────────────────────
    val showAssignSheet = assigningShift != null || assigningReq != null || draftWaitingForEmployee
    if (showAssignSheet) {
        AssignEmployeeSheet(
            employees = state.availableEmployees,
            isLoading = state.loadingEmployees,
            onAssign = { emp ->
                when {
                    draftWaitingForEmployee -> {
                        // Patch employee into draft and reopen edit sheet
                        shiftDraft = shiftDraft?.copy(employeeId = emp.id, employeeName = emp.fullName)
                        draftWaitingForEmployee = false
                        viewModel.clearAvailableEmployees()
                    }
                    assigningShift != null -> {
                        viewModel.assignShift(assigningShift!!.id, emp.id)
                        assigningShift = null
                    }
                    assigningReq != null -> {
                        val req = assigningReq!!
                        if (emp.branchId != state.schedule?.branchId) {
                            // Cross-branch (or branchless) employee: the server
                            // creates the shift but keeps the requirement in the
                            // unfilled list — confirm before proceeding.
                            crossBranchReqAssign = PendingReqAssignment(req, emp)
                        } else {
                            viewModel.assignRequirement(req.id, emp.id)
                        }
                        assigningReq = null
                    }
                }
            },
            onDismiss = {
                if (draftWaitingForEmployee) {
                    // User cancelled employee pick — reopen edit sheet as-is
                    draftWaitingForEmployee = false
                } else {
                    assigningShift = null
                    assigningReq = null
                }
                viewModel.clearAvailableEmployees()
            }
        )
    }

    // ── Delete shift confirm ──────────────────────────────────────────────────
    deleteShiftTarget?.let { shift ->
        AlertDialog(
            onDismissRequest = { deleteShiftTarget = null },
            title = { Text(stringResource(R.string.sch_delete_shift_title)) },
            text = { Text(stringResource(R.string.sch_delete_shift_text, shift.positionName, shift.employeeName ?: stringResource(R.string.common_unassigned))) },
            confirmButton = {
                Button(
                    onClick = { viewModel.deleteShift(shift); deleteShiftTarget = null },
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
                ) { Text(stringResource(R.string.delete)) }
            },
            dismissButton = { TextButton(onClick = { deleteShiftTarget = null }) { Text(stringResource(R.string.cancel)) } }
        )
    }

    // ── Cross-branch requirement assignment warning ───────────────────────────
    crossBranchReqAssign?.let { pending ->
        val req = pending.requirement
        val emp = pending.employee
        AlertDialog(
            onDismissRequest = { crossBranchReqAssign = null; viewModel.clearAvailableEmployees() },
            title = { Text(stringResource(R.string.sch_cross_branch_title)) },
            text = {
                Text(
                    stringResource(R.string.sch_cross_branch_text,
                        emp.fullName,
                        emp.branchName ?: stringResource(R.string.sch_no_branch))
                )
            },
            confirmButton = {
                Button(onClick = {
                    viewModel.assignRequirement(req.id, emp.id)
                    crossBranchReqAssign = null
                }) { Text(stringResource(R.string.common_assign)) }
            },
            dismissButton = {
                TextButton(onClick = {
                    crossBranchReqAssign = null
                    viewModel.clearAvailableEmployees()
                }) { Text(stringResource(R.string.cancel)) }
            }
        )
    }

    // ── Publish confirmation when there are unfilled shifts ───────────────────
    if (showPublishConfirmDialog) {
        AlertDialog(
            onDismissRequest = { showPublishConfirmDialog = false },
            title = { Text(stringResource(R.string.sch_unfilled_title)) },
            text = { Text(stringResource(R.string.sch_publish_confirm)) },
            confirmButton = {
                Button(onClick = {
                    showPublishConfirmDialog = false
                    viewModel.publishSchedule()
                }) { Text(stringResource(R.string.schedule_publish)) }
            },
            dismissButton = {
                TextButton(onClick = { showPublishConfirmDialog = false }) { Text(stringResource(R.string.cancel)) }
            }
        )
    }

    // ── Schedule conflict resolution ──────────────────────────────────────────
    state.conflict?.let { conflict ->
        val statusLabel = when (conflict.status) {
            AppScheduleStatus.DRAFT -> stringResource(R.string.sch_status_draft)
            AppScheduleStatus.PUBLISHED -> stringResource(R.string.sch_status_published)
            AppScheduleStatus.ARCHIVED -> stringResource(R.string.sch_status_archived)
        }
        AlertDialog(
            onDismissRequest = { viewModel.dismissConflict() },
            title = { Text(stringResource(R.string.sch_conflict_title)) },
            text = {
                Text(
                    stringResource(R.string.sch_conflict_text,
                        conflict.requestedStart, conflict.requestedEnd,
                        statusLabel, conflict.startDate, conflict.endDate)
                )
            },
            confirmButton = {
                Column(horizontalAlignment = Alignment.End) {
                    TextButton(onClick = { viewModel.openConflictingSchedule() }) {
                        Text(stringResource(R.string.sch_open_schedule))
                    }
                    TextButton(
                        onClick = { viewModel.deleteConflictingAndRegenerate() },
                        colors = ButtonDefaults.textButtonColors(
                            contentColor = MaterialTheme.colorScheme.error
                        )
                    ) {
                        Text(stringResource(R.string.sch_delete_and_regen))
                    }
                }
            },
            dismissButton = {
                TextButton(onClick = { viewModel.dismissConflict() }) { Text(stringResource(R.string.cancel)) }
            }
        )
    }

    // ── Delete schedule confirm ───────────────────────────────────────────────
    if (showDeleteScheduleDialog) {
        val schedule = state.schedule
        val isDraft = schedule?.status == AppScheduleStatus.DRAFT
        AlertDialog(
            onDismissRequest = { showDeleteScheduleDialog = false },
            title = { Text(stringResource(R.string.sch_delete_confirm_title)) },
            text = {
                Text(
                    if (isDraft) stringResource(R.string.sch_delete_draft_text)
                    else stringResource(R.string.sch_delete_published_text)
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        showDeleteScheduleDialog = false
                        viewModel.deleteSchedule {}
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
                ) { Text(stringResource(R.string.delete)) }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteScheduleDialog = false }) { Text(stringResource(R.string.cancel)) }
            }
        )
    }
}

// ── No schedule placeholder ───────────────────────────────────────────────────

@Composable
private fun NoScheduleContent(
    weekStart: String,
    weekEnd: String,
    isGenerating: Boolean,
    onGenerate: () -> Unit,
    onCustomRange: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier.fillMaxSize().padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(stringResource(R.string.sch_no_schedule), style = MaterialTheme.typography.headlineSmall)
        Spacer(Modifier.height(8.dp))
        Text(
            stringResource(R.string.sch_generate_for, weekStart, weekEnd),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(Modifier.height(24.dp))
        if (isGenerating) {
            CircularProgressIndicator()
        } else {
            Button(onClick = onGenerate, modifier = Modifier.fillMaxWidth()) { Text(stringResource(R.string.sch_generate_week)) }
            Spacer(Modifier.height(8.dp))
            OutlinedButton(onClick = onCustomRange, modifier = Modifier.fillMaxWidth()) { Text(stringResource(R.string.sch_pick_range)) }
        }
    }
}

// ── Schedule content (list or calendar) ──────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ScheduleContent(
    state: ScheduleUiState,
    viewModel: ScheduleViewModel,
    modifier: Modifier = Modifier,
    onAddShift: (String) -> Unit,
    onEditShift: (AppScheduledShift) -> Unit,
    onAssignShift: (AppScheduledShift) -> Unit,
    onEditReq: (AppUnfilledRequirement) -> Unit,
    onAssignReq: (AppUnfilledRequirement) -> Unit,
    onDeleteShift: (AppScheduledShift) -> Unit
) {
    val schedule = state.schedule ?: return
    val isDraft = schedule.status == AppScheduleStatus.DRAFT

    Column(modifier) {
        // Status badge + Regenerate
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
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
                // Period covered by the loaded schedule — makes it obvious when
                // the schedule belongs to a different week than the visible one.
                if (schedule.startDate != null && schedule.endDate != null) {
                    val periodFmt = remember { SimpleDateFormat("d MMM", Locale("ru")) }
                    Text(
                        "${periodFmt.format(schedule.startDate)} – ${periodFmt.format(schedule.endDate)}",
                        modifier = Modifier.padding(start = 8.dp),
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
            if (isDraft) {
                TextButton(onClick = { viewModel.generateSchedule(viewModel.currentWeekStart(), viewModel.currentWeekEnd()) }) {
                    Text(stringResource(R.string.sch_regenerate))
                }
            }
        }

        // Week navigation (month mode has its own month switcher)
        if (state.viewMode != ScheduleViewMode.MONTH) {
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                IconButton(onClick = viewModel::previousWeek) { Icon(Icons.Default.ChevronLeft, stringResource(R.string.sch_prev_week)) }
                Text(state.weekLabel, style = MaterialTheme.typography.titleMedium)
                IconButton(onClick = viewModel::nextWeek) { Icon(Icons.Default.ChevronRight, stringResource(R.string.sch_next_week)) }
            }
        }

        // Controls: view mode toggle + filter chips
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 2.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            // Filter chips
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                ShiftFilter.entries.forEach { filter ->
                    FilterChip(
                        selected = state.shiftFilter == filter,
                        onClick = { viewModel.setFilter(filter) },
                        label = {
                            Text(
                                when (filter) {
                                    ShiftFilter.ALL -> stringResource(R.string.sch_filter_all)
                                    ShiftFilter.FILLED -> stringResource(R.string.sch_filter_filled)
                                    ShiftFilter.UNFILLED -> stringResource(R.string.sch_filter_unfilled)
                                },
                                style = MaterialTheme.typography.labelSmall
                            )
                        }
                    )
                }
            }

            // View mode toggle
            Row {
                IconButton(
                    onClick = { viewModel.setViewMode(ScheduleViewMode.LIST) },
                    colors = IconButtonDefaults.iconButtonColors(
                        containerColor = if (state.viewMode == ScheduleViewMode.LIST)
                            MaterialTheme.colorScheme.secondaryContainer else Color.Transparent
                    )
                ) { Icon(Icons.Default.List, stringResource(R.string.sch_view_list)) }
                IconButton(
                    onClick = { viewModel.setViewMode(ScheduleViewMode.MONTH) },
                    colors = IconButtonDefaults.iconButtonColors(
                        containerColor = if (state.viewMode == ScheduleViewMode.MONTH)
                            MaterialTheme.colorScheme.secondaryContainer else Color.Transparent
                    )
                ) { Icon(Icons.Default.CalendarMonth, stringResource(R.string.sch_view_month)) }
            }
        }

        HorizontalDivider()

        // Content
        when (state.viewMode) {
            ScheduleViewMode.LIST -> ScheduleListView(
                state = state,
                viewModel = viewModel,
                isDraft = isDraft,
                onAddShift = onAddShift,
                onEditShift = onEditShift,
                onAssignShift = onAssignShift,
                onEditReq = onEditReq,
                onAssignReq = onAssignReq,
                onDeleteShift = onDeleteShift
            )
            ScheduleViewMode.MONTH -> ScheduleMonthView(
                state = state,
                viewModel = viewModel,
                isDraft = isDraft,
                onAddShift = onAddShift,
                onEditShift = onEditShift,
                onAssignShift = onAssignShift,
                onEditReq = onEditReq,
                onAssignReq = onAssignReq,
                onDeleteShift = onDeleteShift
            )
        }
    }
}

// ── Month view ────────────────────────────────────────────────────────────────

private data class MonthCell(val date: String, val inMonth: Boolean)

/** Weeks (Mon-first) covering the month of [anchor] ("yyyy-MM"). */
private fun buildMonthGrid(anchor: String): List<List<MonthCell>> {
    val fmt = SimpleDateFormat("yyyy-MM", Locale.US)
    val cal = java.util.Calendar.getInstance()
    cal.time = runCatching { fmt.parse(anchor) }.getOrNull() ?: java.util.Date()
    cal.set(java.util.Calendar.DAY_OF_MONTH, 1)
    val month = cal.get(java.util.Calendar.MONTH)
    // Back up to Monday of the first week
    val back = (cal.get(java.util.Calendar.DAY_OF_WEEK) - java.util.Calendar.MONDAY + 7) % 7
    cal.add(java.util.Calendar.DAY_OF_YEAR, -back)
    val weeks = mutableListOf<List<MonthCell>>()
    while (true) {
        val week = (0 until 7).map {
            val cell = MonthCell(
                date = "%04d-%02d-%02d".format(
                    cal.get(java.util.Calendar.YEAR),
                    cal.get(java.util.Calendar.MONTH) + 1,
                    cal.get(java.util.Calendar.DAY_OF_MONTH)
                ),
                inMonth = cal.get(java.util.Calendar.MONTH) == month
            )
            cal.add(java.util.Calendar.DAY_OF_YEAR, 1)
            cell
        }
        weeks.add(week)
        if (cal.get(java.util.Calendar.MONTH) != month) break
        if (weeks.size > 6) break
    }
    return weeks
}

private fun shiftMonth(anchor: String, delta: Int): String {
    val fmt = SimpleDateFormat("yyyy-MM", Locale.US)
    val cal = java.util.Calendar.getInstance()
    cal.time = runCatching { fmt.parse(anchor) }.getOrNull() ?: java.util.Date()
    cal.add(java.util.Calendar.MONTH, delta)
    return fmt.format(cal.time)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ScheduleMonthView(
    state: ScheduleUiState,
    viewModel: ScheduleViewModel,
    isDraft: Boolean,
    onAddShift: (String) -> Unit,
    onEditShift: (AppScheduledShift) -> Unit,
    onAssignShift: (AppScheduledShift) -> Unit,
    onEditReq: (AppUnfilledRequirement) -> Unit,
    onAssignReq: (AppUnfilledRequirement) -> Unit,
    onDeleteShift: (AppScheduledShift) -> Unit
) {
    val monthFmt = remember { SimpleDateFormat("yyyy-MM", Locale.US) }
    var monthAnchor by rememberSaveable(state.schedule?.id) {
        mutableStateOf(monthFmt.format(state.schedule?.startDate ?: java.util.Date()))
    }
    var selectedDay by rememberSaveable { mutableStateOf<String?>(null) }

    val weeks = remember(monthAnchor) { buildMonthGrid(monthAnchor) }
    val monthLabel = remember(monthAnchor) {
        runCatching {
            SimpleDateFormat("LLLL yyyy", Locale("ru")).format(monthFmt.parse(monthAnchor)!!)
                .replaceFirstChar { it.uppercase() }
        }.getOrDefault(monthAnchor)
    }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
        // Month switcher
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            IconButton(onClick = { monthAnchor = shiftMonth(monthAnchor, -1) }) {
                Icon(Icons.Default.ChevronLeft, stringResource(R.string.sch_prev_month))
            }
            Text(monthLabel, style = MaterialTheme.typography.titleMedium)
            IconButton(onClick = { monthAnchor = shiftMonth(monthAnchor, 1) }) {
                Icon(Icons.Default.ChevronRight, stringResource(R.string.sch_next_month))
            }
        }

        // Legend
        Row(
            Modifier.padding(horizontal = 16.dp, vertical = 2.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            LegendDot(MaterialTheme.colorScheme.primary, stringResource(R.string.sch_legend_shifts))
            LegendDot(MaterialTheme.colorScheme.error, stringResource(R.string.sch_legend_unfilled))
        }

        // Day-of-week header
        Row(Modifier.fillMaxWidth().padding(horizontal = 4.dp)) {
            DAY_LABELS.forEach { label ->
                Text(
                    label,
                    modifier = Modifier.weight(1f),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    fontSize = 10.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Clip
                )
            }
        }

        HorizontalDivider()

        weeks.forEach { week ->
            Row(Modifier.fillMaxWidth().padding(horizontal = 4.dp)) {
                week.forEach { cell ->
                    val shifts = if (cell.inMonth) viewModel.shiftsForDate(cell.date) else emptyList()
                    val unfilled = if (cell.inMonth) viewModel.unfilledForDate(cell.date) else emptyList()
                    val isSelected = selectedDay == cell.date
                    Column(
                        Modifier
                            .weight(1f)
                            .height(62.dp)
                            .padding(1.dp)
                            .clip(RoundedCornerShape(6.dp))
                            .background(
                                when {
                                    isSelected -> MaterialTheme.colorScheme.secondaryContainer
                                    cell.inMonth -> MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.25f)
                                    else -> Color.Transparent
                                }
                            )
                            .clickable(enabled = cell.inMonth) { selectedDay = cell.date }
                            .padding(3.dp)
                    ) {
                        Text(
                            cell.date.takeLast(2).trimStart('0'),
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.SemiBold,
                            color = if (cell.inMonth) MaterialTheme.colorScheme.onSurface
                            else MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.4f)
                        )
                        if (shifts.isNotEmpty()) {
                            Text(
                                "● ${shifts.size}",
                                style = MaterialTheme.typography.labelSmall,
                                fontSize = 9.sp,
                                maxLines = 1,
                                color = MaterialTheme.colorScheme.primary
                            )
                        }
                        if (unfilled.isNotEmpty()) {
                            Text(
                                "● ${unfilled.sumOf { it.missingStaff }}",
                                style = MaterialTheme.typography.labelSmall,
                                fontSize = 9.sp,
                                maxLines = 1,
                                color = MaterialTheme.colorScheme.error
                            )
                        }
                    }
                }
            }
        }
        Spacer(Modifier.height(16.dp))
    }

    // Day details: same cards (and therefore the same editing) as the list view.
    selectedDay?.let { day ->
        val shifts = viewModel.shiftsForDate(day)
        val unfilled = viewModel.unfilledForDate(day)
        val dayTitle = remember(day) {
            runCatching {
                SimpleDateFormat("EEEE, d MMMM", Locale("ru"))
                    .format(SimpleDateFormat("yyyy-MM-dd", Locale.US).parse(day)!!)
                    .replaceFirstChar { it.uppercase() }
            }.getOrDefault(day)
        }
        ModalBottomSheet(onDismissRequest = { selectedDay = null }) {
            Column(Modifier.fillMaxWidth().padding(bottom = 32.dp)) {
                Row(
                    Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column {
                        Text(dayTitle, style = MaterialTheme.typography.titleMedium)
                        var missingTotal = 0
                        unfilled.forEach { missingTotal += it.missingStaff }
                        Text(
                            if (missingTotal > 0) stringResource(R.string.sch_day_shifts_missing, shifts.size, missingTotal)
                            else stringResource(R.string.sch_day_shifts_n, shifts.size),
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    if (isDraft) {
                        IconButton(onClick = { onAddShift(day) }) {
                            Icon(Icons.Default.Add, stringResource(R.string.sch_add_shift))
                        }
                    }
                }
                Spacer(Modifier.height(8.dp))
                if (shifts.isEmpty() && unfilled.isEmpty()) {
                    Text(
                        stringResource(R.string.sch_no_shifts_day),
                        modifier = Modifier.padding(16.dp),
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                } else {
                    LazyColumn(Modifier.fillMaxWidth().height(420.dp)) {
                        items(shifts, key = { "m_shift_${it.id}" }) { shift ->
                            ShiftCard(
                                shift = shift,
                                isDraft = isDraft,
                                onEdit = { onEditShift(shift) },
                                onAssign = { onAssignShift(shift) },
                                onDelete = { onDeleteShift(shift) }
                            )
                        }
                        items(unfilled, key = { "m_req_${it.id}_${it.startMinutes}" }) { req ->
                            UnfilledRequirementCard(
                                req = req,
                                isDraft = isDraft,
                                onEdit = { onEditReq(req) },
                                onAssign = { onAssignReq(req) }
                            )
                        }
                        item { Spacer(Modifier.height(8.dp)) }
                    }
                }
            }
        }
    }
}

@Composable
private fun LegendDot(color: Color, label: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(
            Modifier
                .height(8.dp)
                .width(8.dp)
                .clip(RoundedCornerShape(4.dp))
                .background(color)
        )
        Spacer(Modifier.width(4.dp))
        Text(
            label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

// ── List view ─────────────────────────────────────────────────────────────────

@Composable
private fun ScheduleListView(
    state: ScheduleUiState,
    viewModel: ScheduleViewModel,
    isDraft: Boolean,
    onAddShift: (String) -> Unit,
    onEditShift: (AppScheduledShift) -> Unit,
    onAssignShift: (AppScheduledShift) -> Unit,
    onEditReq: (AppUnfilledRequirement) -> Unit,
    onAssignReq: (AppUnfilledRequirement) -> Unit,
    onDeleteShift: (AppScheduledShift) -> Unit
) {
    LazyColumn(Modifier.fillMaxSize()) {
        state.weekDates.forEachIndexed { index, date ->
            val shifts = viewModel.shiftsForDate(date)
            val unfilled = viewModel.unfilledForDate(date)
            val itemCount = shifts.size + unfilled.size
            // In draft show all days (need + button); published — skip empty
            if (itemCount == 0 && !isDraft) return@forEachIndexed

            item(key = "header_$date") {
                ScheduleDayHeader(
                    dayLabel = DAY_LABELS[index],
                    date = date,
                    itemCount = itemCount,
                    showAddButton = isDraft,
                    onAddClick = { onAddShift(date) }
                )
            }

            items(shifts, key = { "shift_${it.id}" }) { shift ->
                ShiftCard(
                    shift = shift,
                    isDraft = isDraft,
                    onEdit = { onEditShift(shift) },
                    onAssign = { onAssignShift(shift) },
                    onDelete = { onDeleteShift(shift) }
                )
            }

            items(unfilled, key = { "req_${it.id}" }) { req ->
                UnfilledRequirementCard(
                    req = req,
                    isDraft = isDraft,
                    onEdit = { onEditReq(req) },
                    onAssign = { onAssignReq(req) }
                )
            }

            item(key = "divider_$date") { HorizontalDivider() }
        }
        item { Spacer(Modifier.height(16.dp)) }
    }
}

// ── List view cards ───────────────────────────────────────────────────────────

@Composable
private fun ScheduleDayHeader(
    dayLabel: String,
    date: String,
    itemCount: Int,
    showAddButton: Boolean,
    onAddClick: () -> Unit
) {
    val display = remember(date) {
        runCatching {
            "$dayLabel, ${SimpleDateFormat("d MMM", Locale("ru")).format(SimpleDateFormat("yyyy-MM-dd", Locale.US).parse(date)!!)}"
        }.getOrDefault(dayLabel)
    }
    Row(
        Modifier.fillMaxWidth().padding(start = 16.dp, end = 8.dp, top = 16.dp, bottom = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Column {
            Text(display, style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.primary)
            if (itemCount > 0) {
                Text(
                    "$itemCount " + (if (itemCount == 1) stringResource(R.string.sch_shift_one) else stringResource(R.string.sch_shift_many)),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
        if (showAddButton) {
            IconButton(onClick = onAddClick) { Icon(Icons.Default.Add, stringResource(R.string.sch_add_shift)) }
        }
    }
}

@Composable
private fun ShiftCard(
    shift: AppScheduledShift,
    isDraft: Boolean,
    onEdit: () -> Unit,
    onAssign: () -> Unit,
    onDelete: () -> Unit
) {
    val isAssigned = shift.hasAssignedEmployee
    Card(
        Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 3.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (isAssigned)
                MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.35f)
            else
                MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
        )
    ) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(Modifier.weight(1f)) {
                Text(
                    shift.employeeName ?: stringResource(R.string.common_unassigned),
                    style = MaterialTheme.typography.bodyLarge,
                    color = if (isAssigned) MaterialTheme.colorScheme.onSurface
                            else MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    "${shift.positionName}  •  ${ScheduleViewModel.minutesToDisplay(shift.startMinutes)} – ${ScheduleViewModel.minutesToDisplay(shift.endMinutes)}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            if (isDraft) {
                // PersonAdd shown for ALL shifts: assign if empty, reassign if filled
                IconButton(onClick = onAssign) {
                    Icon(
                        Icons.Default.PersonAdd,
                        contentDescription = if (isAssigned) stringResource(R.string.common_reassign) else stringResource(R.string.common_assign)
                    )
                }
                IconButton(onClick = onEdit) { Icon(Icons.Default.Edit, stringResource(R.string.sch_edit_time_position)) }
                IconButton(onClick = onDelete) { Icon(Icons.Default.Delete, stringResource(R.string.delete)) }
            }
        }
    }
}

@Composable
private fun UnfilledRequirementCard(
    req: AppUnfilledRequirement,
    isDraft: Boolean,
    onEdit: () -> Unit,
    onAssign: () -> Unit
) {
    Card(
        Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 3.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.4f))
    ) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(Modifier.weight(1f)) {
                Text(stringResource(R.string.sch_unfilled_line, req.positionTitle), style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.error)
                Text(
                    "${ScheduleViewModel.minutesToDisplay(req.startMinutes)} – ${ScheduleViewModel.minutesToDisplay(req.endMinutes)}  " + stringResource(R.string.sch_missing_n, req.missingStaff),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            if (isDraft) {
                IconButton(onClick = onEdit) { Icon(Icons.Default.Edit, stringResource(R.string.sch_edit_requirement)) }
                IconButton(onClick = onAssign) { Icon(Icons.Default.PersonAdd, stringResource(R.string.sch_assign_employee)) }
            }
        }
    }
}

// ── Assign employee sheet ─────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AssignEmployeeSheet(
    employees: List<AppAvailableEmployee>,
    isLoading: Boolean,
    onAssign: (AppAvailableEmployee) -> Unit,
    onDismiss: () -> Unit
) {
    val available = employees.filter { it.availabilityStatus != AppEmployeeAvailabilityStatus.UNAVAILABLE }
    val unavailable = employees.filter { it.availabilityStatus == AppEmployeeAvailabilityStatus.UNAVAILABLE }

    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(Modifier.fillMaxWidth().padding(bottom = 32.dp)) {
            Text(
                stringResource(R.string.sch_select_employee),
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp)
            )
            when {
                isLoading -> Box(
                    Modifier.fillMaxWidth().padding(32.dp),
                    contentAlignment = Alignment.Center
                ) { CircularProgressIndicator() }

                employees.isEmpty() -> Text(
                    stringResource(R.string.sch_no_employees),
                    modifier = Modifier.padding(16.dp),
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                else -> LazyColumn {
                    if (available.isNotEmpty()) {
                        item {
                            Text(
                                stringResource(R.string.sch_available),
                                style = MaterialTheme.typography.labelMedium,
                                color = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.padding(horizontal = 16.dp, vertical = 6.dp)
                            )
                        }
                        items(available) { emp ->
                            EmployeeRow(emp = emp, onAssign = { onAssign(emp) })
                            HorizontalDivider(Modifier.padding(horizontal = 16.dp))
                        }
                    }

                    if (unavailable.isNotEmpty()) {
                        item {
                            Text(
                                stringResource(R.string.sch_all_others),
                                style = MaterialTheme.typography.labelMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.padding(horizontal = 16.dp, vertical = 6.dp)
                            )
                        }
                        items(unavailable) { emp ->
                            EmployeeRow(emp = emp, onAssign = { onAssign(emp) })
                            HorizontalDivider(Modifier.padding(horizontal = 16.dp))
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun EmployeeRow(
    emp: AppAvailableEmployee,
    onAssign: () -> Unit
) {
    val isUnavailable = emp.availabilityStatus == AppEmployeeAvailabilityStatus.UNAVAILABLE
    Row(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(Modifier.weight(1f)) {
            Text(
                emp.fullName,
                style = MaterialTheme.typography.bodyLarge,
                color = if (isUnavailable) MaterialTheme.colorScheme.onSurfaceVariant
                else MaterialTheme.colorScheme.onSurface
            )
            Text(
                buildString {
                    append(emp.positionName)
                    append("  •  ")
                    append(
                        when (emp.availabilityStatus) {
                            AppEmployeeAvailabilityStatus.AVAILABLE -> stringResource(R.string.sch_status_available)
                            AppEmployeeAvailabilityStatus.IF_NEEDED -> stringResource(R.string.sch_status_if_needed)
                            AppEmployeeAvailabilityStatus.UNAVAILABLE -> stringResource(R.string.sch_status_unavailable)
                        }
                    )
                    append("  •  ${emp.assignedHours.toInt()}h")
                },
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        TextButton(onClick = onAssign) {
            Text(if (isUnavailable) stringResource(R.string.common_override) else stringResource(R.string.common_assign))
        }
    }
}

// ── Edit sheets ───────────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ShiftEditSheet(
    draft: ShiftDraft,
    positions: List<RequirementPositionOption>,
    onDraftChange: (ShiftDraft) -> Unit,
    onSave: () -> Unit,
    onChangeEmployee: () -> Unit,
    onDismiss: () -> Unit
) {
    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            Modifier.fillMaxWidth().padding(horizontal = 16.dp).padding(bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                if (draft.shiftId == null) stringResource(R.string.sch_add_shift_title) else stringResource(R.string.sch_edit_shift_title),
                style = MaterialTheme.typography.titleMedium
            )

            // Employee row — only for existing shifts
            if (draft.shiftId != null) {
                Row(
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .background(MaterialTheme.colorScheme.secondaryContainer.copy(alpha = 0.4f))
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column(Modifier.weight(1f)) {
                        Text(stringResource(R.string.sch_employee), style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text(
                            draft.employeeName ?: stringResource(R.string.common_unassigned),
                            style = MaterialTheme.typography.bodyMedium
                        )
                    }
                    TextButton(onClick = onChangeEmployee) {
                        Icon(Icons.Default.PersonAdd, contentDescription = null,
                            modifier = Modifier.padding(end = 4.dp))
                        Text(if (draft.employeeName != null) stringResource(R.string.common_change) else stringResource(R.string.common_assign))
                    }
                }
            }

            ScheduleDropdown(
                label = stringResource(R.string.sch_position),
                options = positions.map { it.id to it.name },
                selectedId = draft.positionId,
                onSelect = { onDraftChange(draft.copy(positionId = it)) }
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Box(Modifier.weight(1f)) {
                    ScheduleDropdown(
                        label = stringResource(R.string.sch_start),
                        options = ScheduleViewModel.minuteOptions,
                        selectedId = draft.startMinutes,
                        onSelect = { onDraftChange(draft.copy(startMinutes = it)) }
                    )
                }
                Box(Modifier.weight(1f)) {
                    ScheduleDropdown(
                        label = stringResource(R.string.sch_end),
                        options = ScheduleViewModel.minuteOptions,
                        selectedId = draft.endMinutes,
                        onSelect = { onDraftChange(draft.copy(endMinutes = it)) }
                    )
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                TextButton(onClick = onDismiss, Modifier.weight(1f)) { Text(stringResource(R.string.cancel)) }
                Button(
                    onClick = onSave,
                    enabled = draft.positionId != null && draft.endMinutes > draft.startMinutes,
                    modifier = Modifier.weight(1f)
                ) { Text(stringResource(R.string.save)) }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun UnfilledReqEditSheet(
    draft: UnfilledReqDraft,
    positions: List<RequirementPositionOption>,
    onDraftChange: (UnfilledReqDraft) -> Unit,
    onSave: () -> Unit,
    onDismiss: () -> Unit
) {
    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            Modifier.fillMaxWidth().padding(horizontal = 16.dp).padding(bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(stringResource(R.string.sch_edit_requirement), style = MaterialTheme.typography.titleMedium)
            ScheduleDropdown(
                label = stringResource(R.string.sch_position),
                options = positions.map { it.id to it.name },
                selectedId = draft.positionId,
                onSelect = { onDraftChange(draft.copy(positionId = it)) }
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Box(Modifier.weight(1f)) {
                    ScheduleDropdown(
                        label = stringResource(R.string.sch_start),
                        options = ScheduleViewModel.minuteOptions,
                        selectedId = draft.startMinutes,
                        onSelect = { onDraftChange(draft.copy(startMinutes = it)) }
                    )
                }
                Box(Modifier.weight(1f)) {
                    ScheduleDropdown(
                        label = stringResource(R.string.sch_end),
                        options = ScheduleViewModel.minuteOptions,
                        selectedId = draft.endMinutes,
                        onSelect = { onDraftChange(draft.copy(endMinutes = it)) }
                    )
                }
            }
            OutlinedTextField(
                value = draft.quantity.toString(),
                onValueChange = { v -> v.toIntOrNull()?.let { onDraftChange(draft.copy(quantity = it.coerceAtLeast(1))) } },
                label = { Text(stringResource(R.string.req_staff)) },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                TextButton(onClick = onDismiss, Modifier.weight(1f)) { Text(stringResource(R.string.cancel)) }
                Button(
                    onClick = onSave,
                    enabled = draft.endMinutes > draft.startMinutes,
                    modifier = Modifier.weight(1f)
                ) { Text(stringResource(R.string.save)) }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun GenerateDateRangeSheet(
    defaultStart: String,
    branches: List<AppBranchOption>,
    isGenerating: Boolean,
    onGenerate: (start: String, end: String, branchId: Int?) -> Unit,
    onDismiss: () -> Unit
) {
    // Period start is always a Monday: any picked date snaps to its week's Monday.
    var startDate by rememberSaveable { mutableStateOf(snapToMonday(defaultStart)) }
    var branchId by rememberSaveable { mutableStateOf(branches.firstOrNull()?.id) }
    var showDatePicker by remember { mutableStateOf(false) }

    val displayFmt = remember { SimpleDateFormat("EEE, d MMM yyyy", Locale("ru")) }
    val parseFmt = remember { SimpleDateFormat("yyyy-MM-dd", Locale.US) }
    val displayDate = remember(startDate) {
        runCatching { displayFmt.format(parseFmt.parse(startDate)!!) }.getOrDefault(startDate)
    }

    fun generateWeeks(weeks: Int) {
        val cal = java.util.Calendar.getInstance()
        val parsed = runCatching { parseFmt.parse(startDate) }.getOrNull() ?: return
        cal.time = parsed
        cal.add(java.util.Calendar.DAY_OF_YEAR, weeks * 7 - 1)
        val end = "%04d-%02d-%02d".format(
            cal.get(java.util.Calendar.YEAR),
            cal.get(java.util.Calendar.MONTH) + 1,
            cal.get(java.util.Calendar.DAY_OF_MONTH)
        )
        onGenerate(startDate, end, branchId)
    }

    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            Modifier.fillMaxWidth().padding(horizontal = 16.dp).padding(bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(stringResource(R.string.sch_generate_title), style = MaterialTheme.typography.titleMedium)

            if (branches.size > 1) {
                ScheduleDropdown(
                    label = stringResource(R.string.sch_branch),
                    options = branches.map { it.id to it.name },
                    selectedId = branchId,
                    onSelect = { branchId = it }
                )
            }

            // Date field opens the calendar; readOnly fields swallow taps, so a
            // transparent overlay handles the click.
            Box {
                OutlinedTextField(
                    value = displayDate,
                    onValueChange = {},
                    readOnly = true,
                    label = { Text(stringResource(R.string.sch_period_start_monday)) },
                    trailingIcon = { Icon(Icons.Default.CalendarMonth, contentDescription = stringResource(R.string.sch_pick_date)) },
                    modifier = Modifier.fillMaxWidth()
                )
                Box(
                    Modifier
                        .matchParentSize()
                        .clickable(enabled = !isGenerating) { showDatePicker = true }
                )
            }

            if (isGenerating) {
                Box(Modifier.fillMaxWidth().padding(vertical = 8.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            } else {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(onClick = { generateWeeks(1) }, modifier = Modifier.weight(1f)) { Text(stringResource(R.string.sch_week1)) }
                    Button(onClick = { generateWeeks(2) }, modifier = Modifier.weight(1f)) { Text(stringResource(R.string.sch_week2)) }
                    Button(onClick = { generateWeeks(4) }, modifier = Modifier.weight(1f)) { Text(stringResource(R.string.sch_week4)) }
                }
            }
            TextButton(onClick = onDismiss, modifier = Modifier.fillMaxWidth()) { Text(stringResource(R.string.cancel)) }
        }
    }

    if (showDatePicker) {
        val utcFmt = remember {
            SimpleDateFormat("yyyy-MM-dd", Locale.US).apply {
                timeZone = java.util.TimeZone.getTimeZone("UTC")
            }
        }
        val initialMillis = remember(startDate) {
            runCatching { utcFmt.parse(startDate)?.time }.getOrNull()
        }
        val datePickerState = rememberDatePickerState(initialSelectedDateMillis = initialMillis)
        DatePickerDialog(
            onDismissRequest = { showDatePicker = false },
            confirmButton = {
                TextButton(onClick = {
                    datePickerState.selectedDateMillis?.let { millis ->
                        // DatePicker returns UTC-midnight millis for the picked day.
                        startDate = snapToMonday(utcFmt.format(java.util.Date(millis)))
                    }
                    showDatePicker = false
                }) { Text(stringResource(R.string.common_ok)) }
            },
            dismissButton = {
                TextButton(onClick = { showDatePicker = false }) { Text(stringResource(R.string.cancel)) }
            }
        ) {
            DatePicker(state = datePickerState)
        }
    }
}

/** Returns the Monday of the week containing [date] (yyyy-MM-dd); input on parse failure. */
private fun snapToMonday(date: String): String {
    val fmt = SimpleDateFormat("yyyy-MM-dd", Locale.US)
    val parsed = runCatching { fmt.parse(date) }.getOrNull() ?: return date
    val cal = java.util.Calendar.getInstance().apply { time = parsed }
    val days = (cal.get(java.util.Calendar.DAY_OF_WEEK) - java.util.Calendar.MONDAY + 7) % 7
    cal.add(java.util.Calendar.DAY_OF_YEAR, -days)
    return "%04d-%02d-%02d".format(
        cal.get(java.util.Calendar.YEAR),
        cal.get(java.util.Calendar.MONTH) + 1,
        cal.get(java.util.Calendar.DAY_OF_MONTH)
    )
}

// ── Shared dropdown ───────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun ScheduleDropdown(
    label: String,
    options: List<Pair<Int, String>>,
    selectedId: Int?,
    onSelect: (Int) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }
    val selectedLabel = options.firstOrNull { it.first == selectedId }?.second ?: "Select…"

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

// ── File helpers ──────────────────────────────────────────────────────────────

private fun saveScheduleCsv(context: Context, csv: String): String? {
    return try {
        val timestamp = java.text.SimpleDateFormat("yyyyMMdd_HHmm", Locale.US)
            .format(java.util.Date())
        val fileName = "schedule_$timestamp.csv"
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val resolver = context.contentResolver
            val values = ContentValues().apply {
                put(MediaStore.Downloads.DISPLAY_NAME, fileName)
                put(MediaStore.Downloads.MIME_TYPE, "text/csv")
                put(MediaStore.Downloads.IS_PENDING, 1)
            }
            val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values) ?: return null
            resolver.openOutputStream(uri)?.use { it.write(csv.toByteArray()) }
            values.clear()
            values.put(MediaStore.Downloads.IS_PENDING, 0)
            resolver.update(uri, values, null, null)
            uri.toString()
        } else {
            @Suppress("DEPRECATION")
            val downloadsDir = android.os.Environment.getExternalStoragePublicDirectory(
                android.os.Environment.DIRECTORY_DOWNLOADS
            )
            val file = java.io.File(downloadsDir, fileName)
            file.writeText(csv)
            file.absolutePath
        }
    } catch (_: Exception) { null }
}

private fun shareFile(context: Context, uriString: String, mimeType: String) {
    val intent = Intent(Intent.ACTION_VIEW).apply {
        setDataAndType(uriString.toUri(), mimeType)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    context.startActivity(Intent.createChooser(intent, context.getString(R.string.rep_open_report)).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    })
}
