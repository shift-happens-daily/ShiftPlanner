package com.froggyriia.shiftplanner.presentation

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Assessment
import androidx.compose.material.icons.filled.Assignment
import androidx.compose.material.icons.filled.Business
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.CalendarToday
import androidx.compose.material.icons.filled.EventAvailable
import androidx.compose.material.icons.filled.EventBusy
import androidx.compose.material.icons.filled.Group
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.appcompat.app.AppCompatDelegate
import androidx.annotation.StringRes
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.os.LocaleListCompat
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewmodel.compose.viewModel
import com.froggyriia.shiftplanner.R
import com.froggyriia.shiftplanner.AppContainer
import com.froggyriia.shiftplanner.data.reports.ReportsRepository
import com.froggyriia.shiftplanner.domain.model.AppUser
import com.froggyriia.shiftplanner.domain.model.MySelfReport
import com.froggyriia.shiftplanner.domain.model.UserRole
import com.froggyriia.shiftplanner.ui.theme.AppThemePreference
import com.froggyriia.shiftplanner.ui.theme.ThemeStore
import com.froggyriia.shiftplanner.presentation.auth.AuthScreen
import com.froggyriia.shiftplanner.presentation.auth.AuthViewModel
import com.froggyriia.shiftplanner.presentation.employee.absence.AbsencesScreen
import com.froggyriia.shiftplanner.presentation.employee.absence.AbsencesViewModel
import com.froggyriia.shiftplanner.presentation.employee.availability.AvailabilityScreen
import com.froggyriia.shiftplanner.presentation.employee.availability.AvailabilityViewModel
import com.froggyriia.shiftplanner.presentation.employee.reports.MyReportScreen
import com.froggyriia.shiftplanner.presentation.employee.reports.MyReportViewModel
import com.froggyriia.shiftplanner.presentation.employee.schedule.MyScheduleScreen
import com.froggyriia.shiftplanner.presentation.employee.schedule.MyScheduleViewModel
import com.froggyriia.shiftplanner.presentation.manager.company.CompanyInviteSheet
import com.froggyriia.shiftplanner.presentation.manager.company.CompanyInviteViewModel
import com.froggyriia.shiftplanner.presentation.manager.company.CompanyScreen
import com.froggyriia.shiftplanner.presentation.manager.employees.EmployeesScreen
import com.froggyriia.shiftplanner.presentation.manager.employees.EmployeesViewModel
import com.froggyriia.shiftplanner.presentation.manager.notifications.NotificationsScreen
import com.froggyriia.shiftplanner.presentation.manager.notifications.NotificationsViewModel
import com.froggyriia.shiftplanner.presentation.manager.reports.ReportsScreen
import com.froggyriia.shiftplanner.presentation.manager.reports.ReportsViewModel
import com.froggyriia.shiftplanner.presentation.manager.requirements.RequirementsScreen
import com.froggyriia.shiftplanner.presentation.manager.requirements.RequirementsViewModel
import com.froggyriia.shiftplanner.presentation.manager.schedule.ScheduleScreen
import com.froggyriia.shiftplanner.presentation.manager.schedule.ScheduleViewModel

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
            onLogout = authViewModel::logout,
            onDeleteAccount = authViewModel::deleteAccount
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

private enum class ManagerTab(@StringRes val labelRes: Int, val icon: ImageVector) {
    COMPANY(R.string.nav_company, Icons.Default.Business),
    EMPLOYEES(R.string.nav_employees, Icons.Default.Group),
    REQUIREMENTS(R.string.nav_reqs, Icons.Default.Assignment),
    SCHEDULE(R.string.nav_schedule, Icons.Default.CalendarMonth),
    REPORTS(R.string.nav_reports, Icons.Default.Assessment),
    PROFILE(R.string.nav_profile, Icons.Default.Person)
}

