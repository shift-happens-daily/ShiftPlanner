package com.froggyriia.shiftplanner.presentation

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
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
import com.froggyriia.shiftplanner.domain.model.UserRole
import com.froggyriia.shiftplanner.presentation.auth.AuthScreen
import com.froggyriia.shiftplanner.presentation.auth.AuthViewModel

@Composable
fun AppRoot(
    authViewModel: AuthViewModel
) {
    val uiState by authViewModel.uiState.collectAsState()
    val currentUser = uiState.currentUser

    if (currentUser == null) {
        AuthScreen(viewModel = authViewModel)
        return
    }

    when (currentUser.role) {
        UserRole.MANAGER -> ManagerShell(
            userName = currentUser.name,
            onLogout = authViewModel::logout
        )
        UserRole.EMPLOYEE -> EmployeeShell(
            userName = currentUser.name,
            onLogout = authViewModel::logout
        )
    }
}

@Composable
private fun ManagerShell(
    userName: String,
    onLogout: () -> Unit
) {
    val tabs = listOf(
        ShellTab("Company", "Company"),
        ShellTab("Employees", "Employees"),
        ShellTab("Requirements", "Requirements"),
        ShellTab("Schedule", "Schedule"),
        ShellTab("Profile", "Profile")
    )
    ShellScaffold(
        title = "Manager",
        userName = userName,
        tabs = tabs,
        onLogout = onLogout
    )
}

@Composable
private fun EmployeeShell(
    userName: String,
    onLogout: () -> Unit
) {
    val tabs = listOf(
        ShellTab("Availability", "Availability"),
        ShellTab("Schedule", "Schedule"),
        ShellTab("Profile", "Profile")
    )
    ShellScaffold(
        title = "Employee",
        userName = userName,
        tabs = tabs,
        onLogout = onLogout
    )
}

@Composable
private fun ShellScaffold(
    title: String,
    userName: String,
    tabs: List<ShellTab>,
    onLogout: () -> Unit
) {
    var selectedTab by rememberSaveable { mutableStateOf(tabs.first().route) }
    val selected = tabs.firstOrNull { it.route == selectedTab } ?: tabs.first()

    Scaffold(
        bottomBar = {
            NavigationBar {
                tabs.forEach { tab ->
                    NavigationBarItem(
                        selected = tab.route == selectedTab,
                        onClick = { selectedTab = tab.route },
                        icon = {},
                        label = { Text(tab.label) }
                    )
                }
            }
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(24.dp),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text("$title: $userName")
            Text("${selected.label} screen")
            androidx.compose.material3.Button(
                modifier = Modifier.padding(top = 16.dp),
                onClick = onLogout
            ) {
                Text("Logout")
            }
        }
    }
}

private data class ShellTab(
    val route: String,
    val label: String
)
