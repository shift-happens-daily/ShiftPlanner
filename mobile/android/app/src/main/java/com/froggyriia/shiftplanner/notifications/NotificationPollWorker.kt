package com.froggyriia.shiftplanner.notifications

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.froggyriia.shiftplanner.AppContainer
import com.froggyriia.shiftplanner.R
import com.froggyriia.shiftplanner.domain.model.AppSchedule
import com.froggyriia.shiftplanner.domain.model.UserRole
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Periodically polls the existing REST endpoints and raises a system
 * notification for anything new since the last poll. This is the "push to the
 * phone" mechanism: there is no server-side notification store or FCM, so we
 * diff client-side against [SeenStore] and only notify on genuinely new items.
 *
 * Every network call is wrapped so a transient failure just skips this cycle;
 * WorkManager reschedules the next one.
 */
class NotificationPollWorker(
    appContext: Context,
    params: WorkerParameters
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result {
        val context = applicationContext
        val container = AppContainer(context)
        val seen = SeenStore(context)

        val user = runCatching { container.authRepository.getCurrentUser() }.getOrNull()
            ?: return Result.success() // not logged in — nothing to poll

        Notifier.ensureChannel(context)

        when (user.role) {
            UserRole.EMPLOYEE -> pollEmployee(context, container, seen)
            UserRole.MANAGER -> pollManager(context, container, seen, user.company?.id)
        }
        return Result.success()
    }

    private suspend fun pollEmployee(context: Context, container: AppContainer, seen: SeenStore) {
        val firstRun = !seen.isInitialized(SeenStore.ROLE_EMPLOYEE)

        val published: AppSchedule? =
            runCatching { container.scheduleRepository.fetchLatestSchedule("published") }.getOrNull()
        val shifts = runCatching { container.scheduleRepository.fetchMySchedule() }.getOrDefault(emptyList())

        // Newly published schedule
        if (published != null) {
            val prevScheduleId = seen.lastScheduleId()
            if (!firstRun && published.id != prevScheduleId) {
                val period = formatPeriod(published.startDate, published.endDate)
                Notifier.notify(
                    context,
                    id = 1001,
                    title = context.getString(R.string.notif_push_schedule_title),
                    message = if (period != null)
                        context.getString(R.string.notif_push_schedule_body, period)
                    else
                        context.getString(R.string.notif_push_schedule_body_nodate)
                )
            }
            seen.setLastScheduleId(published.id)
        }

        // Newly assigned shifts
        val currentShiftIds = shifts.map { it.id.toString() }.toSet()
        val freshShifts = seen.diffAndStore(SeenStore.KEY_SHIFTS, currentShiftIds)
        if (!firstRun && freshShifts.isNotEmpty()) {
            Notifier.notify(
                context,
                id = 1002,
                title = context.getString(R.string.notif_push_shifts_title),
                message = context.getString(R.string.notif_push_shifts_body, freshShifts.size)
            )
        }

        if (firstRun) seen.markInitialized(SeenStore.ROLE_EMPLOYEE)
    }

    private suspend fun pollManager(
        context: Context,
        container: AppContainer,
        seen: SeenStore,
        companyId: Int?
    ) {
        val firstRun = !seen.isInitialized(SeenStore.ROLE_MANAGER)
        val employeeRepo = container.employeeManagementRepository(companyId)

        val exchange = runCatching { container.scheduleRepository.fetchExchangeRequests() }.getOrDefault(emptyList())
        val empReq = runCatching { employeeRepo.fetchEmployeeRequests() }.getOrDefault(emptyList())
        val mgrReq = runCatching { employeeRepo.fetchManagerRequests() }.getOrDefault(emptyList())

        // Time off — fan out per employee (no aggregate endpoint).
        val timeOffIds = runCatching {
            val employees = employeeRepo.fetchEmployees()
            employees.flatMap { emp ->
                runCatching { container.absenceRepository.fetchEmployeeAbsences(emp.id) }
                    .getOrDefault(emptyList())
                    .map { "${emp.id}_${it.id}" }
            }.toSet()
        }.getOrDefault(emptySet())

        val freshExchange = seen.diffAndStore(SeenStore.KEY_EXCHANGE, exchange.map { it.id.toString() }.toSet())
        val freshEmp = seen.diffAndStore(SeenStore.KEY_EMP_REQ, empReq.map { it.id.toString() }.toSet())
        val freshMgr = seen.diffAndStore(SeenStore.KEY_MGR_REQ, mgrReq.map { it.id.toString() }.toSet())
        val freshTimeOff = seen.diffAndStore(SeenStore.KEY_TIMEOFF, timeOffIds)

        if (!firstRun) {
            if (freshExchange.isNotEmpty()) Notifier.notify(
                context, 2001,
                context.getString(R.string.notif_push_exchange_title),
                context.getString(R.string.notif_push_exchange_body, freshExchange.size)
            )
            if (freshEmp.isNotEmpty()) Notifier.notify(
                context, 2002,
                context.getString(R.string.notif_push_emp_req_title),
                context.getString(R.string.notif_push_emp_req_body, freshEmp.size)
            )
            if (freshMgr.isNotEmpty()) Notifier.notify(
                context, 2003,
                context.getString(R.string.notif_push_mgr_req_title),
                context.getString(R.string.notif_push_mgr_req_body, freshMgr.size)
            )
            if (freshTimeOff.isNotEmpty()) Notifier.notify(
                context, 2004,
                context.getString(R.string.notif_push_timeoff_title),
                context.getString(R.string.notif_push_timeoff_body, freshTimeOff.size)
            )
        }

        if (firstRun) seen.markInitialized(SeenStore.ROLE_MANAGER)
    }

    private val periodFormat = SimpleDateFormat("d MMM", Locale.getDefault())

    private fun formatPeriod(start: Date?, end: Date?): String? {
        if (start == null || end == null) return null
        return "${periodFormat.format(start)} – ${periodFormat.format(end)}"
    }
}
