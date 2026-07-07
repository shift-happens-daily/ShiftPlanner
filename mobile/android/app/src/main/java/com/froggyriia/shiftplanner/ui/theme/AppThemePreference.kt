package com.froggyriia.shiftplanner.ui.theme

import android.content.Context
import android.content.SharedPreferences
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

enum class AppThemePreference(val title: String) {
    LIGHT("Light"),
    DARK("Dark"),
    DOPAMINE("Dopamine")
}

/**
 * Singleton that persists the selected app theme across sessions.
 * Call [init] once from Application or MainActivity before use.
 */
object ThemeStore {

    private const val PREFS_NAME = "shiftplanner_prefs"
    private const val KEY_THEME = "app_theme"

    private lateinit var prefs: SharedPreferences

    private val _theme = MutableStateFlow(AppThemePreference.LIGHT)
    val theme: StateFlow<AppThemePreference> = _theme.asStateFlow()

    fun init(context: Context) {
        prefs = context.applicationContext
            .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val saved = prefs.getString(KEY_THEME, null)
        _theme.value = AppThemePreference.entries.firstOrNull { it.name == saved }
            ?: AppThemePreference.LIGHT
    }

    fun setTheme(preference: AppThemePreference) {
        _theme.value = preference
        prefs.edit().putString(KEY_THEME, preference.name).apply()
    }
}
