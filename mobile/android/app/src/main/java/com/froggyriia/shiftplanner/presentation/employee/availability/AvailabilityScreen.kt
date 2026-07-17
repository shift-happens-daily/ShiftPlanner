package com.froggyriia.shiftplanner.presentation.employee.availability

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
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
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.sp
import com.froggyriia.shiftplanner.domain.model.AvailabilitySlotState
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale
import androidx.compose.ui.res.stringResource
import com.froggyriia.shiftplanner.R

// Visible time range 06:00–23:00 (slot = hour*2 + half)
private const val FIRST_SLOT = 12   // 06:00
private const val LAST_SLOT  = 46   // 23:00 exclusive

private val DAY_LABELS    = listOf("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")
private val CELL_HEIGHT   = 22.dp
private val TIME_COL_WIDTH = 42.dp

private val COLOR_AVAILABLE   = Color(0xFF4CAF50)
private val COLOR_IF_NEEDED   = Color(0xFFFFB300)
private val COLOR_UNAVAILABLE_CELL = Color(0xFFE0E0E0)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AvailabilityScreen(viewModel: AvailabilityViewModel) {
    val state by viewModel.uiState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(state.statusMessage) {
        state.statusMessage?.let { snackbarHostState.showSnackbar(it); viewModel.clearMessages() }
    }
    LaunchedEffect(state.errorMessage) {
        state.errorMessage?.let { snackbarHostState.showSnackbar(it); viewModel.clearMessages() }
    }
    val availContext = androidx.compose.ui.platform.LocalContext.current
    LaunchedEffect(state.statusMessageRes, state.errorMessageRes) {
        val res = state.statusMessageRes ?: state.errorMessageRes
        if (res != null) {
            snackbarHostState.showSnackbar(availContext.getString(res))
            viewModel.clearMessages()
        }
    }

    // Currently selected paint color
    var paintColor by remember { mutableStateOf(AvailabilitySlotState.CAN_WORK) }

    Scaffold(
        topBar = { TopAppBar(title = { Text(stringResource(R.string.availability_title)) }) },
        snackbarHost = { SnackbarHost(snackbarHostState) },
        bottomBar = {
            if (state.hasChanges) {
                Box(Modifier.padding(horizontal = 16.dp, vertical = 8.dp)) {
                    Button(
                        onClick = viewModel::saveAvailability,
                        enabled = !state.isSaving,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        if (state.isSaving) CircularProgressIndicator(
                            modifier = Modifier.size(18.dp),
                            strokeWidth = 2.dp,
                            color = MaterialTheme.colorScheme.onPrimary
                        )
                        else Text(stringResource(R.string.availability_save))
                    }
                }
            }
        }
    ) { padding ->
        if (state.isLoading) {
            Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
            return@Scaffold
        }

        Column(
            Modifier
                .padding(padding)
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
        ) {
            // ── Color picker ──────────────────────────────────────────────────
            Text(
                stringResource(R.string.availability_hint),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 6.dp)
            )
            Row(
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                PaintColorButton(
                    label = stringResource(R.string.availability_available),
                    color = COLOR_AVAILABLE,
                    selected = paintColor == AvailabilitySlotState.CAN_WORK,
                    modifier = Modifier.weight(1f)
                ) { paintColor = AvailabilitySlotState.CAN_WORK }

                PaintColorButton(
                    label = stringResource(R.string.availability_if_needed),
                    color = COLOR_IF_NEEDED,
                    selected = paintColor == AvailabilitySlotState.PREFER_NOT,
                    modifier = Modifier.weight(1f)
                ) { paintColor = AvailabilitySlotState.PREFER_NOT }

                PaintColorButton(
                    label = stringResource(R.string.availability_unavailable),
                    color = COLOR_UNAVAILABLE_CELL,
                    selected = paintColor == AvailabilitySlotState.UNAVAILABLE,
                    modifier = Modifier.weight(1f)
                ) { paintColor = AvailabilitySlotState.UNAVAILABLE }
            }

            // ── Quick actions ─────────────────────────────────────────────────
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(0.dp)
            ) {
                TextButton(onClick = viewModel::copyPreviousWeek, enabled = !state.isSaving) {
                    Text(stringResource(R.string.availability_restore), style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.primary)
                }
                TextButton(onClick = viewModel::resetWeek, enabled = !state.isSaving) {
                    Text(stringResource(R.string.availability_reset), style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.error)
                }
            }

            Spacer(Modifier.height(4.dp))

            // ── Grid ─────────────────────────────────────────────────────────
            AvailabilityGrid(
                grid = state.grid,
                paintColor = paintColor,
                onSetSlot = viewModel::setSlot
            )

            Spacer(Modifier.height(16.dp))
        }
    }
}

