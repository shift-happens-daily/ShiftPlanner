package com.froggyriia.shiftplanner.presentation.employee.absence

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
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Badge
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
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
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.froggyriia.shiftplanner.domain.model.AppAbsence
import com.froggyriia.shiftplanner.domain.model.AppAbsenceStatus
import com.froggyriia.shiftplanner.domain.model.AppAbsenceType
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import androidx.compose.ui.res.stringResource
import com.froggyriia.shiftplanner.R

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AbsencesScreen(viewModel: AbsencesViewModel) {
    val state by viewModel.uiState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(Unit) { viewModel.loadAbsences() }

    LaunchedEffect(state.statusMessage) {
        state.statusMessage?.let { snackbarHostState.showSnackbar(it); viewModel.clearMessages() }
    }
    LaunchedEffect(state.errorMessage) {
        state.errorMessage?.let { snackbarHostState.showSnackbar(it); viewModel.clearMessages() }
    }
    val context = androidx.compose.ui.platform.LocalContext.current
    LaunchedEffect(state.statusMessageRes, state.errorMessageRes) {
        val res = state.statusMessageRes ?: state.errorMessageRes
        if (res != null) {
            snackbarHostState.showSnackbar(context.getString(res))
            viewModel.clearMessages()
        }
    }

    var absenceType by rememberSaveable { mutableStateOf(AppAbsenceType.VACATION.name) }
    var startDate by rememberSaveable { mutableStateOf("") }
    var endDate by rememberSaveable { mutableStateOf("") }
    var comment by rememberSaveable { mutableStateOf("") }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.abs_title)) },
                actions = {
                    IconButton(onClick = viewModel::loadAbsences, enabled = !state.isLoading) {
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
        ) {
            // ── Add absence ───────────────────────────────────────────────────
            Card(
                Modifier.fillMaxWidth().padding(16.dp),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f)
                )
            ) {
                Column(
                    Modifier.fillMaxWidth().padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text(
                        stringResource(R.string.abs_add_title),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold
                    )

                    AbsenceTypeDropdown(
                        selected = AppAbsenceType.valueOf(absenceType),
                        onSelect = { absenceType = it.name }
                    )

                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Box(Modifier.weight(1f)) {
                            AbsenceDateField(
                                label = stringResource(R.string.abs_start),
                                value = startDate,
                                onPick = { startDate = it }
                            )
                        }
                        Box(Modifier.weight(1f)) {
                            AbsenceDateField(
                                label = stringResource(R.string.abs_end),
                                value = endDate,
                                onPick = { endDate = it }
                            )
                        }
                    }

                    OutlinedTextField(
                        value = comment,
                        onValueChange = { comment = it },
                        label = { Text(stringResource(R.string.abs_comment)) },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )

                    Button(
                        onClick = {
                            viewModel.createAbsence(
                                type = AppAbsenceType.valueOf(absenceType),
                                startDate = startDate,
                                endDate = endDate,
                                comment = comment
                            ) { ok ->
                                if (ok) {
                                    startDate = ""; endDate = ""; comment = ""
                                }
                            }
                        },
                        enabled = !state.isSubmitting && startDate.isNotBlank() && endDate.isNotBlank(),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        if (state.isSubmitting) {
                            CircularProgressIndicator(Modifier.height(18.dp))
                        } else {
                            Text(stringResource(R.string.abs_add_button))
                        }
                    }
                }
            }

            // ── My absences ───────────────────────────────────────────────────
            Text(
                stringResource(R.string.abs_my_title),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp)
            )

            when {
                state.isLoading -> Box(
                    Modifier.fillMaxWidth().padding(32.dp),
                    contentAlignment = Alignment.Center
                ) { CircularProgressIndicator() }

                state.absences.isEmpty() -> Text(
                    stringResource(R.string.abs_none),
                    modifier = Modifier.padding(16.dp),
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                else -> state.absences.forEach { absence ->
                    AbsenceCard(absence = absence, onDelete = { viewModel.deleteAbsence(absence) })
                }
            }

            Spacer(Modifier.height(24.dp))
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AbsenceTypeDropdown(
    selected: AppAbsenceType,
    onSelect: (AppAbsenceType) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }
    ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { expanded = it }) {
        OutlinedTextField(
            value = absenceTypeLabel(selected),
            onValueChange = {},
            readOnly = true,
            label = { Text(stringResource(R.string.abs_type)) },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded) },
            modifier = Modifier.fillMaxWidth().menuAnchor()
        )
        ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            AppAbsenceType.entries.forEach { type ->
                DropdownMenuItem(
                    text = { Text(absenceTypeLabel(type)) },
                    onClick = { onSelect(type); expanded = false }
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AbsenceDateField(
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
            placeholder = { Text(stringResource(R.string.abs_date_placeholder)) },
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

@Composable
private fun AbsenceCard(absence: AppAbsence, onDelete: () -> Unit) {
    val displayFmt = remember { SimpleDateFormat("dd.MM.yyyy", Locale.US) }
    val parseFmt = remember { SimpleDateFormat("yyyy-MM-dd", Locale.US) }
    fun fmt(date: String): String =
        runCatching { displayFmt.format(parseFmt.parse(date)!!) }.getOrDefault(date)

    Card(
        Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f)
        )
    ) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        absenceTypeLabel(absence.absenceType),
                        style = MaterialTheme.typography.bodyLarge,
                        fontWeight = FontWeight.Medium
                    )
                    // Status badge only when the backend actually reports a status.
                    absence.status?.let { status ->
                        Spacer(Modifier.height(0.dp))
                        Badge(
                            containerColor = when (status) {
                                AppAbsenceStatus.APPROVED -> MaterialTheme.colorScheme.primaryContainer
                                AppAbsenceStatus.PENDING -> MaterialTheme.colorScheme.secondaryContainer
                                AppAbsenceStatus.REJECTED -> MaterialTheme.colorScheme.errorContainer
                            },
                            modifier = Modifier.padding(start = 8.dp)
                        ) {
                            Text(
                                when (status) {
                                    AppAbsenceStatus.APPROVED -> stringResource(R.string.abs_status_approved)
                                    AppAbsenceStatus.PENDING -> stringResource(R.string.abs_status_pending)
                                    AppAbsenceStatus.REJECTED -> stringResource(R.string.abs_status_rejected)
                                },
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                                style = MaterialTheme.typography.labelSmall
                            )
                        }
                    }
                }
                Text(
                    "${fmt(absence.startDate)} — ${fmt(absence.endDate)}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                absence.comment?.takeIf { it.isNotBlank() }?.let {
                    Text(
                        it,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
            IconButton(onClick = onDelete) {
                Icon(
                    Icons.Default.Delete,
                    contentDescription = stringResource(R.string.delete),
                    tint = MaterialTheme.colorScheme.error
                )
            }
        }
    }
}

@Composable
private fun absenceTypeLabel(type: AppAbsenceType): String = when (type) {
    AppAbsenceType.VACATION -> stringResource(R.string.abs_type_vacation)
    AppAbsenceType.SICK_LEAVE -> stringResource(R.string.abs_type_sick)
    AppAbsenceType.OTHER -> stringResource(R.string.abs_type_other)
}
