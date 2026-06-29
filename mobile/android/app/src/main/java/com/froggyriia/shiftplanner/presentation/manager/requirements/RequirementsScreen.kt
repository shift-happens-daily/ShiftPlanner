package com.froggyriia.shiftplanner.presentation.manager.requirements

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
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ChevronLeft
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
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
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.froggyriia.shiftplanner.domain.model.AppUser
import com.froggyriia.shiftplanner.domain.model.RequirementOccurrence
import com.froggyriia.shiftplanner.domain.model.RequirementPositionOption
import java.text.SimpleDateFormat
import java.util.Locale

private val DAY_LABELS = listOf("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RequirementsScreen(
    user: AppUser,
    viewModel: RequirementsViewModel
) {
    val state by viewModel.uiState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }

    var editDraft by rememberSaveable { mutableStateOf<RequirementDraft?>(null) }
    var deleteTarget by remember { mutableStateOf<RequirementOccurrence?>(null) }

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
                title = { Text("Requirements") },
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) }
    ) { padding ->
        Column(Modifier.padding(padding)) {
            // Week navigation bar
            WeekNavBar(
                label = state.weekLabel,
                onPrev = viewModel::previousWeek,
                onNext = viewModel::nextWeek
            )

            if (state.isLoading) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            } else {
                LazyColumn(Modifier.fillMaxSize()) {
                    state.weekDates.forEachIndexed { index, date ->
                        val dayReqs = viewModel.requirementsForDate(date)
                        item(key = "header_$date") {
                            DayHeader(
                                dayLabel = DAY_LABELS[index],
                                date = date,
                                onAddClick = {
                                    editDraft = RequirementDraft(date = date)
                                }
                            )
                        }
                        if (dayReqs.isEmpty()) {
                            item(key = "empty_$date") {
                                Text(
                                    "No requirements",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp)
                                )
                            }
                        } else {
                            items(dayReqs, key = { it.id }) { req ->
                                RequirementCard(
                                    req = req,
                                    positionName = viewModel.positionName(req.positionId),
                                    onEdit = {
                                        editDraft = RequirementDraft(
                                            id = req.id,
                                            date = date,
                                            positionId = req.positionId,
                                            branchId = req.branchId,
                                            quantity = req.quantity,
                                            startSlot = req.startSlot,
                                            endSlot = req.endSlot
                                        )
                                    },
                                    onDelete = { deleteTarget = req }
                                )
                            }
                        }
                        item(key = "divider_$date") { HorizontalDivider() }
                    }
                    item { Spacer(Modifier.height(16.dp)) }
                }
            }
        }
    }

    // ── Edit / Create Sheet ───────────────────────────────────────────────────
    editDraft?.let { draft ->
        RequirementEditSheet(
            draft = draft,
            positions = state.positions,
            onDraftChange = { editDraft = it },
            onSave = {
                if (draft.id == null) {
                    viewModel.createRequirement(draft) { ok -> if (ok) editDraft = null }
                } else {
                    viewModel.updateRequirement(draft) { ok -> if (ok) editDraft = null }
                }
            },
            onDismiss = { editDraft = null }
        )
    }

    // ── Delete Confirm ────────────────────────────────────────────────────────
    deleteTarget?.let { req ->
        AlertDialog(
            onDismissRequest = { deleteTarget = null },
            title = { Text("Delete requirement?") },
            text = {
                Text("Remove the ${viewModel.positionName(req.positionId)} requirement? This cannot be undone.")
            },
            confirmButton = {
                Button(
                    onClick = { viewModel.deleteRequirement(req); deleteTarget = null },
                    colors = androidx.compose.material3.ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.error
                    )
                ) { Text("Delete") }
            },
            dismissButton = {
                TextButton(onClick = { deleteTarget = null }) { Text("Cancel") }
            }
        )
    }
}

// ── Composables ───────────────────────────────────────────────────────────────

@Composable
private fun WeekNavBar(label: String, onPrev: () -> Unit, onNext: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 8.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        IconButton(onClick = onPrev) { Icon(Icons.Default.ChevronLeft, "Previous week") }
        Text(label, style = MaterialTheme.typography.titleMedium)
        IconButton(onClick = onNext) { Icon(Icons.Default.ChevronRight, "Next week") }
    }
}

