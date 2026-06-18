import SwiftUI

struct EmployeeMainView: View {
    @EnvironmentObject private var languageManager: LanguageManager
    let user: AppUser
    let onLogout: () async -> Void
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
            
            EmployeeScheduleView()
                .tabItem {
                    Label(languageManager.text("Schedule", "График"), systemImage: "calendar")
                }

            EmployeeProfileView(user: user, onLogout: onLogout)
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
