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
import com.froggyriia.shiftplanner.domain.model.AppAvailableEmployee
import com.froggyriia.shiftplanner.domain.model.AppEmployeeAvailabilityStatus
import com.froggyriia.shiftplanner.domain.model.AppScheduleStatus
import com.froggyriia.shiftplanner.domain.model.AppScheduledShift
import com.froggyriia.shiftplanner.domain.model.AppUnfilledRequirement
import com.froggyriia.shiftplanner.domain.model.AppUser
import com.froggyriia.shiftplanner.domain.model.RequirementPositionOption
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

private val DAY_LABELS = listOf("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")

// Calendar layout constants
private val HOUR_HEIGHT = 44.dp
private val TIME_COL_WIDTH = 36.dp
private val CAL_START_HOUR = 6
private val CAL_END_HOUR = 23

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
    var shiftDraft by remember { mutableStateOf<ShiftDraft?>(null) }
    // When true: edit sheet is hidden, assign sheet is open; on selection we restore the draft
    var draftWaitingForEmployee by remember { mutableStateOf(false) }
    var unfilledDraft by remember { mutableStateOf<UnfilledReqDraft?>(null) }
    var assigningShift by remember { mutableStateOf<AppScheduledShift?>(null) }
    var assigningReq by remember { mutableStateOf<AppUnfilledRequirement?>(null) }
    var deleteShiftTarget by remember { mutableStateOf<AppScheduledShift?>(null) }

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
                    if (schedule != null) {
                        IconButton(onClick = { showDeleteScheduleDialog = true }) {
                            Icon(Icons.Default.Delete, contentDescription = "Удалить расписание",
                                tint = MaterialTheme.colorScheme.error)
                        }
                        IconButton(
                            onClick = {
                                val csv = viewModel.buildScheduleCsv()
                                val uri = saveScheduleCsv(context, csv)
                                if (uri != null) shareFile(context, uri, "text/csv")
                            }
                        ) {
                            Icon(Icons.Default.Download, contentDescription = "Export CSV")
                        }
                        if (schedule.status == AppScheduleStatus.DRAFT) {
                            if (state.isPublishing) {
                                CircularProgressIndicator(modifier = Modifier.padding(end = 12.dp))
                            } else {
                                TextButton(onClick = viewModel::publishSchedule) { Text("Опубликовать") }
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
            defaultEnd = viewModel.currentWeekEnd(),
            isGenerating = state.isGenerating,
            onGenerate = { start, end -> viewModel.generateSchedule(start, end); showGenerateSheet = false },
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
                        viewModel.assignRequirement(assigningReq!!.id, emp.id)
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
            title = { Text("Delete shift?") },
            text = { Text("Remove ${shift.positionName} shift for ${shift.employeeName ?: "unassigned"}?") },
            confirmButton = {
                Button(
                    onClick = { viewModel.deleteShift(shift); deleteShiftTarget = null },
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
                ) { Text("Delete") }
            },
            dismissButton = { TextButton(onClick = { deleteShiftTarget = null }) { Text("Cancel") } }
        )
    }

    // ── Delete schedule confirm ───────────────────────────────────────────────
    if (showDeleteScheduleDialog) {
        val schedule = state.schedule
        val isDraft = schedule?.status == AppScheduleStatus.DRAFT
        AlertDialog(
            onDismissRequest = { showDeleteScheduleDialog = false },
            title = { Text("Удалить расписание?") },
            text = {
                Text(
                    if (isDraft) "Черновик расписания будет удалён без возможности восстановления."
                    else "Опубликованное расписание будет удалено. Это действие необратимо."
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        showDeleteScheduleDialog = false
                        viewModel.deleteSchedule {}
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
                ) { Text("Удалить") }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteScheduleDialog = false }) { Text("Отмена") }
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
            Button(onClick = onGenerate, modifier = Modifier.fillMaxWidth()) { Text("Generate this week") }
            Spacer(Modifier.height(8.dp))
            OutlinedButton(onClick = onCustomRange, modifier = Modifier.fillMaxWidth()) { Text("Pick date range…") }
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
                TextButton(onClick = { viewModel.generateSchedule(viewModel.currentWeekStart(), viewModel.currentWeekEnd()) }) {
                    Text("Regenerate")
                }
            }
        }

        // Week navigation
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            IconButton(onClick = viewModel::previousWeek) { Icon(Icons.Default.ChevronLeft, "Prev week") }
            Text(state.weekLabel, style = MaterialTheme.typography.titleMedium)
            IconButton(onClick = viewModel::nextWeek) { Icon(Icons.Default.ChevronRight, "Next week") }
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
                                    ShiftFilter.ALL -> "All"
                                    ShiftFilter.FILLED -> "Filled"
                                    ShiftFilter.UNFILLED -> "Unfilled"
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
                ) { Icon(Icons.Default.List, "List view") }
                IconButton(
                    onClick = { viewModel.setViewMode(ScheduleViewMode.CALENDAR) },
                    colors = IconButtonDefaults.iconButtonColors(
                        containerColor = if (state.viewMode == ScheduleViewMode.CALENDAR)
                            MaterialTheme.colorScheme.secondaryContainer else Color.Transparent
                    )
                ) { Icon(Icons.Default.CalendarMonth, "Calendar view") }
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
            ScheduleViewMode.CALENDAR -> ScheduleCalendarView(
                state = state,
                viewModel = viewModel,
                isDraft = isDraft,
                onEditShift = onEditShift,
                onAssignShift = onAssignShift,
                onEditReq = onEditReq,
                onAssignReq = onAssignReq
            )
        }
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

