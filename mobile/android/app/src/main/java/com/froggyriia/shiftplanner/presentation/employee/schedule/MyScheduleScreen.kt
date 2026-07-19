package com.froggyriia.shiftplanner.presentation.employee.schedule

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronLeft
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.List
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.SwapHoriz
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.IconButtonDefaults
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.froggyriia.shiftplanner.domain.model.AppScheduledShift
import com.froggyriia.shiftplanner.domain.model.AppUser
import com.froggyriia.shiftplanner.presentation.manager.schedule.ScheduleViewModel
import java.text.SimpleDateFormat
import java.util.Locale
import androidx.compose.ui.res.stringResource
import com.froggyriia.shiftplanner.R
import androidx.compose.runtime.LaunchedEffect

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MyScheduleScreen(
    user: AppUser,
    viewModel: MyScheduleViewModel
) {
    val state by viewModel.uiState.collectAsState()

    var monthMode by rememberSaveable { mutableStateOf(false) }
    var exchangeShift by remember { mutableStateOf<AppScheduledShift?>(null) }
    val snackbarHostState = remember { SnackbarHostState() }
    val exchangeSentMsg = stringResource(R.string.exchange_sent)

    // Reload when the tab is opened — the schedule may have been republished.
    LaunchedEffect(Unit) { viewModel.loadMySchedule() }

    LaunchedEffect(state.exchangeSubmitted) {
        if (state.exchangeSubmitted) {
            snackbarHostState.showSnackbar(exchangeSentMsg)
            viewModel.consumeExchangeSubmitted()
        }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.mysch_title)) },
                actions = {
                    IconButton(
                        onClick = { monthMode = false },
                        colors = IconButtonDefaults.iconButtonColors(
                            containerColor = if (!monthMode)
                                MaterialTheme.colorScheme.secondaryContainer else Color.Transparent
                        )
                    ) { Icon(Icons.Default.List, contentDescription = stringResource(R.string.sch_view_list)) }
                    IconButton(
                        onClick = { monthMode = true },
                        colors = IconButtonDefaults.iconButtonColors(
                            containerColor = if (monthMode)
                                MaterialTheme.colorScheme.secondaryContainer else Color.Transparent
                        )
                    ) { Icon(Icons.Default.CalendarMonth, contentDescription = stringResource(R.string.sch_view_month)) }
                    IconButton(onClick = viewModel::loadMySchedule) {
                        Icon(Icons.Default.Refresh, contentDescription = stringResource(R.string.common_refresh))
                    }
                }
            )
        }
    ) { padding ->
        Column(Modifier.padding(padding)) {
            if (monthMode) {
                MyScheduleMonthView(viewModel = viewModel, isLoading = state.isLoading)
                return@Column
            }

            // Week navigation
            Row(
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                IconButton(onClick = viewModel::previousWeek) { Icon(Icons.Default.ChevronLeft, stringResource(R.string.sch_prev_week)) }
                Text(state.weekLabel, style = MaterialTheme.typography.titleMedium)
                IconButton(onClick = viewModel::nextWeek) { Icon(Icons.Default.ChevronRight, stringResource(R.string.sch_next_week)) }
            }

            when {
                state.isLoading -> Box(
                    Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) { CircularProgressIndicator() }

                state.errorMessage != null -> Box(
                    Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) { Text(state.errorMessage ?: "", color = MaterialTheme.colorScheme.error) }

                else -> {
                    val weekShifts = state.weekDates.mapIndexed { index, date ->
                        Triple(index, date, viewModel.shiftsForDate(date))
                    }.filter { it.third.isNotEmpty() }

                    // Weekly summary
                    val totalHours = weekShifts
                        .flatMap { it.third }
                        .sumOf { (it.endMinutes - it.startMinutes) / 60.0 }
                    val totalShifts = weekShifts.sumOf { it.third.size }

                    Surface(
                        color = MaterialTheme.colorScheme.secondaryContainer,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 24.dp, vertical = 12.dp),
                            horizontalArrangement = Arrangement.spacedBy(32.dp)
                        ) {
                            WeekStat(label = stringResource(R.string.mysch_shifts), value = "$totalShifts")
                            WeekStat(label = stringResource(R.string.mysch_hours), value = "${"%.1f".format(totalHours)}h")
                        }
                    }

                    HorizontalDivider()

                    if (weekShifts.isEmpty()) {
                        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            Text(
                                stringResource(R.string.mysch_no_shifts_week),
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    } else {
                        LazyColumn(Modifier.fillMaxSize()) {
                            weekShifts.forEach { (_, date, shifts) ->
                                item(key = "header_$date") {
                                    MyShiftDayHeader(date = date)
                                }
                                items(shifts, key = { "shift_${it.id}" }) { shift ->
                                    MyShiftCard(shift = shift, onClick = { exchangeShift = shift })
                                }
                            }
                            item { Spacer(Modifier.height(16.dp)) }
                        }
                    }
                }
            }
        }
    }

    exchangeShift?.let { shift ->
        var note by remember(shift.id) { mutableStateOf("") }
        ModalBottomSheet(onDismissRequest = { exchangeShift = null }) {
            Column(
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp)
                    .padding(bottom = 32.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text(stringResource(R.string.exchange_request_title), style = MaterialTheme.typography.titleMedium)
                Text(
                    "${shift.positionName} · " +
                        "${ScheduleViewModel.minutesToDisplay(shift.startMinutes)} – " +
                        ScheduleViewModel.minutesToDisplay(shift.endMinutes),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                OutlinedTextField(
                    value = note,
                    onValueChange = { note = it },
                    label = { Text(stringResource(R.string.exchange_reason_label)) },
                    modifier = Modifier.fillMaxWidth()
                )
                Button(
                    onClick = {
                        viewModel.requestExchange(shift.id, note.trim())
                        exchangeShift = null
                    },
                    enabled = note.isNotBlank(),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(stringResource(R.string.exchange_send))
                }
            }
        }
    }
}

