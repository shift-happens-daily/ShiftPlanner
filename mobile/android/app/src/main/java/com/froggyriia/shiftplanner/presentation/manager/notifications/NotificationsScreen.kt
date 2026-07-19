package com.froggyriia.shiftplanner.presentation.manager.notifications

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
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
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.froggyriia.shiftplanner.R
import com.froggyriia.shiftplanner.domain.model.AppAbsenceStatus

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NotificationsScreen(viewModel: NotificationsViewModel, onBack: (() -> Unit)? = null) {
    val state by viewModel.uiState.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.nav_notifications)) },
                navigationIcon = {
                    if (onBack != null) {
                        IconButton(onClick = onBack) {
                            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(R.string.common_back))
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
            // ── Shift exchange ──
            item { SectionHeader(stringResource(R.string.notif_exchange)) }
            if (state.exchangeRequests.isEmpty()) {
                item { EmptyRow(stringResource(R.string.notif_no_exchange)) }
            } else {
                items(state.exchangeRequests, key = { "ex_${it.id}" }) { request ->
                    RequestCard(
                        title = request.employeeName,
                        subtitle = request.note,
                        acceptLabel = stringResource(R.string.notif_approve),
                        declineLabel = stringResource(R.string.notif_reject),
                        onAccept = { viewModel.approveExchange(request) },
                        onDecline = { viewModel.rejectExchange(request) }
                    )
                }
            }

            // ── Time off ──
            item { SectionHeader(stringResource(R.string.notif_timeoff)) }
            if (state.timeOff.isEmpty()) {
                item { EmptyRow(stringResource(R.string.notif_no_timeoff)) }
            } else {
                items(state.timeOff, key = { "off_${it.employeeId}_${it.absence.id}" }) { item ->
                    val statusLabel = when (item.absence.status) {
                        AppAbsenceStatus.APPROVED -> stringResource(R.string.emp_notif_timeoff_approved)
                        AppAbsenceStatus.REJECTED -> stringResource(R.string.emp_notif_timeoff_rejected)
                        else -> stringResource(R.string.emp_notif_timeoff_submitted)
                    }
                    TimeOffCard(
                        title = item.employeeName,
                        subtitle = "${item.absence.absenceType.displayName} · ${item.absence.startDate} – ${item.absence.endDate}",
                        status = statusLabel,
                        removeLabel = stringResource(R.string.notif_remove),
                        onRemove = { viewModel.deleteTimeOff(item) }
                    )
                }
            }

            // ── New employees ──
            item { SectionHeader(stringResource(R.string.notif_new_employees)) }
            if (state.employeeRequests.isEmpty()) {
                item { EmptyRow(stringResource(R.string.notif_no_employees)) }
            } else {
                items(state.employeeRequests, key = { "emp_${it.id}" }) { request ->
                    RequestCard(
                        title = request.fullName,
                        subtitle = request.email,
                        acceptLabel = stringResource(R.string.notif_accept),
                        declineLabel = stringResource(R.string.notif_decline),
                        onAccept = { viewModel.acceptEmployee(request) },
                        onDecline = { viewModel.declineEmployee(request) }
                    )
                }
            }

            // ── Managers ──
            item { SectionHeader(stringResource(R.string.notif_managers)) }
            if (state.managerRequests.isEmpty()) {
                item { EmptyRow(stringResource(R.string.notif_no_managers)) }
            } else {
                items(state.managerRequests, key = { "mgr_${it.id}" }) { request ->
                    RequestCard(
                        title = request.fullName,
                        subtitle = request.email,
                        acceptLabel = stringResource(R.string.notif_accept),
                        declineLabel = stringResource(R.string.notif_decline),
                        onAccept = { viewModel.acceptManager(request) },
                        onDecline = { viewModel.declineManager(request) }
                    )
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
private fun RequestCard(
    title: String,
    subtitle: String,
    acceptLabel: String,
    declineLabel: String,
    onAccept: () -> Unit,
    onDecline: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
    ) {
        Column(
            Modifier
                .fillMaxWidth()
                .padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Text(title, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.SemiBold)
            if (subtitle.isNotBlank()) {
                Text(subtitle, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                TextButton(onClick = onAccept) { Text(acceptLabel) }
                OutlinedButton(onClick = onDecline) { Text(declineLabel) }
            }
        }
    }
}

@Composable
private fun TimeOffCard(
    title: String,
    subtitle: String,
    status: String,
    removeLabel: String,
    onRemove: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
    ) {
        Column(
            Modifier
                .fillMaxWidth()
                .padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Text(title, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.SemiBold)
            Text(subtitle, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(status, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = onRemove) { Text(removeLabel) }
            }
        }
    }
}