// ── Calendar view ─────────────────────────────────────────────────────────────

@Composable
private fun ScheduleCalendarView(
    state: ScheduleUiState,
    viewModel: ScheduleViewModel,
    isDraft: Boolean,
    onEditShift: (AppScheduledShift) -> Unit,
    onAssignShift: (AppScheduledShift) -> Unit,
    onEditReq: (AppUnfilledRequirement) -> Unit,
    onAssignReq: (AppUnfilledRequirement) -> Unit
) {
    val totalHours = CAL_END_HOUR - CAL_START_HOUR
    val totalHeight = HOUR_HEIGHT * totalHours
    val vertScroll = rememberScrollState()
    val dateFmt = remember { SimpleDateFormat("d", Locale.US) }
    val parseFmt = remember { SimpleDateFormat("yyyy-MM-dd", Locale.US) }

    Column(Modifier.fillMaxSize()) {
        // Day headers — all 7 days fit in screen width, no horizontal scroll
        Row(Modifier.fillMaxWidth()) {
            Spacer(Modifier.width(TIME_COL_WIDTH))
            VerticalDivider(Modifier.height(40.dp))
            state.weekDates.forEachIndexed { i, date ->
                val dayNum = runCatching { dateFmt.format(parseFmt.parse(date)!!) }.getOrDefault("?")
                Column(
                    Modifier.weight(1f),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        DAY_LABELS[i],
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        dayNum,
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }
        }

        HorizontalDivider()

        // Scrollable grid — vertical only, columns fill width
        Row(Modifier.fillMaxWidth().verticalScroll(vertScroll)) {
            // Time labels
            Box(Modifier.width(TIME_COL_WIDTH).height(totalHeight)) {
                for (h in CAL_START_HOUR until CAL_END_HOUR) {
                    val yOffset = HOUR_HEIGHT * (h - CAL_START_HOUR)
                    Text(
                        "%02d".format(h),
                        modifier = Modifier.offset(y = yOffset + 2.dp).align(Alignment.TopEnd).padding(end = 4.dp),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        fontSize = 10.sp
                    )
                }
            }

            VerticalDivider(Modifier.height(totalHeight))

            // Day columns — weight(1f) distributes remaining width equally
            state.weekDates.forEach { date ->
                val shifts = viewModel.shiftsForDate(date)
                val unfilled = viewModel.unfilledForDate(date)

                Box(Modifier.weight(1f).height(totalHeight)) {
                    // Hour grid lines
                    for (h in 0..totalHours) {
                        HorizontalDivider(
                            Modifier.fillMaxWidth().offset(y = HOUR_HEIGHT * h),
                            color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.4f)
                        )
                    }

                    shifts.forEach { shift ->
                        val topDp = HOUR_HEIGHT * (shift.startMinutes / 60f - CAL_START_HOUR)
                        val heightDp = (HOUR_HEIGHT * (shift.endMinutes - shift.startMinutes) / 60f).coerceAtLeast(16.dp)
                        CalendarShiftBlock(
                            shift = shift,
                            isDraft = isDraft,
                            modifier = Modifier
                                .offset(y = topDp)
                                .fillMaxWidth()
                                .height(heightDp)
                                .padding(horizontal = 1.dp, vertical = 1.dp),
                            onEdit = { onEditShift(shift) },
                            onAssign = { onAssignShift(shift) }
                        )
                    }

                    unfilled.forEach { req ->
                        val topDp = HOUR_HEIGHT * (req.startMinutes / 60f - CAL_START_HOUR)
                        val heightDp = (HOUR_HEIGHT * (req.endMinutes - req.startMinutes) / 60f).coerceAtLeast(16.dp)
                        CalendarUnfilledBlock(
                            req = req,
                            isDraft = isDraft,
                            modifier = Modifier
                                .offset(y = topDp)
                                .fillMaxWidth()
                                .height(heightDp)
                                .padding(horizontal = 1.dp, vertical = 1.dp),
                            onAssign = { onAssignReq(req) },
                            onEdit = { onEditReq(req) }
                        )
                    }
                }

                VerticalDivider(Modifier.height(totalHeight))
            }
        }
    }
}

