import SwiftUI

struct ManagerMainView: View {
    @EnvironmentObject private var languageManager: LanguageManager
    let user: AppUser
    let onLogout: () async -> Void
    let onUserUpdated: (AppUser) -> Void

    var body: some View {
        TabView {
            CompanyView(user: user, onUserUpdated: onUserUpdated)
                .tabItem {
                    Label(languageManager.text("Company", "Компания"), systemImage: "building.2")
                }
            
            EmployeeListView(user: user, onUserUpdated: onUserUpdated)
                .tabItem {
                    Label(languageManager.text("Employees", "Сотрудники"), systemImage: "person.3")
                }
            
            RequirementsView(user: user, onUserUpdated: onUserUpdated)
                .tabItem {
                    Label(languageManager.text("Rules", "Правила"), systemImage: "slider.horizontal.3")
                }
            
            ManagerScheduleView(user: user, onUserUpdated: onUserUpdated)
                .tabItem {
                    Label(languageManager.text("Schedule", "График"), systemImage: "calendar")
                }
            
            ManagerProfileView(user: user, onLogout: onLogout)
                .tabItem {
                    Label(languageManager.text("Profile", "Профиль"), systemImage: "person.crop.circle")
                }
            
        }
    }
}
