package com.froggyriia.shiftplanner.presentation.employee.availability

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.BottomAppBar
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.froggyriia.shiftplanner.domain.model.AvailabilitySlotState

// Visible time range: 07:00 (slot 14) to 23:00 (slot 46)
private const val FIRST_SLOT = 14
private const val LAST_SLOT = 46   // exclusive end → rows are FIRST_SLOT..LAST_SLOT-1

private val DAY_LABELS = listOf("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")
private val CELL_HEIGHT = 28.dp
private val TIME_COL_WIDTH = 48.dp
private val DAY_COL_WIDTH = 44.dp

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AvailabilityScreen(
    viewModel: AvailabilityViewModel
) {
    val state by viewModel.uiState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(state.statusMessage) {
        state.statusMessage?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearMessages()
        }
    }
    LaunchedEffect(state.errorMessage) {
        state.errorMessage?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearMessages()
        }
    }

    Scaffold(
        topBar = { TopAppBar(title = { Text("My Availability") }) },
        snackbarHost = { SnackbarHost(snackbarHostState) },
        bottomBar = {
            if (state.hasChanges) {
                BottomAppBar {
                    Button(
                        onClick = viewModel::saveAvailability,
                        enabled = !state.isSaving,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp)
                    ) {
                        if (state.isSaving) CircularProgressIndicator(modifier = Modifier.height(18.dp))
                        else Text("Save")
                    }
                }
            }
        }
    ) { padding ->
        if (state.isLoading) {
            Box(
                Modifier
                    .fillMaxSize()
                    .padding(padding),
                contentAlignment = Alignment.Center
            ) { CircularProgressIndicator() }
            return@Scaffold
        }

        Column(Modifier.padding(padding)) {
            // Legend
            AvailabilityLegend()

            // Grid
            val hScroll = rememberScrollState()
            val vScroll = rememberScrollState()

            // Day header row (sticky-ish — scrolls horizontally but not vertically)
            Row(
                Modifier
                    .fillMaxWidth()
                    .horizontalScroll(hScroll)
            ) {
                Box(Modifier.width(TIME_COL_WIDTH)) // spacer for time column
                DAY_LABELS.forEach { label ->
                    Text(
                        text = label,
                        modifier = Modifier
                            .width(DAY_COL_WIDTH)
                            .padding(vertical = 4.dp),
                        textAlign = TextAlign.Center,
                        style = MaterialTheme.typography.labelMedium
                    )
                }
            }

            // Scrollable grid body
            Box(
                Modifier
                    .fillMaxSize()
                    .horizontalScroll(hScroll)
                    .verticalScroll(vScroll)
            ) {
                Column {
                    for (slot in FIRST_SLOT until LAST_SLOT) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            // Time label — only on the hour and on :30
                            val showLabel = slot % 2 == 0
                            Text(
                                text = if (showLabel) slotLabel(slot) else "",
                                modifier = Modifier
                                    .width(TIME_COL_WIDTH)
                                    .height(CELL_HEIGHT),
                                fontSize = 10.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                textAlign = TextAlign.End,
                                lineHeight = 12.sp
                            )
                            for (weekday in 0..6) {
                                val slotState = state.grid[weekday]?.get(slot)
                                    ?: AvailabilitySlotState.UNAVAILABLE
                                AvailabilityCell(
                                    state = slotState,
                                    onClick = { viewModel.toggleSlot(weekday, slot) }
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun AvailabilityCell(
    state: AvailabilitySlotState,
    onClick: () -> Unit
) {
    val bg = when (state) {
        AvailabilitySlotState.CAN_WORK -> Color(0xFF4CAF50)
        AvailabilitySlotState.PREFER_NOT -> Color(0xFFFFB300)
        AvailabilitySlotState.UNAVAILABLE -> MaterialTheme.colorScheme.surfaceVariant
    }
    Box(
        Modifier
            .width(DAY_COL_WIDTH)
            .height(CELL_HEIGHT)
            .border(0.5.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.3f))
            .background(bg)
            .clickable(onClick = onClick)
    )
}

@Composable
private fun AvailabilityLegend() {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        LegendItem(Color(0xFF4CAF50), "Available")
        LegendItem(Color(0xFFFFB300), "If needed")
        LegendItem(MaterialTheme.colorScheme.surfaceVariant, "Unavailable")
    }
}

@Composable
private fun LegendItem(color: Color, label: String) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        Box(
            Modifier
                .width(16.dp)
                .height(16.dp)
                .background(color)
                .border(0.5.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.3f))
        )
        Text(label, style = MaterialTheme.typography.labelSmall)
    }
}

private fun slotLabel(slot: Int): String {
    val h = slot / 2
    val m = (slot % 2) * 30
    return "%02d:%02d".format(h, m)
}