@Composable
private fun PaintColorButton(
    label: String,
    color: Color,
    selected: Boolean,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    val borderColor = if (selected) MaterialTheme.colorScheme.primary else Color.Transparent
    OutlinedButton(
        onClick = onClick,
        modifier = modifier,
        contentPadding = PaddingValues(horizontal = 6.dp, vertical = 6.dp),
        border = androidx.compose.foundation.BorderStroke(
            2.dp,
            if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outline.copy(alpha = 0.4f)
        ),
        colors = ButtonDefaults.outlinedButtonColors(
            containerColor = if (selected) MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f) else Color.Transparent
        )
    ) {
        Box(
            Modifier
                .size(10.dp)
                .clip(CircleShape)
                .background(color)
                .border(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.3f), CircleShape)
        )
        Spacer(Modifier.width(5.dp))
        Text(
            label,
            style = MaterialTheme.typography.labelSmall,
            fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
            maxLines = 1,
            softWrap = false,
            overflow = TextOverflow.Ellipsis
        )
    }
}

/** Dates (day-of-month) of the current week, Monday first. */
private fun currentWeekDayNumbers(): List<String> {
    val cal = Calendar.getInstance()
    val back = (cal.get(Calendar.DAY_OF_WEEK) - Calendar.MONDAY + 7) % 7
    cal.add(Calendar.DAY_OF_YEAR, -back)
    val fmt = SimpleDateFormat("d.MM", Locale.US)
    return (0..6).map {
        val label = fmt.format(cal.time)
        cal.add(Calendar.DAY_OF_YEAR, 1)
        label
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AvailabilityGrid(
    grid: Map<Int, Map<Int, AvailabilitySlotState>>,
    paintColor: AvailabilitySlotState,
    onSetSlot: (weekday: Int, slot: Int, state: AvailabilitySlotState) -> Unit
) {
    val weekDates = remember { currentWeekDayNumbers() }

    BoxWithConstraints(Modifier.fillMaxWidth()) {
        // Day columns stretch to fill the whole screen width.
        val dayColWidth = (maxWidth - TIME_COL_WIDTH - 8.dp) / 7

        val density = LocalDensity.current
        val timeColPx = with(density) { TIME_COL_WIDTH.toPx() }
        val dayColPx = with(density) { dayColWidth.toPx() }
        val cellHeightPx = with(density) { CELL_HEIGHT.toPx() }

        fun paintAt(x: Float, y: Float) {
            val col = ((x - timeColPx) / dayColPx).toInt()
            val slotIdx = (y / cellHeightPx).toInt()
            val slot = FIRST_SLOT + slotIdx
            if (col in 0..6 && slot in FIRST_SLOT until LAST_SLOT) {
                onSetSlot(col, slot, paintColor)
            }
        }

        val totalSlots = LAST_SLOT - FIRST_SLOT
        val gridHeight = CELL_HEIGHT * totalSlots

        Column(Modifier.padding(end = 8.dp)) {
            // Day header: weekday + date of the current week
            Row(Modifier.fillMaxWidth()) {
                Box(Modifier.width(TIME_COL_WIDTH)) // spacer over the time column
                DAY_LABELS.forEachIndexed { index, label ->
                    Column(
                        Modifier.width(dayColWidth).padding(bottom = 3.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            text = label,
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.Medium,
                            maxLines = 1
                        )
                        Text(
                            text = weekDates.getOrElse(index) { "" },
                            style = MaterialTheme.typography.labelSmall,
                            fontSize = 9.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 1
                        )
                    }
                }
            }

            // Grid body — single pointerInput handles drag painting
            Box(
                Modifier
                    .fillMaxWidth()
                    .height(gridHeight)
                    .pointerInput(paintColor) {
                        awaitEachGesture {
                            val down = awaitFirstDown()
                            paintAt(down.position.x, down.position.y)
                            do {
                                val event = awaitPointerEvent()
                                event.changes.forEach { change ->
                                    if (change.pressed) paintAt(change.position.x, change.position.y)
                                }
                            } while (event.changes.any { it.pressed })
                        }
                    }
            ) {
                // Static grid cells — drawn as a single composable from state
                Column {
                    for (slotIdx in 0 until totalSlots) {
                        val slot = FIRST_SLOT + slotIdx
                        Row(
                            Modifier.height(CELL_HEIGHT),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            // Time label on the hour
                            val isHour = slot % 2 == 0
                            Text(
                                text = if (isHour) slotLabel(slot) else "",
                                modifier = Modifier.width(TIME_COL_WIDTH).height(CELL_HEIGHT).padding(end = 4.dp),
                                fontSize = 9.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                textAlign = TextAlign.End,
                                lineHeight = 11.sp
                            )
                            for (weekday in 0..6) {
                                val slotState = grid[weekday]?.get(slot) ?: AvailabilitySlotState.UNAVAILABLE
                                val bg = when (slotState) {
                                    AvailabilitySlotState.CAN_WORK   -> COLOR_AVAILABLE
                                    AvailabilitySlotState.PREFER_NOT -> COLOR_IF_NEEDED
                                    AvailabilitySlotState.UNAVAILABLE -> COLOR_UNAVAILABLE_CELL
                                }
                                Box(
                                    Modifier
                                        .width(dayColWidth)
                                        .height(CELL_HEIGHT)
                                        .border(
                                            0.5.dp,
                                            MaterialTheme.colorScheme.outline.copy(alpha = 0.25f)
                                        )
                                        .background(bg)
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

private fun slotLabel(slot: Int): String {
    val h = slot / 2
    val m = (slot % 2) * 30
    return "%02d:%02d".format(h, m)
}