@Composable
private fun WeekStat(label: String, value: String) {
    Column {
        Text(
            value,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSecondaryContainer
        )
        Text(
            label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSecondaryContainer.copy(alpha = 0.7f)
        )
    }
}

@Composable
private fun MyShiftDayHeader(date: String) {
    val displayDate = remember(date) {
        try {
            val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.US)
            val out = SimpleDateFormat("EEEE, MMM d", Locale.US)
            out.format(sdf.parse(date)!!)
        } catch (_: Exception) { date }
    }
    Text(
        displayDate,
        style = MaterialTheme.typography.titleSmall,
        fontWeight = FontWeight.SemiBold,
        color = MaterialTheme.colorScheme.primary,
        modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 4.dp)
    )
}

@Composable
private fun MyShiftCard(shift: AppScheduledShift, onClick: (() -> Unit)? = null) {
    val hours = (shift.endMinutes - shift.startMinutes) / 60.0
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp)
            .then(if (onClick != null) Modifier.clickable { onClick() } else Modifier),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.primaryContainer
        )
    ) {
        Row(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Column(Modifier.weight(1f)) {
                Text(
                    shift.positionName,
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.Medium,
                    color = MaterialTheme.colorScheme.onPrimaryContainer
                )
                Text(
                    "${ScheduleViewModel.minutesToDisplay(shift.startMinutes)} – " +
                    ScheduleViewModel.minutesToDisplay(shift.endMinutes),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.75f)
                )
            }
            Text(
                "${"%.1f".format(hours)}h",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onPrimaryContainer
            )
            if (onClick != null) {
                Spacer(Modifier.width(8.dp))
                Icon(
                    Icons.Default.SwapHoriz,
                    contentDescription = stringResource(R.string.exchange_request_title),
                    tint = MaterialTheme.colorScheme.primary
                )
            }
        }
    }
}


// ── Month view ────────────────────────────────────────────────────────────────

private val MY_DAY_LABELS = listOf("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")

private data class MyMonthCell(val date: String, val inMonth: Boolean)