@Composable
private fun ManagerShell(
    user: AppUser,
    appContainer: AppContainer,
    onUserUpdated: (AppUser) -> Unit,
    onLogout: () -> Unit,
    onDeleteAccount: () -> Unit
) {
    var selectedTab by rememberSaveable { mutableStateOf(ManagerTab.COMPANY) }
    var showNotifications by rememberSaveable { mutableStateOf(false) }

    val notificationsVm: NotificationsViewModel = viewModel(
        key = "manager_notifications_${user.company?.id}",
        factory = remember(user.company?.id) {
            object : ViewModelProvider.Factory {
                override fun <T : ViewModel> create(modelClass: Class<T>): T {
                    @Suppress("UNCHECKED_CAST")
                    return NotificationsViewModel(
                        appContainer.scheduleRepository,
                        appContainer.employeeManagementRepository(user.company?.id)
                    ) as T
                }
            }
        }
    )

    Scaffold(
        bottomBar = {
            NavigationBar {
                ManagerTab.entries.forEach { tab ->
                    val label = stringResource(tab.labelRes)
                    NavigationBarItem(
                        selected = tab == selectedTab,
                        onClick = { selectedTab = tab },
                        // Icons only: five tabs don't leave room for labels.
                        icon = { Icon(tab.icon, contentDescription = label) }
                    )
                }
            }
        }
    ) { padding ->
        Box(modifier = Modifier.padding(padding)) {
            if (showNotifications) {
                NotificationsScreen(
                    viewModel = notificationsVm,
                    onBack = { showNotifications = false }
                )
            } else {
            when (selectedTab) {
                ManagerTab.COMPANY -> CompanyScreen(
                    user = user,
                    repository = appContainer.companyRepository,
                    onUserUpdated = onUserUpdated,
                    onNotificationsClick = {
                        notificationsVm.load()
                        showNotifications = true
                    }
                )
                ManagerTab.EMPLOYEES -> {
                    val employeesVm: EmployeesViewModel = viewModel(
                        key = "employees_${user.company?.id}",
                        factory = remember(user.company?.id) {
                            object : ViewModelProvider.Factory {
                                override fun <T : ViewModel> create(modelClass: Class<T>): T {
                                    @Suppress("UNCHECKED_CAST")
                                    return EmployeesViewModel(
                                        appContainer.employeeManagementRepository(user.company?.id),
                                        user.company?.id
                                    ) as T
                                }
                            }
                        }
                    )
                    EmployeesScreen(user = user, viewModel = employeesVm)
                }
                ManagerTab.REQUIREMENTS -> {
                    val requirementsVm: RequirementsViewModel = viewModel(
                        key = "requirements_${user.company?.id}",
                        factory = remember(user.company?.id) {
                            object : ViewModelProvider.Factory {
                                override fun <T : ViewModel> create(modelClass: Class<T>): T {
                                    @Suppress("UNCHECKED_CAST")
                                    return RequirementsViewModel(
                                        appContainer.requirementsRepository,
                                        appContainer.companyRepository,
                                        user.company?.id
                                    ) as T
                                }
                            }
                        }
                    )
                    RequirementsScreen(user = user, viewModel = requirementsVm)
                }
                ManagerTab.SCHEDULE -> {
                    val scheduleVm: ScheduleViewModel = viewModel(
                        key = "manager_schedule",
                        factory = remember {
                            object : ViewModelProvider.Factory {
                                override fun <T : ViewModel> create(modelClass: Class<T>): T {
                                    @Suppress("UNCHECKED_CAST")
                                    return ScheduleViewModel(
                                        appContainer.scheduleRepository,
                                        appContainer.requirementsRepository,
                                        appContainer.companyRepository,
                                        appContainer.employeeManagementRepository(user.company?.id)
                                    ) as T
                                }
                            }
                        }
                    )
                    ScheduleScreen(user = user, viewModel = scheduleVm)
                }
                ManagerTab.REPORTS -> {
                    val reportsVm: ReportsViewModel = viewModel(
                        key = "manager_reports",
                        factory = remember {
                            object : ViewModelProvider.Factory {
                                override fun <T : ViewModel> create(modelClass: Class<T>): T {
                                    @Suppress("UNCHECKED_CAST")
                                    return ReportsViewModel(appContainer.reportsRepository) as T
                                }
                            }
                        }
                    )
                    ReportsScreen(viewModel = reportsVm)
                }
                ManagerTab.PROFILE -> ProfileScreen(
                    user = user,
                    onLogout = onLogout,
                    onDeleteAccount = onDeleteAccount
                )
            }
            }
        }
    }
}

// ── Employee ──────────────────────────────────────────────────────────────────

private enum class EmployeeTab(@StringRes val labelRes: Int, val icon: ImageVector) {
    AVAILABILITY(R.string.nav_availability, Icons.Default.EventAvailable),
    SCHEDULE(R.string.nav_schedule, Icons.Default.CalendarToday),
    ABSENCES(R.string.nav_absences, Icons.Default.EventBusy),
    REPORT(R.string.nav_reports, Icons.Default.Assessment),
    PROFILE(R.string.nav_profile, Icons.Default.Person)
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

    val inviteVm = viewModel<CompanyInviteViewModel>(
        factory = object : ViewModelProvider.Factory {
            override fun <T : ViewModel> create(modelClass: Class<T>): T {
                @Suppress("UNCHECKED_CAST")
                return CompanyInviteViewModel(appContainer.companyRepository) as T
            }
        }
    )

