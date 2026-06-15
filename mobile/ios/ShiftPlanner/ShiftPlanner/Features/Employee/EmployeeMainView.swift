import SwiftUI

struct EmployeeMainView: View {
    let user: AppUser
    let onLogout: () async -> Void
    let onUserUpdated: (AppUser) -> Void

    @State private var isShowingInviteSheet = false

    var body: some View {
        TabView {
            AvailabilityView(user: user)
                .tabItem {
                    Label("Availability", systemImage: "clock.badge.checkmark")
                }
            
            EmployeeScheduleView()
                .tabItem {
                    Label("Schedule", systemImage: "calendar")
                }

            EmployeeProfileView(user: user, onLogout: onLogout)
                .tabItem {
                    Label("Profile", systemImage: "person.crop.circle")
                }
        }
        .safeAreaInset(edge: .top) {
            if !user.hasCompany {
                CompanyMembershipBannerView(
                    title: "You haven't joined a company yet. Enter an invite code to continue.",
                    buttonTitle: "Enter invite code"
                ) {
                    isShowingInviteSheet = true
                }
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
