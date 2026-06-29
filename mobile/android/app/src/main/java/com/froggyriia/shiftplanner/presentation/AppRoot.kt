package com.froggyriia.shiftplanner.presentation

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.froggyriia.shiftplanner.AppContainer
import com.froggyriia.shiftplanner.domain.model.AppUser
import com.froggyriia.shiftplanner.domain.model.UserRole
import com.froggyriia.shiftplanner.presentation.auth.AuthScreen
import com.froggyriia.shiftplanner.presentation.auth.AuthViewModel
import com.froggyriia.shiftplanner.presentation.manager.company.CompanyScreen
import com.froggyriia.shiftplanner.presentation.manager.company.CompanyInviteSheet
import com.froggyriia.shiftplanner.presentation.manager.company.CompanyInviteViewModel

@Composable
fun AppRoot(
    authViewModel: AuthViewModel,
    appContainer: AppContainer
) {
    val uiState by authViewModel.uiState.collectAsState()

    if (uiState.isLoading && uiState.currentUser == null) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator()
        }
        return
    }

    val currentUser = uiState.currentUser
    if (currentUser == null) {
        AuthScreen(viewModel = authViewModel)
        return
    }

    when (currentUser.role) {
        UserRole.MANAGER -> ManagerShell(
            user = currentUser,
            appContainer = appContainer,
            onUserUpdated = authViewModel::updateUser,
            onLogout = authViewModel::logout
        )
        UserRole.EMPLOYEE -> EmployeeShell(
            user = currentUser,
            appContainer = appContainer,
            onUserUpdated = authViewModel::updateUser,
            onLogout = authViewModel::logout,
            onDeleteAccount = authViewModel::deleteAccount
        )
    }
}

// ── Manager ───────────────────────────────────────────────────────────────────

private enum class ManagerTab(val label: String) {
    COMPANY("Company"),
    EMPLOYEES("Employees"),
    REQUIREMENTS("Requirements"),
    SCHEDULE("Schedule"),
    PROFILE("Profile")
}

@Composable
private fun ManagerShell(
    user: AppUser,
    appContainer: AppContainer,
    onUserUpdated: (AppUser) -> Unit,
    onLogout: () -> Unit
) {
    var selectedTab by rememberSaveable { mutableStateOf(ManagerTab.COMPANY) }

    Scaffold(
        bottomBar = {
            NavigationBar {
                ManagerTab.entries.forEach { tab ->
                    NavigationBarItem(
                        selected = tab == selectedTab,
                        onClick = { selectedTab = tab },
                        icon = { /* icons per tab can be added later */ },
                        label = { Text(tab.label) }
                    )
                }
            }
        }
    ) { padding ->
        Box(modifier = Modifier.padding(padding)) {
            when (selectedTab) {
                ManagerTab.COMPANY -> CompanyScreen(
                    user = user,
                    repository = appContainer.companyRepository,
                    onUserUpdated = onUserUpdated
                )
                ManagerTab.EMPLOYEES -> PlaceholderScreen("Employees")
                ManagerTab.REQUIREMENTS -> PlaceholderScreen("Requirements")
                ManagerTab.SCHEDULE -> PlaceholderScreen("Schedule")
                ManagerTab.PROFILE -> ProfileScreen(
                    user = user,
                    onLogout = onLogout
                )
            }
        }
    }
}

// ── Employee ──────────────────────────────────────────────────────────────────

private enum class EmployeeTab(val label: String) {
    AVAILABILITY("Availability"),
    SCHEDULE("Schedule"),
    PROFILE("Profile")
}

@Composable
private fun EmployeeShell(
    user: AppUser,
    appContainer: AppContainer,
    onUserUpdated: (AppUser) -> Unit,
    onLogout: () -> Unit,
    onDeleteAccount: () -> Unit
) {
    var selectedTab by rememberSaveable { mutableStateOf(EmployeeTab.AVAILABILITY) }
    var showInviteSheet by rememberSaveable { mutableStateOf(false) }

    val inviteVm = androidx.lifecycle.viewmodel.compose.viewModel<CompanyInviteViewModel>(
        factory = object : androidx.lifecycle.ViewModelProvider.Factory {
            override fun <T : androidx.lifecycle.ViewModel> create(modelClass: Class<T>): T {
                @Suppress("UNCHECKED_CAST")
                return CompanyInviteViewModel(appContainer.companyRepository) as T
            }
        }
    )

    Scaffold(
        bottomBar = {
            NavigationBar {
                EmployeeTab.entries.forEach { tab ->
                    NavigationBarItem(
                        selected = tab == selectedTab,
                        onClick = { selectedTab = tab },
                        icon = { },
                        label = { Text(tab.label) }
                    )
                }
            }
        }
    ) { padding ->
        Box(modifier = Modifier.padding(padding)) {
            when (selectedTab) {
                EmployeeTab.AVAILABILITY -> PlaceholderWithJoin(
                    user = user,
                    screenName = "Availability",
                    onJoinClick = { showInviteSheet = true }
                )
                EmployeeTab.SCHEDULE -> PlaceholderWithJoin(
                    user = user,
                    screenName = "Schedule",
                    onJoinClick = { showInviteSheet = true }
                )
                EmployeeTab.PROFILE -> ProfileScreen(
                    user = user,
                    onLogout = onLogout,
                    onDeleteAccount = onDeleteAccount
                )
            }
        }
    }

    if (showInviteSheet) {
        CompanyInviteSheet(
            viewModel = inviteVm,
            onDismiss = { showInviteSheet = false },
            onUserJoined = { updatedUser ->
                onUserUpdated(updatedUser)
                showInviteSheet = false
            }
        )
    }
}

// ── Shared placeholder screens ────────────────────────────────────────────────

@Composable
private fun PlaceholderScreen(name: String) {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Text("$name — coming soon")
    }
}

@Composable
private fun PlaceholderWithJoin(
    user: AppUser,
    screenName: String,
    onJoinClick: () -> Unit
) {
    if (!user.hasCompany) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            androidx.compose.foundation.layout.Column(
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text("Join a company to access $screenName")
                androidx.compose.material3.Button(
                    onClick = onJoinClick,
                    modifier = Modifier.padding(top = 16.dp)
                ) { Text("Enter invite code") }
            }
        }
    } else {
        PlaceholderScreen(screenName)
    }
}

@Composable
private fun ProfileScreen(
    user: AppUser,
    onLogout: () -> Unit,
    onDeleteAccount: (() -> Unit)? = null
) {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        androidx.compose.foundation.layout.Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(12.dp),
            modifier = Modifier.padding(24.dp)
        ) {
            Text(user.name, style = androidx.compose.material3.MaterialTheme.typography.headlineSmall)
            Text(user.email, style = androidx.compose.material3.MaterialTheme.typography.bodyMedium)
            androidx.compose.material3.Button(onClick = onLogout) { Text("Log out") }
            if (onDeleteAccount != null) {
                androidx.compose.material3.OutlinedButton(
                    onClick = onDeleteAccount,
                    colors = androidx.compose.material3.ButtonDefaults.outlinedButtonColors(
                        contentColor = androidx.compose.material3.MaterialTheme.colorScheme.error
                    )
                ) { Text("Delete account") }
            }
        }
    }
}