    Scaffold(
        bottomBar = {
            NavigationBar {
                EmployeeTab.entries.forEach { tab ->
                    val label = stringResource(tab.labelRes)
                    NavigationBarItem(
                        selected = tab == selectedTab,
                        onClick = { selectedTab = tab },
                        // Icons only: five tabs don't leave room for labels.
                        icon = { Icon(tab.icon, contentDescription = label) }
                    )
                }
            }
        }
    ) { padding ->
        Box(modifier = Modifier.padding(padding)) {
            when (selectedTab) {
                EmployeeTab.AVAILABILITY -> {
                    if (!user.hasCompany || user.employeeId == null) {
                        PlaceholderWithJoin(
                            user = user,
                            screenName = "Availability",
                            onJoinClick = { showInviteSheet = true }
                        )
                    } else {
                        val availVm: AvailabilityViewModel = viewModel(
                            key = "availability_${user.employeeId}",
                            factory = remember(user.employeeId) {
                                object : ViewModelProvider.Factory {
                                    override fun <T : ViewModel> create(modelClass: Class<T>): T {
                                        @Suppress("UNCHECKED_CAST")
                                        return AvailabilityViewModel(
                                            appContainer.availabilityRepository,
                                            user.employeeId
                                        ) as T
                                    }
                                }
                            }
                        )
                        AvailabilityScreen(viewModel = availVm)
                    }
                }
                EmployeeTab.SCHEDULE -> {
                    if (!user.hasCompany) {
                        PlaceholderWithJoin(
                            user = user,
                            screenName = "Schedule",
                            onJoinClick = { showInviteSheet = true }
                        )
                    } else {
                        val myScheduleVm: MyScheduleViewModel = viewModel(
                            key = "my_schedule",
                            factory = remember {
                                object : ViewModelProvider.Factory {
                                    override fun <T : ViewModel> create(modelClass: Class<T>): T {
                                        @Suppress("UNCHECKED_CAST")
                                        return MyScheduleViewModel(appContainer.scheduleRepository) as T
                                    }
                                }
                            }
                        )
                        MyScheduleScreen(user = user, viewModel = myScheduleVm)
                    }
                }
                EmployeeTab.ABSENCES -> {
                    if (!user.hasCompany || user.employeeId == null) {
                        PlaceholderWithJoin(
                            user = user,
                            screenName = "Absences",
                            onJoinClick = { showInviteSheet = true }
                        )
                    } else {
                        val absencesVm: AbsencesViewModel = viewModel(
                            key = "absences_${user.employeeId}",
                            factory = remember(user.employeeId) {
                                object : ViewModelProvider.Factory {
                                    override fun <T : ViewModel> create(modelClass: Class<T>): T {
                                        @Suppress("UNCHECKED_CAST")
                                        return AbsencesViewModel(
                                            appContainer.absenceRepository,
                                            user.employeeId
                                        ) as T
                                    }
                                }
                            }
                        )
                        AbsencesScreen(viewModel = absencesVm)
                    }
                }
                EmployeeTab.REPORT -> {
                    if (!user.hasCompany) {
                        PlaceholderWithJoin(
                            user = user,
                            screenName = "Report",
                            onJoinClick = { showInviteSheet = true }
                        )
                    } else {
                        val myReportVm: MyReportViewModel = viewModel(
                            key = "my_report",
                            factory = remember {
                                object : ViewModelProvider.Factory {
                                    override fun <T : ViewModel> create(modelClass: Class<T>): T {
                                        @Suppress("UNCHECKED_CAST")
                                        return MyReportViewModel(appContainer.reportsRepository) as T
                                    }
                                }
                            }
                        )
                        MyReportScreen(viewModel = myReportVm)
                    }
                }
                EmployeeTab.PROFILE -> ProfileScreen(
                    user = user,
                    reportsRepository = appContainer.reportsRepository,
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
        Text(stringResource(R.string.placeholder_coming_soon, name))
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
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(stringResource(R.string.placeholder_join, screenName))
                Button(
                    onClick = onJoinClick,
                    modifier = Modifier.padding(top = 16.dp)
                ) { Text(stringResource(R.string.invite_enter_code)) }
            }
        }
    } else {
        PlaceholderScreen(screenName)
    }
}

@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
private fun ProfileScreen(
    user: AppUser,
    reportsRepository: ReportsRepository? = null,
    onLogout: () -> Unit,
    onDeleteAccount: (() -> Unit)? = null
) {
    var myReport by remember { mutableStateOf<MySelfReport?>(null) }
    val currentTheme by ThemeStore.theme.collectAsState()

    LaunchedEffect(reportsRepository) {
        if (reportsRepository != null) {
            try {
                myReport = reportsRepository.fetchMyReport(startDate = null, endDate = null)
            } catch (_: Exception) { }
        }
    }

    Scaffold(
        topBar = {
            androidx.compose.material3.TopAppBar(
                title = { Text(stringResource(R.string.profile_title), style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold) }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .padding(horizontal = 16.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Spacer(Modifier.height(4.dp))

            // ── Info cards ────────────────────────────────────────────────────
            Row(
                Modifier.fillMaxWidth().height(IntrinsicSize.Max),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                ProfileInfoCard(label = stringResource(R.string.profile_full_name), value = user.name, modifier = Modifier.weight(1f).fillMaxHeight())
                ProfileInfoCard(label = stringResource(R.string.email_label), value = user.email, modifier = Modifier.weight(1f).fillMaxHeight())
            }
            Row(
                Modifier.fillMaxWidth().height(IntrinsicSize.Max),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                ProfileInfoCard(label = stringResource(R.string.profile_user_id), value = user.publicId.ifEmpty { user.id }, monospace = true, modifier = Modifier.weight(1f).fillMaxHeight())
                ProfileInfoCard(label = stringResource(R.string.profile_role), value = user.role.title, modifier = Modifier.weight(1f).fillMaxHeight())
            }
            user.company?.let { company ->
                ProfileInfoCard(label = stringResource(R.string.profile_company), value = company.name, modifier = Modifier.fillMaxWidth())
            }
            if (user.role == UserRole.EMPLOYEE) {
                user.position?.let { pos ->
                    ProfileInfoCard(label = stringResource(R.string.profile_position), value = pos.name, modifier = Modifier.fillMaxWidth())
                }
            }

            // ── Stats (employees only) ─────────────────────────────────────
            myReport?.let { report ->
                HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
                Text(
                    stringResource(R.string.profile_stats),
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold
                )
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    ProfileInfoCard(
                        label = stringResource(R.string.profile_hours),
                        value = "${"%.1f".format(report.totalHours)} ч",
                        modifier = Modifier.weight(1f)
                    )
                    ProfileInfoCard(
                        label = stringResource(R.string.profile_shifts),
                        value = "${report.totalShifts}",
                        modifier = Modifier.weight(1f)
                    )
                }
            }

            // ── Theme picker ──────────────────────────────────────────────
            HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
            Text(
                stringResource(R.string.profile_theme),
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.SemiBold
            )
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                AppThemePreference.entries.forEach { pref ->
                    val selected = pref == currentTheme
                    Card(
                        onClick = { ThemeStore.setTheme(pref) },
                        modifier = Modifier.weight(1f),
                        colors = androidx.compose.material3.CardDefaults.cardColors(
                            containerColor = if (selected)
                                MaterialTheme.colorScheme.primaryContainer
                            else
                                MaterialTheme.colorScheme.surfaceVariant
                        )
                    ) {
                        Box(
                            Modifier.fillMaxWidth().padding(vertical = 12.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                pref.title,
                                style = MaterialTheme.typography.labelMedium,
                                fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
                                color = if (selected)
                                    MaterialTheme.colorScheme.onPrimaryContainer
                                else
                                    MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
            }

            // ── Language picker ───────────────────────────────────────────
            HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
            Text(
                stringResource(R.string.language_label),
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.SemiBold
            )
            val currentLocale = AppCompatDelegate.getApplicationLocales().toLanguageTags()
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                listOf("en" to stringResource(R.string.language_en), "ru" to stringResource(R.string.language_ru)).forEach { (tag, label) ->
                    val selected = if (tag == "en") !currentLocale.startsWith("ru") else currentLocale.startsWith("ru")
                    Card(
                        onClick = { AppCompatDelegate.setApplicationLocales(LocaleListCompat.forLanguageTags(tag)) },
                        modifier = Modifier.weight(1f),
                        colors = androidx.compose.material3.CardDefaults.cardColors(
                            containerColor = if (selected)
                                MaterialTheme.colorScheme.primaryContainer
                            else
                                MaterialTheme.colorScheme.surfaceVariant
                        )
                    ) {
                        Box(
                            Modifier.fillMaxWidth().padding(vertical = 12.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                label,
                                style = MaterialTheme.typography.labelMedium,
                                fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
                                color = if (selected)
                                    MaterialTheme.colorScheme.onPrimaryContainer
                                else
                                    MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
            }

            // ── Actions ───────────────────────────────────────────────────
            HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
            Button(onClick = onLogout, modifier = Modifier.fillMaxWidth()) {
                Text(stringResource(R.string.logout_button))
            }
            if (onDeleteAccount != null) {
                OutlinedButton(
                    onClick = onDeleteAccount,
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error)
                ) { Text(stringResource(R.string.profile_delete_account)) }
            }
            Spacer(Modifier.height(16.dp))
        }
    }
}

@Composable
private fun ProfileInfoCard(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
    monospace: Boolean = false
) {
    Card(modifier = modifier) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .fillMaxHeight()
                .padding(horizontal = 16.dp, vertical = 14.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Text(
                label,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
                value,
                style = if (monospace)
                    MaterialTheme.typography.titleSmall.copy(fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace)
                else
                    MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold,
                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                modifier = Modifier.fillMaxWidth()
            )
        }
    }
}