private fun buildMyMonthGrid(anchor: String): List<List<MyMonthCell>> {
    val fmt = SimpleDateFormat("yyyy-MM", Locale.US)
    val cal = java.util.Calendar.getInstance()
    cal.time = runCatching { fmt.parse(anchor) }.getOrNull() ?: java.util.Date()
    cal.set(java.util.Calendar.DAY_OF_MONTH, 1)
    val month = cal.get(java.util.Calendar.MONTH)
    val back = (cal.get(java.util.Calendar.DAY_OF_WEEK) - java.util.Calendar.MONDAY + 7) % 7
    cal.add(java.util.Calendar.DAY_OF_YEAR, -back)
    val weeks = mutableListOf<List<MyMonthCell>>()
    while (true) {
        val week = (0 until 7).map {
            val cell = MyMonthCell(
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

private fun shiftMyMonth(anchor: String, delta: Int): String {
    val fmt = SimpleDateFormat("yyyy-MM", Locale.US)
    val cal = java.util.Calendar.getInstance()
    cal.time = runCatching { fmt.parse(anchor) }.getOrNull() ?: java.util.Date()
    cal.add(java.util.Calendar.MONTH, delta)
    return fmt.format(cal.time)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun MyScheduleMonthView(
    viewModel: MyScheduleViewModel,
    isLoading: Boolean
) {
    val monthFmt = remember { SimpleDateFormat("yyyy-MM", Locale.US) }
    var monthAnchor by rememberSaveable { mutableStateOf(monthFmt.format(java.util.Date())) }
    var selectedDay by rememberSaveable { mutableStateOf<String?>(null) }

    val weeks = remember(monthAnchor) { buildMyMonthGrid(monthAnchor) }
    val monthLabel = remember(monthAnchor) {
        runCatching {
            SimpleDateFormat("LLLL yyyy", Locale("ru")).format(monthFmt.parse(monthAnchor)!!)
                .replaceFirstChar { it.uppercase() }
        }.getOrDefault(monthAnchor)
    }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            IconButton(onClick = { monthAnchor = shiftMyMonth(monthAnchor, -1) }) {
                Icon(Icons.Default.ChevronLeft, stringResource(R.string.sch_prev_month))
            }
            Text(monthLabel, style = MaterialTheme.typography.titleMedium)
            IconButton(onClick = { monthAnchor = shiftMyMonth(monthAnchor, 1) }) {
                Icon(Icons.Default.ChevronRight, stringResource(R.string.sch_next_month))
            }
        }

        if (isLoading) {
            Box(Modifier.fillMaxWidth().padding(24.dp), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
        }

        Row(Modifier.fillMaxWidth().padding(horizontal = 4.dp)) {
            MY_DAY_LABELS.forEach { label ->
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
                    val isSelected = selectedDay == cell.date
                    Column(
                        Modifier
                            .weight(1f)
                            .height(58.dp)
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
                            val hours = shifts.sumOf { (it.endMinutes - it.startMinutes) / 60.0 }
                            Text(
                                "● ${shifts.size}",
                                style = MaterialTheme.typography.labelSmall,
                                fontSize = 9.sp,
                                maxLines = 1,
                                color = MaterialTheme.colorScheme.primary
                            )
                            Text(
                                "%.1fh".format(hours),
                                style = MaterialTheme.typography.labelSmall,
                                fontSize = 8.sp,
                                maxLines = 1,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
            }
        }
        Spacer(Modifier.height(16.dp))
    }

    selectedDay?.let { day ->
        val shifts = viewModel.shiftsForDate(day)
        val dayTitle = remember(day) {
            runCatching {
                SimpleDateFormat("EEEE, d MMMM", Locale("ru"))
                    .format(SimpleDateFormat("yyyy-MM-dd", Locale.US).parse(day)!!)
                    .replaceFirstChar { it.uppercase() }
            }.getOrDefault(day)
        }
        ModalBottomSheet(onDismissRequest = { selectedDay = null }) {
            Column(Modifier.fillMaxWidth().padding(bottom = 32.dp)) {
                Text(
                    dayTitle,
                    style = MaterialTheme.typography.titleMedium,
                    modifier = Modifier.padding(horizontal = 16.dp)
                )
                val hours = shifts.sumOf { (it.endMinutes - it.startMinutes) / 60.0 }
                Text(
                    if (shifts.isEmpty()) stringResource(R.string.mysch_no_shifts)
                    else stringResource(R.string.mysch_day_line, shifts.size, "%.1f".format(hours)),
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(horizontal = 16.dp)
                )
                Spacer(Modifier.height(8.dp))
                shifts.forEach { shift -> MyShiftCard(shift = shift) }
                Spacer(Modifier.height(8.dp))
            }
        }
    }
}
