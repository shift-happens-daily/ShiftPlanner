import SwiftUI

struct ManagerScheduleView: View {
    @EnvironmentObject private var languageManager: LanguageManager
    let user: AppUser
    let onUserUpdated: (AppUser) -> Void

    var body: some View {
        NavigationStack {
            ScrollView {
                if user.hasCompany {
                    Text(languageManager.text("Manager schedule info", "Информация о графике менеджера"))
                        .frame(maxWidth: .infinity, minHeight: 240)
                } else {
                    ManagerCompanyAccessContentView(
                        user: user,
                        onUserUpdated: onUserUpdated
                    )
                    .padding()
                }
            }
            .navigationTitle(languageManager.text("Schedule", "График"))
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}
