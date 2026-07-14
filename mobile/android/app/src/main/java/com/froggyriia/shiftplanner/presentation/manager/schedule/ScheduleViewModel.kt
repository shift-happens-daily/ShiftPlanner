package com.froggyriia.shiftplanner.presentation.manager.schedule

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.froggyriia.shiftplanner.data.company.CompanyRepository
import com.froggyriia.shiftplanner.data.employees.EmployeeManagementRepository
import com.froggyriia.shiftplanner.data.requirements.RequirementsRepository
import com.froggyriia.shiftplanner.data.schedule.ScheduleRepository
import com.froggyriia.shiftplanner.domain.model.AppAvailableEmployee
import com.froggyriia.shiftplanner.domain.model.AppBranchOption
import com.froggyriia.shiftplanner.domain.model.AppEmployeeAvailabilityStatus
import com.froggyriia.shiftplanner.domain.model.AppSchedule
import com.froggyriia.shiftplanner.domain.model.AppScheduleStatus
import com.froggyriia.shiftplanner.domain.model.AppScheduledShift
import com.froggyriia.shiftplanner.domain.model.AppUnfilledRequirement
import com.froggyriia.shiftplanner.domain.model.RequirementPositionOption
import com.froggyriia.shiftplanner.domain.model.ScheduleShiftMutation
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import com.froggyriia.shiftplanner.R

// ── View mode / filter ────────────────────────────────────────────────────────

enum class ScheduleViewMode { LIST, MONTH }
enum class ShiftFilter { ALL, FILLED, UNFILLED }

// ── Draft models ──────────────────────────────────────────────────────────────

data class ShiftDraft(
    val shiftId: Int? = null,
    val date: String = "",
    val positionId: Int? = null,
    val startMinutes: Int = 8 * 60,
    val endMinutes: Int = 16 * 60,
    val employeeId: Int? = null,
    val employeeName: String? = null
)

/**
 * An existing (draft/published) schedule that overlaps the period the user
 * tried to generate for. Shown in a resolution dialog: open it, or delete it
 * and regenerate.
 */
data class ScheduleConflict(
    val scheduleId: Int,
    val status: AppScheduleStatus,
    val startDate: String,
    val endDate: String,
    val requestedStart: String,
    val requestedEnd: String,
    val requestedBranchId: Int? = null
)

data class UnfilledReqDraft(
    val requirementId: Int,
    val date: String,
    val positionId: Int,
    val startMinutes: Int,
    val endMinutes: Int,
    val quantity: Int
)

// ── UI state ──────────────────────────────────────────────────────────────────

data class ScheduleUiState(
    val schedule: AppSchedule? = null,
    val allSchedules: List<AppSchedule> = emptyList(),
    val positions: List<RequirementPositionOption> = emptyList(),
    val weekDates: List<String> = emptyList(),
    val weekLabel: String = "",
    val viewMode: ScheduleViewMode = ScheduleViewMode.LIST,
    val shiftFilter: ShiftFilter = ShiftFilter.ALL,
    val isLoading: Boolean = false,
    val isGenerating: Boolean = false,
    val isPublishing: Boolean = false,
    val errorMessage: String? = null,
    val statusMessage: String? = null,
    // Localizable app-generated messages
    val errorMessageRes: Int? = null,
    val errorMessageArgs: List<Any> = emptyList(),
    val statusMessageRes: Int? = null,
    val statusMessageArgs: List<Any> = emptyList(),
    val availableEmployees: List<AppAvailableEmployee> = emptyList(),
    val loadingEmployees: Boolean = false,
    val conflict: ScheduleConflict? = null,
    val branches: List<AppBranchOption> = emptyList()
)

// ── ViewModel ─────────────────────────────────────────────────────────────────

