package com.froggyriia.shiftplanner

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import com.froggyriia.shiftplanner.data.auth.APIAuthRepository
import com.froggyriia.shiftplanner.presentation.auth.AuthScreen
import com.froggyriia.shiftplanner.presentation.auth.AuthViewModel
import com.froggyriia.shiftplanner.ui.theme.ShiftPlannerTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContent {
            ShiftPlannerTheme {
                val authViewModel: AuthViewModel = viewModel(
                    factory = AuthViewModelFactory(applicationContext)
                )

                AuthScreen(
                    viewModel = authViewModel
                )
            }
        }
    }
}

class AuthViewModelFactory(
    context: android.content.Context
) : ViewModelProvider.Factory {
    private val appContext = context.applicationContext

    override fun <T : ViewModel> create(
        modelClass: Class<T>
    ): T {
        if (modelClass.isAssignableFrom(AuthViewModel::class.java)) {
            @Suppress("UNCHECKED_CAST")
            return AuthViewModel(
                repository = APIAuthRepository(appContext)
            ) as T
        }

        throw IllegalArgumentException("Unknown ViewModel class")
    }
}