@Composable
private fun DayHeader(dayLabel: String, date: String, onAddClick: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(start = 16.dp, end = 4.dp, top = 12.dp, bottom = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        val displayDate = remember(date) {
            try {
                val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.US)
                val out = SimpleDateFormat("MMM d", Locale.US)
                "$dayLabel, ${out.format(sdf.parse(date)!!)}"
            } catch (_: Exception) { dayLabel }
        }
        Text(displayDate, style = MaterialTheme.typography.titleSmall)
        IconButton(onClick = onAddClick) { Icon(Icons.Default.Add, "Add requirement") }
    }
}

@Composable
private fun RequirementCard(
    req: RequirementOccurrence,
    positionName: String,
    onEdit: () -> Unit,
    onDelete: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp)
    ) {
        Row(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(Modifier.weight(1f)) {
                Text(positionName, style = MaterialTheme.typography.bodyLarge)
                Text(
                    "${RequirementsViewModel.slotToDisplayTime(req.startSlot)} – ${RequirementsViewModel.slotToDisplayTime(req.endSlot)}  ×${req.quantity}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            IconButton(onClick = onEdit) { Icon(Icons.Default.Edit, "Edit") }
            IconButton(onClick = onDelete) { Icon(Icons.Default.Delete, "Delete") }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun RequirementEditSheet(
    draft: RequirementDraft,
    positions: List<RequirementPositionOption>,
    onDraftChange: (RequirementDraft) -> Unit,
    onSave: () -> Unit,
    onDismiss: () -> Unit
) {
    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp)
                .padding(bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                if (draft.id == null) "Add Requirement" else "Edit Requirement",
                style = MaterialTheme.typography.titleMedium
            )

            // Position picker
            SlotDropdown(
                label = "Position",
                options = positions.map { it.id to it.name },
                selectedId = draft.positionId,
                onSelect = { onDraftChange(draft.copy(positionId = it)) }
            )

            // Start / End time
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Box(Modifier.weight(1f)) {
                    SlotDropdown(
                        label = "Start time",
                        options = RequirementsViewModel.timeSlots,
                        selectedId = draft.startSlot,
                        onSelect = { onDraftChange(draft.copy(startSlot = it)) }
                    )
                }
                Box(Modifier.weight(1f)) {
                    SlotDropdown(
                        label = "End time",
                        options = RequirementsViewModel.timeSlots,
                        selectedId = draft.endSlot,
                        onSelect = { onDraftChange(draft.copy(endSlot = it)) }
                    )
                }
            }

            // Quantity
            OutlinedTextField(
                value = draft.quantity.toString(),
                onValueChange = { v -> v.toIntOrNull()?.let { onDraftChange(draft.copy(quantity = it.coerceAtLeast(1))) } },
                label = { Text("Quantity") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )

            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                TextButton(onClick = onDismiss, modifier = Modifier.weight(1f)) { Text("Cancel") }
                Button(
                    onClick = onSave,
                    enabled = draft.positionId != null && draft.endSlot > draft.startSlot,
                    modifier = Modifier.weight(1f)
                ) { Text("Save") }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SlotDropdown(
    label: String,
    options: List<Pair<Int, String>>,
    selectedId: Int?,
    onSelect: (Int) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }
    val selectedLabel = options.firstOrNull { it.first == selectedId }?.second ?: "Select…"

    ExposedDropdownMenuBox(
        expanded = expanded,
        onExpandedChange = { expanded = it }
    ) {
        OutlinedTextField(
            value = selectedLabel,
            onValueChange = {},
            readOnly = true,
            label = { Text(label) },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded) },
            modifier = Modifier
                .fillMaxWidth()
                .menuAnchor()
        )
        ExposedDropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false }
        ) {
            options.forEach { (id, name) ->
                DropdownMenuItem(
                    text = { Text(name) },
                    onClick = { onSelect(id); expanded = false }
                )
            }
        }
    }
}