class ScheduleViewModel(
    private val repository: ScheduleRepository,
    private val requirementsRepository: RequirementsRepository,
    private val companyRepository: CompanyRepository? = null,
    private val employeeRepository: EmployeeManagementRepository? = null
) : ViewModel() {

    // Company branches loaded on init. defaultBranchId is only a fallback:
    // the actual generation branch is chosen by where the period's
    // requirements are (see resolveGenerationBranch).
    private var branchOptions: List<AppBranchOption> = emptyList()
    private var defaultBranchId: Int? = null

    private val _uiState = MutableStateFlow(ScheduleUiState())
    val uiState: StateFlow<ScheduleUiState> = _uiState.asStateFlow()

    private var weekOffset = 0
    private val dateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.US)
    private val displayFormat = SimpleDateFormat("MMM d", Locale.US)

    init {
        refreshWeek()
        viewModelScope.launch {
            launch {
                runCatching { requirementsRepository.fetchPositions() }
                    .getOrNull()
                    ?.let { _uiState.value = _uiState.value.copy(positions = it) }
            }
            launch {
                runCatching { companyRepository?.fetchBranches() }
                    .getOrNull()
                    ?.let { branches ->
                        branchOptions = branches
                        defaultBranchId = branches.firstOrNull()?.id
                        _uiState.value = _uiState.value.copy(branches = branches)
                    }
            }
            loadLatestSchedule()
        }
    }

    // ── View mode / filter ────────────────────────────────────────────────────

    fun setViewMode(mode: ScheduleViewMode) {
        _uiState.value = _uiState.value.copy(viewMode = mode)
    }

    fun setFilter(filter: ShiftFilter) {
        _uiState.value = _uiState.value.copy(shiftFilter = filter)
    }

    // ── Schedule lifecycle ────────────────────────────────────────────────────

    fun loadLatestSchedule() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            try {
                val schedule = repository.fetchLatestSchedule()
                _uiState.value = _uiState.value.copy(schedule = schedule, isLoading = false)
                // Jump to the schedule's own week so it is never "invisible"
                // (previously the tab always opened on the current week and an
                // off-week schedule looked like "no schedule").
                alignWeekToDate(schedule?.startDate)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isLoading = false, errorMessage = e.message)
            }
        }
    }

    /**
     * Manual refresh: someone may be editing the same data from the web app,
     * and changes don't arrive automatically. Reloads the currently open
     * schedule by id (falling back to the latest one if it was deleted on the
     * web side), plus the branch and position dictionaries.
     */
    fun refresh(silent: Boolean = false) {
        val currentId = _uiState.value.schedule?.id
        viewModelScope.launch {
            launch {
                runCatching { requirementsRepository.fetchPositions() }
                    .getOrNull()
                    ?.let { _uiState.value = _uiState.value.copy(positions = it) }
            }
            launch {
                runCatching { companyRepository?.fetchBranches() }
                    .getOrNull()
                    ?.let { branches ->
                        branchOptions = branches
                        defaultBranchId = branches.firstOrNull()?.id
                        _uiState.value = _uiState.value.copy(branches = branches)
                    }
            }
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
            try {
                val schedule = if (currentId != null) {
                    try {
                        repository.fetchSchedule(currentId)
                    } catch (_: Exception) {
                        // Deleted or replaced from the web — show the latest one.
                        repository.fetchLatestSchedule()
                    }
                } else {
                    repository.fetchLatestSchedule()
                }
                _uiState.value = _uiState.value.copy(
                    schedule = schedule,
                    isLoading = false,
                    statusMessageRes = if (silent) null else R.string.schm_refreshed
                )
                alignWeekToDate(schedule?.startDate)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isLoading = false, errorMessage = e.message)
            }
        }
    }

    fun generateSchedule(startDate: String, endDate: String, branchId: Int? = null) {
        viewModelScope.launch { generateScheduleInternal(startDate, endDate, branchId) }
    }

    private suspend fun generateScheduleInternal(
        startDate: String,
        endDate: String,
        explicitBranchId: Int? = null
    ) {
        _uiState.value = _uiState.value.copy(isGenerating = true, errorMessage = null)

        // The backend solver only sees requirements and employees of the branch
        // sent in the request, and it happily saves an EMPTY schedule when the
        // period has no requirements for that branch. So instead of always
        // sending the first branch, pick the branch that actually has
        // requirements for this period — and refuse with a clear message when
        // there are none anywhere.
        val branchChoice = resolveGenerationBranch(startDate, endDate, explicitBranchId)
        if (branchChoice is GenerationBranchChoice.NoRequirements) {
            val branchName = explicitBranchId?.let { branchNameFor(it) }
            _uiState.value = _uiState.value.copy(
                isGenerating = false,
                errorMessageRes = if (branchName != null) R.string.schm_no_requirements_branch
                else R.string.schm_no_requirements,
                errorMessageArgs = if (branchName != null) listOf(startDate, endDate, branchName)
                else listOf(startDate, endDate)
            )
            return
        }
        val targetBranchId = (branchChoice as? GenerationBranchChoice.Branch)?.branchId
            ?: explicitBranchId
            ?: defaultBranchId

        // The backend rejects generation with 409 when ANY draft/published
        // schedule for the branch overlaps the period — including schedules the
        // user cannot see on this screen (other week, other branch, an empty
        // draft created before requirements existed). Detect that up front and
        // show a resolution dialog instead of a dead-end error.
        findConflict(startDate, endDate, targetBranchId)?.let { conflict ->
            _uiState.value = _uiState.value.copy(
                isGenerating = false,
                conflict = conflict.copy(requestedBranchId = targetBranchId)
            )
            return
        }

        try {
            val schedules = repository.generateSchedule(startDate, endDate, targetBranchId)
            val branchNote = branchNameFor(targetBranchId)?.takeIf { branchOptions.size > 1 }
            val (msgRes, msgArgs) = when {
                schedules.size > 1 -> R.string.schm_generated_n to listOf<Any>(schedules.size)
                branchNote != null -> R.string.schm_generated_branch to listOf<Any>(branchNote)
                else -> R.string.schm_generated to emptyList()
            }
            _uiState.value = _uiState.value.copy(
                allSchedules = schedules,
                schedule = schedules.firstOrNull(),
                isGenerating = false,
                statusMessageRes = msgRes,
                statusMessageArgs = msgArgs
            )
            alignWeekToDate(
                schedules.firstOrNull()?.startDate
                    ?: runCatching { dateFormat.parse(startDate) }.getOrNull()
            )
        } catch (e: Exception) {
            // Race fallback: the conflicting schedule may have appeared between
            // our pre-check and the generate call (409 from the backend).
            val lateConflict = findConflict(startDate, endDate, targetBranchId)
            if (lateConflict != null) {
                _uiState.value = _uiState.value.copy(
                    isGenerating = false,
                    conflict = lateConflict.copy(requestedBranchId = targetBranchId)
                )
            } else {
                _uiState.value = _uiState.value.copy(isGenerating = false, errorMessage = e.message)
            }
        }
    }

    private sealed interface GenerationBranchChoice {
        data class Branch(val branchId: Int?) : GenerationBranchChoice
        data object NoRequirements : GenerationBranchChoice
        data object Unknown : GenerationBranchChoice
    }

    /**
     * Picks the branch to generate for based on where the period's requirements
     * actually are. Requirements without a branch belong to the company's
     * default (first) branch on the backend.
     */
    private suspend fun resolveGenerationBranch(
        startDate: String,
        endDate: String,
        explicitBranchId: Int? = null
    ): GenerationBranchChoice {
        val requirements = runCatching {
            requirementsRepository.fetchRequirements(startDate, endDate)
        }.getOrNull()
            // If the check itself failed (network etc.), don't block generation.
            ?: return GenerationBranchChoice.Unknown
        if (explicitBranchId != null) {
            // The user picked a branch — respect it, but refuse when the period
            // has no requirements for it (the backend would save an empty
            // schedule that then blocks the period).
            val hasDemand = requirements.any { (it.branchId ?: defaultBranchId) == explicitBranchId }
            return if (hasDemand) GenerationBranchChoice.Branch(explicitBranchId)
            else GenerationBranchChoice.NoRequirements
        }
        if (requirements.isEmpty()) return GenerationBranchChoice.NoRequirements
        val branchesWithDemand = requirements
            .map { it.branchId ?: defaultBranchId }
            .distinct()
        return GenerationBranchChoice.Branch(
            if (defaultBranchId in branchesWithDemand) defaultBranchId
            else branchesWithDemand.firstOrNull() ?: defaultBranchId
        )
    }

    private fun branchNameFor(branchId: Int?): String? =
        branchOptions.firstOrNull { it.id == branchId }?.name

    /** Finds a draft/published schedule overlapping [startDate]..[endDate] for [branchId]. */
    private suspend fun findConflict(
        startDate: String,
        endDate: String,
        branchId: Int? = defaultBranchId
    ): ScheduleConflict? {
        val reqStart = runCatching { dateFormat.parse(startDate) }.getOrNull() ?: return null
        val reqEnd = runCatching { dateFormat.parse(endDate) }.getOrNull() ?: return null
        val candidates = runCatching {
            repository.fetchSchedules(startDate = startDate, endDate = endDate, branchId = branchId)
        }.getOrNull() ?: return null
        return candidates
            .asSequence()
            .filter { it.status != AppScheduleStatus.ARCHIVED }
            .filter { branchId == null || it.branchId == null || it.branchId == branchId }
            // Defensive overlap check in case the backend list filter semantics differ
            .filter { !it.startDate.after(reqEnd) && !it.endDate.before(reqStart) }
            .firstOrNull()
            ?.let {
                ScheduleConflict(
                    scheduleId = it.id,
                    status = it.status,
                    startDate = dateFormat.format(it.startDate),
                    endDate = dateFormat.format(it.endDate),
                    requestedStart = startDate,
                    requestedEnd = endDate
                )
            }
    }

    fun dismissConflict() {
        _uiState.value = _uiState.value.copy(conflict = null)
    }

    /** Loads and shows the conflicting schedule so the user can inspect or edit it. */
    fun openConflictingSchedule() {
        val conflict = _uiState.value.conflict ?: return
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(conflict = null, isLoading = true, errorMessage = null)
            try {
                val schedule = repository.fetchSchedule(conflict.scheduleId)
                _uiState.value = _uiState.value.copy(schedule = schedule, isLoading = false)
                alignWeekToDate(schedule.startDate)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isLoading = false, errorMessage = e.message)
            }
        }
    }

    /** Deletes the conflicting schedule, then retries generation for the requested period. */
    fun deleteConflictingAndRegenerate() {
        val conflict = _uiState.value.conflict ?: return
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(conflict = null, isGenerating = true, errorMessage = null)
            try {
                repository.deleteSchedule(conflict.scheduleId)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isGenerating = false, errorMessage = e.message)
                return@launch
            }
            // If several schedules overlap the period, the next one is surfaced
            // by the pre-check inside generateScheduleInternal.
            generateScheduleInternal(
                conflict.requestedStart,
                conflict.requestedEnd,
                conflict.requestedBranchId
            )
        }
    }

    /** Switch the active schedule when multiple branches are present. */
    fun selectSchedule(schedule: AppSchedule) {
        _uiState.value = _uiState.value.copy(schedule = schedule)
    }

    fun publishSchedule() {
        val id = _uiState.value.schedule?.id ?: return
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isPublishing = true, errorMessage = null)
            try {
                val published = repository.publishSchedule(id)
                _uiState.value = _uiState.value.copy(
                    schedule = published,
                    isPublishing = false,
                    statusMessageRes = R.string.schm_published
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isPublishing = false, errorMessage = e.message)
            }
        }
    }

    fun deleteSchedule(onDone: () -> Unit) {
        val id = _uiState.value.schedule?.id ?: return
        viewModelScope.launch {
            try {
                repository.deleteSchedule(id)
                // Show the empty "generate a schedule" screen for the week the
                // user was looking at. Other schedules may still exist in the
                // DB, but that no longer causes a dead end: the pre-generation
                // conflict check surfaces them with an open/delete dialog.
                _uiState.value = _uiState.value.copy(
                    schedule = null,
                    allSchedules = emptyList(),
                    statusMessageRes = R.string.schm_deleted
                )
                onDone()
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(errorMessage = e.message)
            }
        }
    }

    // ── Shift CRUD ────────────────────────────────────────────────────────────

    fun createShift(draft: ShiftDraft, onDone: (Boolean) -> Unit) {
        val schedId = _uiState.value.schedule?.id ?: return
        val posId = draft.positionId ?: run {
            _uiState.value = _uiState.value.copy(errorMessageRes = R.string.schm_select_position)
            onDone(false); return
        }
        if (draft.endMinutes <= draft.startMinutes) {
            _uiState.value = _uiState.value.copy(errorMessageRes = R.string.schm_end_after_start)
            onDone(false); return
        }
        viewModelScope.launch {
            try {
                val parsedDate = dateFormat.parse(draft.date) ?: Date()
                val updated = repository.createShift(
                    scheduleId = schedId,
                    mutation = ScheduleShiftMutation(
                        date = parsedDate,
                        startMinutes = draft.startMinutes,
                        endMinutes = draft.endMinutes,
                        positionId = posId,
                        employeeId = null
                    )
                )
                _uiState.value = _uiState.value.copy(
                    schedule = updated, statusMessageRes = R.string.schm_shift_created, errorMessage = null
                )
                onDone(true)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(errorMessage = e.message)
                onDone(false)
            }
        }
    }

    fun updateShift(draft: ShiftDraft, onDone: (Boolean) -> Unit) {
        val schedId = _uiState.value.schedule?.id ?: return
        val shiftId = draft.shiftId ?: return
        val posId = draft.positionId ?: run {
            _uiState.value = _uiState.value.copy(errorMessageRes = R.string.schm_select_position)
            onDone(false); return
        }
        if (draft.endMinutes <= draft.startMinutes) {
            _uiState.value = _uiState.value.copy(errorMessageRes = R.string.schm_end_after_start)
            onDone(false); return
        }
        viewModelScope.launch {
            try {
                val parsedDate = dateFormat.parse(draft.date) ?: Date()
                val updated = repository.updateShift(
                    scheduleId = schedId,
                    shiftId = shiftId,
                    mutation = ScheduleShiftMutation(
                        date = parsedDate,
                        startMinutes = draft.startMinutes,
                        endMinutes = draft.endMinutes,
                        positionId = posId,
                        employeeId = draft.employeeId?.takeIf { it > 0 }
                    )
                )
                _uiState.value = _uiState.value.copy(
                    schedule = updated, statusMessageRes = R.string.schm_shift_updated, errorMessage = null
                )
                onDone(true)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(errorMessage = e.message)
                onDone(false)
            }
        }
    }

    fun deleteShift(shift: AppScheduledShift) {
        val schedId = _uiState.value.schedule?.id ?: return
        viewModelScope.launch {
            try {
                val updated = repository.deleteShift(schedId, shift.id)
                _uiState.value = _uiState.value.copy(schedule = updated, statusMessageRes = R.string.schm_shift_removed)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(errorMessage = e.message)
            }
        }
    }

    // ── Unfilled requirement CRUD ─────────────────────────────────────────────

    fun updateScheduleRequirement(draft: UnfilledReqDraft, onDone: (Boolean) -> Unit) {
        val schedId = _uiState.value.schedule?.id ?: return
        if (draft.endMinutes <= draft.startMinutes) {
            _uiState.value = _uiState.value.copy(errorMessageRes = R.string.schm_end_after_start)
            onDone(false); return
        }
        viewModelScope.launch {
            try {
                val parsedDate = dateFormat.parse(draft.date) ?: Date()
                val updated = repository.updateScheduleRequirement(
                    scheduleId = schedId,
                    requirementId = draft.requirementId,
                    mutation = ScheduleShiftMutation(
                        date = parsedDate,
                        startMinutes = draft.startMinutes,
                        endMinutes = draft.endMinutes,
                        positionId = draft.positionId,
                        employeeId = null
                    ),
                    quantity = draft.quantity
                )
                _uiState.value = _uiState.value.copy(
                    schedule = updated, statusMessageRes = R.string.schm_requirement_updated, errorMessage = null
                )
                onDone(true)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(errorMessage = e.message)
                onDone(false)
            }
        }
    }

    // ── Employee assignment ───────────────────────────────────────────────────

    fun fetchAvailableEmployees(shift: AppScheduledShift) {
        val schedId = _uiState.value.schedule?.id ?: return
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(loadingEmployees = true)
            try {
                val employees = loadAssignableEmployees(schedId, shift)
                _uiState.value = _uiState.value.copy(availableEmployees = employees, loadingEmployees = false)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(loadingEmployees = false, errorMessage = e.message)
            }
        }
    }

    /**
     * Employees for the assignment sheet: the availability endpoint's matches
     * first (available → if-needed → unavailable), then EVERY other employee of
     * the company, so a shift can always be assigned manually even when nobody
     * fits the position/branch/availability filters.
     */
    private suspend fun loadAssignableEmployees(
        schedId: Int,
        shift: AppScheduledShift
    ): List<AppAvailableEmployee> {
        val fromAvailability = repository
            .fetchAvailableEmployees(schedId, shift, null, includeUnavailable = true)
            .sortedWith(compareBy({ it.availabilityStatus.ordinal }, { it.fullName }))
        val knownIds = fromAvailability.map { it.id }.toHashSet()
        val others = runCatching { employeeRepository?.fetchEmployees() }
            .getOrNull()
            .orEmpty()
            .filter { it.id !in knownIds }
            .sortedBy { it.fullName }
            .map {
                AppAvailableEmployee(
                    id = it.id,
                    fullName = it.fullName,
                    positionName = it.positionTitle ?: "Без должности",
                    branchId = it.branchId,
                    branchName = it.branchName,
                    availabilityStatus = AppEmployeeAvailabilityStatus.UNAVAILABLE,
                    assignedHours = 0.0
                )
            }
        return fromAvailability + others
    }

    fun fetchAvailableForRequirement(req: AppUnfilledRequirement) {
        val schedId = _uiState.value.schedule?.id ?: return
        val fakeShift = AppScheduledShift(
            id = req.id, employeeId = null, employeeName = null,
            positionId = req.positionId, positionName = req.positionTitle,
            date = req.date, startMinutes = req.startMinutes, endMinutes = req.endMinutes
        )
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(loadingEmployees = true)
            try {
                val employees = loadAssignableEmployees(schedId, fakeShift)
                _uiState.value = _uiState.value.copy(availableEmployees = employees, loadingEmployees = false)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(loadingEmployees = false, errorMessage = e.message)
            }
        }
    }

    fun assignShift(shiftId: Int, employeeId: Int) {
        val schedId = _uiState.value.schedule?.id ?: return
        val existing = _uiState.value.schedule?.shifts?.firstOrNull { it.id == shiftId } ?: return
        viewModelScope.launch {
            try {
                val updated = repository.updateShift(
                    scheduleId = schedId,
                    shiftId = shiftId,
                    mutation = ScheduleShiftMutation(
                        date = existing.date,
                        startMinutes = existing.startMinutes,
                        endMinutes = existing.endMinutes,
                        positionId = existing.positionId,
                        employeeId = employeeId
                    )
                )
                _uiState.value = _uiState.value.copy(
                    schedule = updated,
                    availableEmployees = emptyList(),
                    statusMessageRes = R.string.schm_employee_assigned
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(errorMessage = e.message)
            }
        }
    }

    fun assignRequirement(requirementId: Int, employeeId: Int) {
        val schedId = _uiState.value.schedule?.id ?: return
        viewModelScope.launch {
            try {
                val updated = repository.assignRequirement(schedId, requirementId, employeeId)
                _uiState.value = _uiState.value.copy(
                    schedule = updated,
                    availableEmployees = emptyList(),
                    statusMessageRes = R.string.schm_employee_assigned
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(errorMessage = e.message)
            }
        }
    }

    fun clearAvailableEmployees() {
        _uiState.value = _uiState.value.copy(availableEmployees = emptyList())
    }

    fun clearMessages() {
        _uiState.value = _uiState.value.copy(
            errorMessage = null, statusMessage = null,
            errorMessageRes = null, errorMessageArgs = emptyList(),
            statusMessageRes = null, statusMessageArgs = emptyList()
        )
    }

    /** Builds CSV from current schedule for export. */
    fun buildScheduleCsv(): String {
        val schedule = _uiState.value.schedule ?: return ""
        val sb = StringBuilder()
        sb.appendLine("Date,Employee,Position,Start,End,Hours,Status")
        val dateFmt = SimpleDateFormat("yyyy-MM-dd", Locale.US)
        val allShifts = schedule.shifts.sortedWith(compareBy({ dateFmt.format(it.date) }, { it.startMinutes }))
        allShifts.forEach { shift ->
            val hours = (shift.endMinutes - shift.startMinutes) / 60.0
            sb.appendLine(
                "${dateFmt.format(shift.date)}," +
                "${csvEsc(shift.employeeName ?: "Unassigned")}," +
                "${csvEsc(shift.positionName)}," +
                "${minutesToDisplay(shift.startMinutes)}," +
                "${minutesToDisplay(shift.endMinutes)}," +
                "${"%.1f".format(hours)}," +
                "${if (shift.hasAssignedEmployee) "Assigned" else "Unassigned"}"
            )
        }
        schedule.unfilledRequirements
            .sortedWith(compareBy({ dateFmt.format(it.date) }, { it.startMinutes }))
            .forEach { req ->
                val hours = (req.endMinutes - req.startMinutes) / 60.0
                repeat(req.missingStaff) {
                    sb.appendLine(
                        "${dateFmt.format(req.date)}," +
                        "UNFILLED," +
                        "${csvEsc(req.positionTitle)}," +
                        "${minutesToDisplay(req.startMinutes)}," +
                        "${minutesToDisplay(req.endMinutes)}," +
                        "${"%.1f".format(hours)}," +
                        "Unfilled"
                    )
                }
            }
        return sb.toString()
    }

    private fun csvEsc(value: String): String =
        if (value.contains(',') || value.contains('"') || value.contains('\n'))
            "\"${value.replace("\"", "\"\"")}\""
        else value

    // ── Week navigation ───────────────────────────────────────────────────────

    fun previousWeek() { weekOffset--; refreshWeek() }
    fun nextWeek() { weekOffset++; refreshWeek() }

    /** Moves the visible week so that it contains [date] (no-op when null). */
    private fun alignWeekToDate(date: Date?) {
        if (date == null) return
        fun mondayOf(source: Calendar): Calendar {
            val cal = source.clone() as Calendar
            val days = (cal.get(Calendar.DAY_OF_WEEK) - Calendar.MONDAY + 7) % 7
            cal.add(Calendar.DAY_OF_YEAR, -days)
            cal.set(Calendar.HOUR_OF_DAY, 0)
            cal.set(Calendar.MINUTE, 0)
            cal.set(Calendar.SECOND, 0)
            cal.set(Calendar.MILLISECOND, 0)
            return cal
        }
        val targetMonday = mondayOf(Calendar.getInstance().apply { time = date })
        val currentMonday = mondayOf(Calendar.getInstance())
        val diffDays = ((targetMonday.timeInMillis - currentMonday.timeInMillis) /
                (24L * 60L * 60L * 1000L)).toInt()
        weekOffset = Math.floorDiv(diffDays, 7)
        refreshWeek()
    }

    private fun refreshWeek() {
        val dates = weekDates(weekOffset)
        val label = "${displayFormat.format(dateFormat.parse(dates.first())!!)} – " +
                "${displayFormat.format(dateFormat.parse(dates.last())!!)}"
        _uiState.value = _uiState.value.copy(weekDates = dates, weekLabel = label)
    }

    // ── Filtered helpers ──────────────────────────────────────────────────────

    fun shiftsForDate(date: String): List<AppScheduledShift> {
        val target = dateFormat.parse(date) ?: return emptyList()
        val filter = _uiState.value.shiftFilter
        return _uiState.value.schedule?.shifts
            ?.filter { isSameDay(it.date, target) }
            ?.filter { shift ->
                when (filter) {
                    ShiftFilter.ALL -> true
                    ShiftFilter.FILLED -> shift.hasAssignedEmployee
                    ShiftFilter.UNFILLED -> !shift.hasAssignedEmployee
                }
            }
            ?.sortedBy { it.startMinutes }
            ?: emptyList()
    }

    fun unfilledForDate(date: String): List<AppUnfilledRequirement> {
        val target = dateFormat.parse(date) ?: return emptyList()
        // Unfilled reqs only shown in ALL or UNFILLED filter
        if (_uiState.value.shiftFilter == ShiftFilter.FILLED) return emptyList()
        return _uiState.value.schedule?.unfilledRequirements
            ?.filter { isSameDay(it.date, target) }
            ?.sortedBy { it.startMinutes }
            ?: emptyList()
    }

    fun currentWeekStart(): String = _uiState.value.weekDates.firstOrNull() ?: todayString()
    fun currentWeekEnd(): String = _uiState.value.weekDates.lastOrNull() ?: todayString()

    private fun isSameDay(a: Date, b: Date): Boolean {
        val ca = Calendar.getInstance().apply { time = a }
        val cb = Calendar.getInstance().apply { time = b }
        return ca.get(Calendar.YEAR) == cb.get(Calendar.YEAR) &&
                ca.get(Calendar.DAY_OF_YEAR) == cb.get(Calendar.DAY_OF_YEAR)
    }

    private fun weekDates(offset: Int): List<String> {
        val cal = Calendar.getInstance()
        val daysToMon = (cal.get(Calendar.DAY_OF_WEEK) - Calendar.MONDAY + 7) % 7
        cal.add(Calendar.DAY_OF_YEAR, -daysToMon + offset * 7)
        return (0..6).map { i ->
            val c = cal.clone() as Calendar
            c.add(Calendar.DAY_OF_YEAR, i)
            "%04d-%02d-%02d".format(c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH))
        }
    }

    private fun todayString(): String {
        val cal = Calendar.getInstance()
        return "%04d-%02d-%02d".format(cal.get(Calendar.YEAR), cal.get(Calendar.MONTH) + 1, cal.get(Calendar.DAY_OF_MONTH))
    }

    companion object {
        fun minutesToDisplay(minutes: Int): String = "%02d:%02d".format(minutes / 60, minutes % 60)

        val minuteOptions: List<Pair<Int, String>> = (0..47).map { slot ->
            val m = slot * 30
            m to "%02d:%02d".format(m / 60, m % 60)
        }
    }
}
