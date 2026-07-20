package com.froggyriia.shiftplanner

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.appcompat.app.AppCompatActivity
import androidx.activity.compose.setContent
import androidx.core.os.LocaleListCompat
import androidx.appcompat.app.AppCompatDelegate
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewmodel.compose.viewModel
import com.froggyriia.shiftplanner.presentation.AppRoot
import com.froggyriia.shiftplanner.notifications.NotificationScheduler
import com.froggyriia.shiftplanner.presentation.auth.AuthViewModel
import com.froggyriia.shiftplanner.ui.theme.ShiftPlannerTheme
import com.froggyriia.shiftplanner.ui.theme.ThemeStore

class MainActivity : AppCompatActivity() {
    private val appContainer by lazy {
        AppContainer(applicationContext)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Initialise persisted theme preference
        ThemeStore.init(applicationContext)

        // Background poller that raises on-device notifications for new items.
        NotificationScheduler.schedule(applicationContext)
        requestNotificationPermissionIfNeeded()

        setContent {
            ShiftPlannerTheme {
                val authViewModel: AuthViewModel = viewModel(
                    factory = AuthViewModelFactory(appContainer)
                )
                AppRoot(authViewModel = authViewModel, appContainer = appContainer)
            }
        }
    }

    private val notificationPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { /* no-op: worker no-ops without permission */ }

    private fun requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val granted = ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
            if (!granted) {
                notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
    }

    companion object {
        /** Switch app language. Call from UI (e.g. Profile screen). */
        fun setLanguage(tag: String) {
            AppCompatDelegate.setApplicationLocales(LocaleListCompat.forLanguageTags(tag))
        }
    }
}

class AuthViewModelFactory(
    private val appContainer: AppContainer
) : ViewModelProvider.Factory {
    override fun <T : ViewModel> create(
        modelClass: Class<T>
    ): T {
        if (modelClass.isAssignableFrom(AuthViewModel::class.java)) {
            @Suppress("UNCHECKED_CAST")
            return AuthViewModel(
                repository = appContainer.authRepository
            ) as T
        }
        throw IllegalArgumentException("Unknown ViewModel class")
    }
}
