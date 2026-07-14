package com.froggyriia.shiftplanner.presentation.employee.reports

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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import androidx.compose.ui.res.stringResource
import com.froggyriia.shiftplanner.R

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MyReportScreen(viewModel: MyReportViewModel) {
    val state by viewModel.uiState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(Unit) { viewModel.load() }

    LaunchedEffect(state.errorMessage) {
        state.errorMessage?.let { snackbarHostState.showSnackbar(it); viewModel.clearMessages() }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.myrep_title)) },
                actions = {
                    IconButton(onClick = viewModel::load, enabled = !state.isLoading) {
                        Icon(Icons.Default.Refresh, contentDescription = stringResource(R.string.common_refresh))
                    }
                }
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) }
    ) { padding ->
        Column(
            Modifier
                .padding(padding)
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Quick ranges
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(
                    selected = false,
                    onClick = viewModel::setCurrentWeek,
                    label = { Text(stringResource(R.string.myrep_this_week)) }
                )
                FilterChip(
                    selected = false,
                    onClick = viewModel::setCurrentMonth,
                    label = { Text(stringResource(R.string.myrep_this_month)) }
                )
            }

            // Period pickers
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Box(Modifier.weight(1f)) {
                    ReportDateField(
                        label = stringResource(R.string.common_from),
                        value = state.startDate,
                        onPick = { viewModel.setPeriod(it, state.endDate) }
                    )
                }
                Box(Modifier.weight(1f)) {
                    ReportDateField(
                        label = stringResource(R.string.common_to),
                        value = state.endDate,
                        onPick = { viewModel.setPeriod(state.startDate, it) }
                    )
                }
            }

            when {
                state.isLoading -> Box(
                    Modifier.fillMaxWidth().padding(32.dp),
                    contentAlignment = Alignment.Center
                ) { CircularProgressIndicator() }

                state.report != null -> {
                    val report = state.report!!
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        ReportStatCard(
                            value = "%.1f".format(report.totalHours),
                            unit = stringResource(R.string.myrep_hours_unit),
                            label = stringResource(R.string.myrep_hours_label),
                            modifier = Modifier.weight(1f)
                        )
                        ReportStatCard(
                            value = "${report.totalShifts}",
                            unit = "",
                            label = stringResource(R.string.myrep_shifts_label),
                            modifier = Modifier.weight(1f)
                        )
                    }
                    if (report.totalShifts > 0) {
                        Text(
                            stringResource(R.string.myrep_avg, "%.1f".format(report.totalHours / report.totalShifts)),
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    } else {
                        Text(
                            stringResource(R.string.myrep_empty),
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }

            Spacer(Modifier.height(8.dp))
        }
    }
}

@Composable
private fun ReportStatCard(
    value: String,
    unit: String,
    label: String,
    modifier: Modifier = Modifier
) {
    Card(
        modifier,
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.45f)
        )
    ) {
        Column(Modifier.fillMaxWidth().padding(16.dp)) {
            Text(
                if (unit.isBlank()) value else "$value $unit",
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onPrimaryContainer
            )
            Text(
                label,
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.75f)
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ReportDateField(
    label: String,
    value: String,
    onPick: (String) -> Unit
) {
    var showPicker by remember { mutableStateOf(false) }
    val displayFmt = remember { SimpleDateFormat("dd.MM.yyyy", Locale.US) }
    val parseFmt = remember { SimpleDateFormat("yyyy-MM-dd", Locale.US) }
    val display = remember(value) {
        if (value.isBlank()) ""
        else runCatching { displayFmt.format(parseFmt.parse(value)!!) }.getOrDefault(value)
    }

    Box {
        OutlinedTextField(
            value = display,
            onValueChange = {},
            readOnly = true,
            label = { Text(label) },
            trailingIcon = { Icon(Icons.Default.CalendarMonth, contentDescription = label) },
            modifier = Modifier.fillMaxWidth()
        )
        Box(Modifier.matchParentSize().clickable { showPicker = true })
    }

    if (showPicker) {
        val utcFmt = remember {
            SimpleDateFormat("yyyy-MM-dd", Locale.US).apply {
                timeZone = TimeZone.getTimeZone("UTC")
            }
        }
        val initialMillis = remember(value) {
            value.takeIf { it.isNotBlank() }
                ?.let { runCatching { utcFmt.parse(it)?.time }.getOrNull() }
        }
        val pickerState = rememberDatePickerState(initialSelectedDateMillis = initialMillis)
        DatePickerDialog(
            onDismissRequest = { showPicker = false },
            confirmButton = {
                TextButton(onClick = {
                    pickerState.selectedDateMillis?.let { onPick(utcFmt.format(Date(it))) }
                    showPicker = false
                }) { Text(stringResource(R.string.common_ok)) }
            },
            dismissButton = {
                TextButton(onClick = { showPicker = false }) { Text(stringResource(R.string.cancel)) }
            }
        ) {
            DatePicker(state = pickerState)
        }
    }
}
