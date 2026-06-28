import SwiftUI

struct EmployeeMainView: View {
    @EnvironmentObject private var languageManager: LanguageManager
    let user: AppUser
    let onLogout: () async -> Void
    let onDeleteAccount: () async throws -> Void
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
                    Label(languageManager.text("Availability", "Доступность"), systemImage: "clock.badge.checkmark")
                }
            
            EmployeeScheduleView(user: user) {
                isShowingInviteSheet = true
            }
                .tabItem {
                    Label(languageManager.text("Schedule", "График"), systemImage: "calendar")
                }

            EmployeeProfileView(
                user: user,
                onLogout: onLogout,
                onDeleteAccount: onDeleteAccount
            )
                .tabItem {
                    Label(languageManager.text("Profile", "Профиль"), systemImage: "person.crop.circle")
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
