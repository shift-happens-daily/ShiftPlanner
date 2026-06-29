package com.froggyriia.shiftplanner

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewmodel.compose.viewModel
import com.froggyriia.shiftplanner.presentation.AppRoot
import com.froggyriia.shiftplanner.presentation.auth.AuthScreen
import com.froggyriia.shiftplanner.presentation.auth.AuthViewModel
import com.froggyriia.shiftplanner.ui.theme.ShiftPlannerTheme

class MainActivity : ComponentActivity() {
    private val appContainer by lazy {
        AppContainer(applicationContext)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContent {
            ShiftPlannerTheme {
                val authViewModel: AuthViewModel = viewModel(
                    factory = AuthViewModelFactory(appContainer)
                )

                AppRoot(authViewModel = authViewModel)
            }
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
