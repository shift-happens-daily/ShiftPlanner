package com.froggyriia.shiftplanner.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue

// ── Color schemes ─────────────────────────────────────────────────────────────

private val LightColorScheme = lightColorScheme(
    primary = LightPrimary,
    onPrimary = LightOnPrimary,
    primaryContainer = LightPrimaryContainer,
    onPrimaryContainer = LightOnPrimaryContainer,
    secondary = LightSecondary,
    onSecondary = LightOnSecondary,
    secondaryContainer = LightSecondaryContainer,
    onSecondaryContainer = LightOnSecondaryContainer,
    background = LightBackground,
    surface = LightSurface,
    onBackground = LightOnBackground,
    onSurface = LightOnSurface,
    error = LightError,
    onError = LightOnError
)

private val DarkColorScheme = darkColorScheme(
    primary = DarkPrimary,
    onPrimary = DarkOnPrimary,
    primaryContainer = DarkPrimaryContainer,
    onPrimaryContainer = DarkOnPrimaryContainer,
    secondary = DarkSecondary,
    onSecondary = DarkOnSecondary,
    secondaryContainer = DarkSecondaryContainer,
    onSecondaryContainer = DarkOnSecondaryContainer,
    background = DarkBackground,
    surface = DarkSurface,
    onBackground = DarkOnBackground,
    onSurface = DarkOnSurface,
    error = DarkError,
    onError = DarkOnError
)

private val DopamineColorScheme = lightColorScheme(
    primary = DopaminePrimary,
    onPrimary = DopamineOnPrimary,
    primaryContainer = DopaminePrimaryContainer,
    onPrimaryContainer = DopamineOnPrimaryContainer,
    secondary = DopamineSecondary,
    onSecondary = DopamineOnSecondary,
    secondaryContainer = DopamineSecondaryContainer,
    onSecondaryContainer = DopamineOnSecondaryContainer,
    tertiary = DopamineTertiary,
    onTertiary = DopamineOnTertiary,
    background = DopamineBackground,
    surface = DopamineSurface,
    onBackground = DopamineOnBackground,
    onSurface = DopamineOnSurface,
    error = DopamineError,
    onError = DopamineOnError
)

// ── Theme composable ──────────────────────────────────────────────────────────

@Composable
fun ShiftPlannerTheme(
    content: @Composable () -> Unit
) {
    val preference by ThemeStore.theme.collectAsState()

    val colorScheme = when (preference) {
        AppThemePreference.LIGHT     -> LightColorScheme
        AppThemePreference.DARK      -> DarkColorScheme
        AppThemePreference.DOPAMINE  -> DopamineColorScheme
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}
