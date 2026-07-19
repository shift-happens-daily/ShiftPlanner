package com.froggyriia.shiftplanner.notifications

import android.content.Context

/**
 * Records which items the background poller has already surfaced, so each event
 * fires a phone notification only once. Backed by SharedPreferences (synchronous,
 * safe to touch from a worker thread).
 *
 * On the first poll after login/install we record baselines WITHOUT notifying,
 * to avoid a burst of notifications for pre-existing data.
 */
class SeenStore(context: Context) {

    private val prefs = context.getSharedPreferences("notif_seen", Context.MODE_PRIVATE)

    fun isInitialized(role: String): Boolean = prefs.getBoolean("init_$role", false)
    fun markInitialized(role: String) { prefs.edit().putBoolean("init_$role", true).apply() }

    fun lastScheduleId(): Int = prefs.getInt("schedule_id", -1)
    fun setLastScheduleId(id: Int) { prefs.edit().putInt("schedule_id", id).apply() }

    fun seenIds(key: String): Set<String> = prefs.getStringSet(key, emptySet()) ?: emptySet()

    fun setSeenIds(key: String, ids: Set<String>) {
        // Store a copy: SharedPreferences must not be handed a set it may mutate later.
        prefs.edit().putStringSet(key, HashSet(ids)).apply()
    }

    /** Returns the ids in [current] not previously seen under [key], and records the new baseline. */
    fun diffAndStore(key: String, current: Set<String>): Set<String> {
        val previous = seenIds(key)
        val fresh = current - previous
        setSeenIds(key, current)
        return fresh
    }

    fun clear() { prefs.edit().clear().apply() }

    companion object {
        const val ROLE_EMPLOYEE = "employee"
        const val ROLE_MANAGER = "manager"

        const val KEY_SHIFTS = "shift_ids"
        const val KEY_EXCHANGE = "exchange_ids"
        const val KEY_EMP_REQ = "emp_req_ids"
        const val KEY_MGR_REQ = "mgr_req_ids"
        const val KEY_TIMEOFF = "timeoff_ids"
    }
}
