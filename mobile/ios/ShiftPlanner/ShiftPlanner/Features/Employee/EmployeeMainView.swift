import SwiftUI

struct EmployeeMainView: View {
    let user: AppUser
    let onLogout: () async -> Void
    let onDeleteAccount: () async -> Void
    let onUserUpdated: (AppUser) -> Void

    @State private var isShowingInviteSheet = false

    var body: some View {
        TabView {
            Group {
                if user.hasCompany, user.employeeId != nil {
                    AvailabilityView(user: user)
                        .id(user.employeeId)
                } else {
                    AvailabilityLockedView {
                        isShowingInviteSheet = true
                    }
                }
            }
                .tabItem {
                    Label(localized("Availability", "Доступность"), systemImage: "clock.badge.checkmark")
                }

            EmployeeScheduleView(user: user)
                .tabItem {
                    Label(localized("Schedule", "Расписание"), systemImage: "calendar")
                }

            AbsencesView(user: user)
                .tabItem {
                    Label(localized("Absences", "Отсутствия"), systemImage: "figure.walk.departure")
                }

            MyReportView()
                .tabItem {
                    Label(localized("Report", "Отчёт"), systemImage: "chart.bar")
                }

            EmployeeProfileView(user: user, onLogout: onLogout, onDeleteAccount: onDeleteAccount)
                .tabItem {
                    Label(localized("Profile", "Профиль"), systemImage: "person.crop.circle")
                }
        }
        .sheet(isPresented: $isShowingInviteSheet) {
            CompanyInviteView(
                mode: .employeeJoin,
                onUserJoined: onUserUpdated
            )
        }
    }
}
