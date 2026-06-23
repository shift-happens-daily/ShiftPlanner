import SwiftUI


struct MainView: View {
    @EnvironmentObject private var languageManager: LanguageManager
    let user: AppUser
    let onLogout: () -> Void
    
    var body: some View {
        VStack(spacing: 16) {
            Text(languageManager.text("Welcome", "Добро пожаловать") + ", \(user.name)")
                .font(.title)
                .bold()
            Text("\(languageManager.text("Email", "Почта")): \(user.email), \(languageManager.text("role", "роль")): \(user.role.title)")
                .foregroundColor(.secondary)
            
            Button(languageManager.text("Logout", "Выйти")) {
                onLogout()
            }
            .buttonStyle(.bordered)
        }
        .padding()
    }
    
}
