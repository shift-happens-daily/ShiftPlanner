import SwiftUI

struct ManagerMainView: View {
    let user: AppUser
    let onLogout: () async -> Void
    let onUserUpdated: (AppUser) -> Void

    var body: some View {
        TabView {
            CompanyView(user: user, onUserUpdated: onUserUpdated)
                .tabItem {
                    Label("Company", systemImage: "building.2")
                }
            
            EmployeeListView(user: user, onUserUpdated: onUserUpdated)
                .tabItem {
                    Label("Employees", systemImage: "person.3")
                }
            
            RequirementsView(user: user, onUserUpdated: onUserUpdated)
                .tabItem {
                    Label("Rules", systemImage: "slider.horizontal.3")
                }
            
            ManagerScheduleView(user: user, onUserUpdated: onUserUpdated)
                .tabItem {
                    Label("Schedule", systemImage: "calendar")
                }
            
            ManagerProfileView(user: user, onLogout: onLogout)
                .tabItem {
                    Label("Profile", systemImage: "person.crop.circle")
                }
            
        }
    }
}