@Composable
private fun CalendarShiftBlock(
    shift: AppScheduledShift,
    isDraft: Boolean,
    modifier: Modifier = Modifier,
    onEdit: () -> Unit,
    onAssign: () -> Unit
) {
    val bgColor = if (shift.hasAssignedEmployee)
        MaterialTheme.colorScheme.primaryContainer
    else
        MaterialTheme.colorScheme.secondaryContainer

    Box(
        modifier
            .clip(RoundedCornerShape(3.dp))
            .background(bgColor)
            .clickable(enabled = isDraft) { if (shift.hasAssignedEmployee) onEdit() else onAssign() }
            .padding(2.dp)
    ) {
        Column {
            Text(
                "${ScheduleViewModel.minutesToDisplay(shift.startMinutes)}–${ScheduleViewModel.minutesToDisplay(shift.endMinutes)}",
                style = MaterialTheme.typography.labelSmall,
                fontSize = 9.sp,
                maxLines = 1,
                overflow = TextOverflow.Clip,
                color = MaterialTheme.colorScheme.onPrimaryContainer
            )
            Text(
                shift.employeeName?.split(" ")?.firstOrNull() ?: "?",
                style = MaterialTheme.typography.labelSmall,
                fontSize = 9.sp,
                maxLines = 1,
                overflow = TextOverflow.Clip,
                fontWeight = FontWeight.Medium,
                color = MaterialTheme.colorScheme.onPrimaryContainer
            )
        }
    }
}

