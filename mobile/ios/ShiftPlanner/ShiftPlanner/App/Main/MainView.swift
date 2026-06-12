import SwiftUI


struct MainView: View {
    let user: AppUser
    let onLogout: () -> Void
    
    var body: some View {
        VStack(spacing: 16) {
            Text("Welcome, \(user.name)")
                .font(.title)
                .bold()
            Text("Email: \(user.email), role: \(user.role.title)")
                .foregroundColor(.secondary)
            
            Button("Logout") {
                onLogout()
            }
            .buttonStyle(.bordered)
        }
        .padding()
    }
    
}
