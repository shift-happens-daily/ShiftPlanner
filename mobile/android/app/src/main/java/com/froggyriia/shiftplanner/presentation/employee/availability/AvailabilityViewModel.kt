package com.froggyriia.shiftplanner.presentation.employee.availability

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.froggyriia.shiftplanner.data.availability.AvailabilityRepository
import com.froggyriia.shiftplanner.domain.model.AvailabilityBlock
import com.froggyriia.shiftplanner.domain.model.AvailabilitySlotState
import com.froggyriia.shiftplanner.domain.model.EmployeeAvailabilityData
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class AvailabilityUiState(
    /** weekday (0=Mon … 6=Sun) → slot (0..47) → state; absent key means UNAVAILABLE */
    val grid: Map<Int, Map<Int, AvailabilitySlotState>> = emptyMap(),
    val isLoading: Boolean = false,
    val isSaving: Boolean = false,
    val hasChanges: Boolean = false,
    val errorMessage: String? = null,
    val statusMessage: String? = null
)

class AvailabilityViewModel(
    private val repository: AvailabilityRepository,
    private val employeeId: Int
) : ViewModel() {

    private val _uiState = MutableStateFlow(AvailabilityUiState())
    val uiState: StateFlow<AvailabilityUiState> = _uiState.asStateFlow()

    init {
        loadAvailability()
    }

    fun loadAvailability() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            try {
                val data = repository.fetchAvailability(employeeId)
                _uiState.value = _uiState.value.copy(
                    grid = blocksToGrid(data.weeklyAvailability),
                    isLoading = false,
                    hasChanges = false
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isLoading = false, errorMessage = e.message)
            }
        }
    }

    fun toggleSlot(weekday: Int, slot: Int) {
        val currentGrid = _uiState.value.grid
        val daySlots = currentGrid[weekday]?.toMutableMap() ?: mutableMapOf()
        val current = daySlots[slot] ?: AvailabilitySlotState.UNAVAILABLE
        val next = when (current) {
            AvailabilitySlotState.UNAVAILABLE -> AvailabilitySlotState.CAN_WORK
            AvailabilitySlotState.CAN_WORK -> AvailabilitySlotState.PREFER_NOT
            AvailabilitySlotState.PREFER_NOT -> AvailabilitySlotState.UNAVAILABLE
        }
        if (next == AvailabilitySlotState.UNAVAILABLE) {
            daySlots.remove(slot)
        } else {
            daySlots[slot] = next
        }
        val newGrid = currentGrid.toMutableMap()
        if (daySlots.isEmpty()) newGrid.remove(weekday) else newGrid[weekday] = daySlots
        _uiState.value = _uiState.value.copy(grid = newGrid, hasChanges = true)
    }

    fun saveAvailability() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isSaving = true, errorMessage = null)
            try {
                val blocks = gridToBlocks(_uiState.value.grid)
                repository.saveAvailability(
                    employeeId = employeeId,
                    data = EmployeeAvailabilityData(
                        employeeId = employeeId,
                        weeklyAvailability = blocks,
                        desiredDaysOff = emptyList()
                    )
                )
                _uiState.value = _uiState.value.copy(
                    isSaving = false,
                    hasChanges = false,
                    statusMessage = "Availability saved."
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isSaving = false, errorMessage = e.message)
            }
        }
    }

    fun clearMessages() {
        _uiState.value = _uiState.value.copy(errorMessage = null, statusMessage = null)
    }

    // ── Conversion helpers ─────────────────────────────────────────────────────

    private fun blocksToGrid(blocks: List<AvailabilityBlock>): Map<Int, Map<Int, AvailabilitySlotState>> {
        val grid = mutableMapOf<Int, MutableMap<Int, AvailabilitySlotState>>()
        for (block in blocks) {
            if (block.status == AvailabilitySlotState.UNAVAILABLE) continue
            val daySlots = grid.getOrPut(block.weekday) { mutableMapOf() }
            val startSlot = timeToSlot(block.startTime)
            val endSlot = timeToSlot(block.endTime)
            for (slot in startSlot until endSlot) {
                daySlots[slot] = block.status
            }
        }
        return grid
    }

    private fun gridToBlocks(grid: Map<Int, Map<Int, AvailabilitySlotState>>): List<AvailabilityBlock> {
        val blocks = mutableListOf<AvailabilityBlock>()
        for ((weekday, daySlots) in grid) {
            var runState: AvailabilitySlotState? = null
            var runStart: Int? = null
            for (slot in 0..48) {
                val state = if (slot < 48) (daySlots[slot] ?: AvailabilitySlotState.UNAVAILABLE)
                            else AvailabilitySlotState.UNAVAILABLE
                if (state != AvailabilitySlotState.UNAVAILABLE && state == runState) {
                    // continue run
                } else {
                    if (runState != null && runStart != null) {
                        blocks.add(AvailabilityBlock(weekday, slotToTime(runStart), slotToTime(slot), runState))
                    }
                    runState = if (state != AvailabilitySlotState.UNAVAILABLE) state else null
                    runStart = if (state != AvailabilitySlotState.UNAVAILABLE) slot else null
                }
            }
        }
        return blocks
    }

    private fun timeToSlot(time: String): Int {
        val parts = time.split(":")
        return parts[0].toInt() * 2 + parts[1].toInt() / 30
    }

    private fun slotToTime(slot: Int): String =
        "%02d:%02d:00".format(slot / 2, (slot % 2) * 30)
}
