package com.froggyriia.shiftplanner.presentation.employee.schedule

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
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.froggyriia.shiftplanner.domain.model.AppScheduledShift
import com.froggyriia.shiftplanner.domain.model.AppUser
import com.froggyriia.shiftplanner.presentation.manager.schedule.ScheduleViewModel
import java.text.SimpleDateFormat
import java.util.Locale

private val DAY_LABELS = listOf("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MyScheduleScreen(
    user: AppUser,
    viewModel: MyScheduleViewModel
) {
    val state by viewModel.uiState.collectAsState()

    Scaffold(
        topBar = { TopAppBar(title = { Text("My Schedule") }) }
    ) { padding ->
        Column(Modifier.padding(padding)) {
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

                    if (weekShifts.isEmpty()) {
                        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            Text(
                                "No shifts this week",
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    } else {
                        LazyColumn(Modifier.fillMaxSize()) {
                            weekShifts.forEach { (index, date, shifts) ->
                                item(key = "header_$date") {
                                    MyShiftDayHeader(dayLabel = DAY_LABELS[index], date = date)
                                }
                                items(shifts, key = { "shift_${it.id}" }) { shift ->
                                    MyShiftCard(shift = shift)
                                }
                                item(key = "divider_$date") { HorizontalDivider() }
                            }
                            item { Spacer(Modifier.height(16.dp)) }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun MyShiftDayHeader(dayLabel: String, date: String) {
    val displayDate = remember(date) {
        try {
            val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.US)
            val out = SimpleDateFormat("EEEE, MMM d", Locale.US)
            out.format(sdf.parse(date)!!)
        } catch (_: Exception) { dayLabel }
    }
    Text(
        displayDate,
        style = MaterialTheme.typography.titleSmall,
        modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 4.dp)
    )
}

@Composable
private fun MyShiftCard(shift: AppScheduledShift) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp)
    ) {
        Column(Modifier.padding(horizontal = 12.dp, vertical = 10.dp)) {
            Text(shift.positionName, style = MaterialTheme.typography.bodyLarge)
            Text(
                "${ScheduleViewModel.minutesToDisplay(shift.startMinutes)} – " +
                ScheduleViewModel.minutesToDisplay(shift.endMinutes),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}
