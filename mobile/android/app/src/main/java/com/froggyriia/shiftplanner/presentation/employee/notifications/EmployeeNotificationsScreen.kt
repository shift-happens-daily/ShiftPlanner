package com.froggyriia.shiftplanner.presentation.employee.notifications

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.froggyriia.shiftplanner.R
import com.froggyriia.shiftplanner.domain.model.AppAbsence
import com.froggyriia.shiftplanner.domain.model.AppAbsenceStatus
import com.froggyriia.shiftplanner.domain.model.AppScheduledShift
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EmployeeNotificationsScreen(
    viewModel: EmployeeNotificationsViewModel,
    onBack: (() -> Unit)? = null
) {
    val state by viewModel.uiState.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.nav_notifications)) },
                navigationIcon = {
                    if (onBack != null) {
                        IconButton(onClick = onBack) {
                            Icon(
                                Icons.AutoMirrored.Filled.ArrowBack,
                                contentDescription = stringResource(R.string.common_back)
                            )
                        }
                    }
                },
                actions = {
                    IconButton(onClick = viewModel::load) {
                        Icon(Icons.Default.Refresh, contentDescription = stringResource(R.string.common_refresh))
                    }
                }
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize(),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            // ── Schedule published ──
            item { SectionHeader(stringResource(R.string.emp_notif_schedule_section)) }
            val schedule = state.publishedSchedule
            if (schedule == null) {
                item { EmptyRow(stringResource(R.string.emp_notif_no_schedule)) }
            } else {
                item {
                    val period = formatPeriod(schedule.startDate, schedule.endDate)
                    InfoCard(
                        title = if (period != null)
                            stringResource(R.string.emp_notif_schedule_published, period)
                        else
                            stringResource(R.string.emp_notif_schedule_published_nodate),
                        subtitle = null
                    )
                }
            }

            // ── Assigned shifts ──
            item { SectionHeader(stringResource(R.string.emp_notif_shifts_section)) }
            if (state.upcomingShifts.isEmpty()) {
                item { EmptyRow(stringResource(R.string.emp_notif_no_shifts)) }
            } else {
                item {
                    InfoCard(
                        title = stringResource(R.string.emp_notif_shifts_count, state.upcomingShifts.size),
                        subtitle = null
                    )
                }
                items(state.upcomingShifts, key = { "shift_${it.id}" }) { shift ->
                    ShiftRow(shift)
                }
            }

            // ── Time off ──
            item { SectionHeader(stringResource(R.string.emp_notif_timeoff_section)) }
            if (state.absences.isEmpty()) {
                item { EmptyRow(stringResource(R.string.emp_notif_no_timeoff)) }
            } else {
                items(state.absences, key = { "absence_${it.id}" }) { absence ->
                    AbsenceRow(absence)
                }
            }

            // ── Company membership ──
            item { SectionHeader(stringResource(R.string.emp_notif_company_section)) }
            val company = state.companyName
            item {
                if (company != null) {
                    InfoCard(
                        title = stringResource(R.string.emp_notif_company_joined, company),
                        subtitle = null
                    )
                } else {
                    EmptyRow(stringResource(R.string.emp_notif_company_none))
                }
            }

            state.errorMessage?.let { message ->
                item {
                    Text(message, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                }
            }
        }
    }
}

@Composable
private fun ShiftRow(shift: AppScheduledShift) {
    val date = formatDate(shift.date)
    val time = "${formatMinutes(shift.startMinutes)}–${formatMinutes(shift.endMinutes)}"
    InfoCard(title = "$date · $time", subtitle = shift.positionName)
}

@Composable
private fun AbsenceRow(absence: AppAbsence) {
    val period = "${absence.startDate} – ${absence.endDate}"
    val statusLabel = when (absence.status) {
        AppAbsenceStatus.APPROVED -> stringResource(R.string.emp_notif_timeoff_approved)
        AppAbsenceStatus.REJECTED -> stringResource(R.string.emp_notif_timeoff_rejected)
        else -> stringResource(R.string.emp_notif_timeoff_submitted)
    }
    InfoCard(title = "${absence.absenceType.displayName} · $period", subtitle = statusLabel)
}

@Composable
private fun SectionHeader(title: String) {
    Text(
        title,
        style = MaterialTheme.typography.titleSmall,
        fontWeight = FontWeight.SemiBold,
        color = MaterialTheme.colorScheme.primary,
        modifier = Modifier.padding(top = 8.dp)
    )
}

@Composable
private fun EmptyRow(text: String) {
    Text(
        text,
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant
    )
}

@Composable
private fun InfoCard(title: String, subtitle: String?) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
    ) {
        Column(
            Modifier
                .fillMaxWidth()
                .padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Text(title, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.SemiBold)
            if (!subtitle.isNullOrBlank()) {
                Text(subtitle, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

private fun formatMinutes(minutes: Int): String {
    val h = minutes / 60
    val m = minutes % 60
    return "%02d:%02d".format(h, m)
}

private val dateFormat = SimpleDateFormat("EEE, d MMM", Locale.getDefault())
private val periodFormat = SimpleDateFormat("d MMM", Locale.getDefault())

private fun formatDate(date: Date): String = dateFormat.format(date)

private fun formatPeriod(start: Date?, end: Date?): String? {
    if (start == null || end == null) return null
    return "${periodFormat.format(start)} – ${periodFormat.format(end)}"
}
