import SwiftUI

struct ManagerMainView: View {
    let user: AppUser
    let onLogout: () async -> Void
    let onDeleteAccount: () async -> Void
    let onUserUpdated: (AppUser) -> Void

    var body: some View {
        TabView {
            CompanyView(user: user, onUserUpdated: onUserUpdated)
                .tabItem {
                    Label(localized("Company", "Компания"), systemImage: "building.2")
                }

            EmployeeListView(user: user)
                .tabItem {
                    Label(localized("Employees", "Сотрудники"), systemImage: "person.3")
                }

            RequirementsView(user: user)
                .tabItem {
                    Label(localized("Rules", "Требования"), systemImage: "slider.horizontal.3")
                }

            ManagerScheduleView(user: user)
                .tabItem {
                    Label(localized("Schedule", "Расписание"), systemImage: "calendar")
                }

            ReportsView()
                .tabItem {
                    Label(localized("Reports", "Отчёты"), systemImage: "chart.bar")
                }

            NotificationsView(companyId: user.company?.id, showsClose: false)
                .tabItem {
                    Label(localized("Notifications", "Уведомления"), systemImage: "bell")
                }

            ManagerProfileView(user: user, onLogout: onLogout, onDeleteAccount: onDeleteAccount)
                .tabItem {
                    Label(localized("Profile", "Профиль"), systemImage: "person.crop.circle")
                }

        }
    }
}