@Composable
private fun CalendarUnfilledBlock(
    req: AppUnfilledRequirement,
    isDraft: Boolean,
    modifier: Modifier = Modifier,
    onAssign: () -> Unit,
    onEdit: () -> Unit
) {
    Box(
        modifier
            .clip(RoundedCornerShape(3.dp))
            .background(MaterialTheme.colorScheme.errorContainer)
            .border(1.dp, MaterialTheme.colorScheme.error, RoundedCornerShape(3.dp))
            .clickable(enabled = isDraft) { onAssign() }
            .padding(2.dp)
    ) {
        Column {
            Text(
                "×${req.missingStaff}",
                style = MaterialTheme.typography.labelSmall,
                fontSize = 9.sp,
                maxLines = 1,
                color = MaterialTheme.colorScheme.onErrorContainer,
                fontWeight = FontWeight.Bold
            )
            Text(
                "${ScheduleViewModel.minutesToDisplay(req.startMinutes)}–${ScheduleViewModel.minutesToDisplay(req.endMinutes)}",
                style = MaterialTheme.typography.labelSmall,
                fontSize = 9.sp,
                maxLines = 1,
                overflow = TextOverflow.Clip,
                color = MaterialTheme.colorScheme.onErrorContainer
            )
        }
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
                    "$itemCount ${if (itemCount == 1) "смена" else "смен"}",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
        if (showAddButton) {
            IconButton(onClick = onAddClick) { Icon(Icons.Default.Add, "Add shift") }
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
                    shift.employeeName ?: "Unassigned",
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
                        contentDescription = if (isAssigned) "Reassign" else "Assign"
                    )
                }
                IconButton(onClick = onEdit) { Icon(Icons.Default.Edit, "Edit time/position") }
                IconButton(onClick = onDelete) { Icon(Icons.Default.Delete, "Delete") }
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
                Text("Unfilled: ${req.positionTitle}", style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.error)
                Text(
                    "${ScheduleViewModel.minutesToDisplay(req.startMinutes)} – ${ScheduleViewModel.minutesToDisplay(req.endMinutes)}  ×${req.missingStaff} missing",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            if (isDraft) {
                IconButton(onClick = onEdit) { Icon(Icons.Default.Edit, "Edit requirement") }
                IconButton(onClick = onAssign) { Icon(Icons.Default.PersonAdd, "Assign employee") }
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
                "Select Employee",
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp)
            )
            when {
                isLoading -> Box(
                    Modifier.fillMaxWidth().padding(32.dp),
                    contentAlignment = Alignment.Center
                ) { CircularProgressIndicator() }

                employees.isEmpty() -> Text(
                    "No employees available.",
                    modifier = Modifier.padding(16.dp),
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                else -> LazyColumn {
                    if (available.isNotEmpty()) {
                        item {
                            Text(
                                "Available",
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
                                "Unavailable",
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
                            AppEmployeeAvailabilityStatus.AVAILABLE -> "✓ Available"
                            AppEmployeeAvailabilityStatus.IF_NEEDED -> "△ If needed"
                            AppEmployeeAvailabilityStatus.UNAVAILABLE -> "✕ Unavailable"
                        }
                    )
                    append("  •  ${emp.assignedHours.toInt()}h")
                },
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        TextButton(onClick = onAssign) {
            Text(if (isUnavailable) "Override" else "Assign")
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
                if (draft.shiftId == null) "Add Shift" else "Edit Shift",
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
                        Text("Employee", style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text(
                            draft.employeeName ?: "Unassigned",
                            style = MaterialTheme.typography.bodyMedium
                        )
                    }
                    TextButton(onClick = onChangeEmployee) {
                        Icon(Icons.Default.PersonAdd, contentDescription = null,
                            modifier = Modifier.padding(end = 4.dp))
                        Text(if (draft.employeeName != null) "Change" else "Assign")
                    }
                }
            }

            ScheduleDropdown(
                label = "Position",
                options = positions.map { it.id to it.name },
                selectedId = draft.positionId,
                onSelect = { onDraftChange(draft.copy(positionId = it)) }
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Box(Modifier.weight(1f)) {
                    ScheduleDropdown(
                        label = "Start",
                        options = ScheduleViewModel.minuteOptions,
                        selectedId = draft.startMinutes,
                        onSelect = { onDraftChange(draft.copy(startMinutes = it)) }
                    )
                }
                Box(Modifier.weight(1f)) {
                    ScheduleDropdown(
                        label = "End",
                        options = ScheduleViewModel.minuteOptions,
                        selectedId = draft.endMinutes,
                        onSelect = { onDraftChange(draft.copy(endMinutes = it)) }
                    )
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                TextButton(onClick = onDismiss, Modifier.weight(1f)) { Text("Cancel") }
                Button(
                    onClick = onSave,
                    enabled = draft.positionId != null && draft.endMinutes > draft.startMinutes,
                    modifier = Modifier.weight(1f)
                ) { Text("Save") }
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
            Text("Edit Requirement", style = MaterialTheme.typography.titleMedium)
            ScheduleDropdown(
                label = "Position",
                options = positions.map { it.id to it.name },
                selectedId = draft.positionId,
                onSelect = { onDraftChange(draft.copy(positionId = it)) }
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Box(Modifier.weight(1f)) {
                    ScheduleDropdown(
                        label = "Start",
                        options = ScheduleViewModel.minuteOptions,
                        selectedId = draft.startMinutes,
                        onSelect = { onDraftChange(draft.copy(startMinutes = it)) }
                    )
                }
                Box(Modifier.weight(1f)) {
                    ScheduleDropdown(
                        label = "End",
                        options = ScheduleViewModel.minuteOptions,
                        selectedId = draft.endMinutes,
                        onSelect = { onDraftChange(draft.copy(endMinutes = it)) }
                    )
                }
            }
            OutlinedTextField(
                value = draft.quantity.toString(),
                onValueChange = { v -> v.toIntOrNull()?.let { onDraftChange(draft.copy(quantity = it.coerceAtLeast(1))) } },
                label = { Text("Required staff") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                TextButton(onClick = onDismiss, Modifier.weight(1f)) { Text("Cancel") }
                Button(
                    onClick = onSave,
                    enabled = draft.endMinutes > draft.startMinutes,
                    modifier = Modifier.weight(1f)
                ) { Text("Save") }
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
            Modifier.fillMaxWidth().padding(horizontal = 16.dp).padding(bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text("Generate Schedule", style = MaterialTheme.typography.titleMedium)
            OutlinedTextField(
                value = startDate, onValueChange = { startDate = it },
                label = { Text("Start date (yyyy-MM-dd)") }, singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
            OutlinedTextField(
                value = endDate, onValueChange = { endDate = it },
                label = { Text("End date (yyyy-MM-dd)") }, singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                TextButton(onClick = onDismiss, Modifier.weight(1f)) { Text("Cancel") }
                Button(
                    onClick = { onGenerate(startDate, endDate) },
                    enabled = !isGenerating && startDate.isNotBlank() && endDate.isNotBlank(),
                    modifier = Modifier.weight(1f)
                ) {
                    if (isGenerating) CircularProgressIndicator(Modifier.height(18.dp))
                    else Text("Generate")
                }
            }
        }
    }
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
    context.startActivity(Intent.createChooser(intent, "Open file").apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    })
}
