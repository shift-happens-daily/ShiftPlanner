import SwiftUI

struct AvailabilityLockedView: View {
    @EnvironmentObject private var languageManager: LanguageManager
    let onJoinCompany: () -> Void

    var body: some View {
        NavigationStack {
            VStack(spacing: 20) {
                Spacer()

                VStack(spacing: 14) {
                    Image(systemName: "building.2.crop.circle")
                        .font(.system(size: 56))
                        .foregroundStyle(.secondary)

                    Text(languageManager.text("Join a company first", "Сначала присоединитесь к компании"))
                        .font(.title3)
                        .fontWeight(.bold)

                    Text(languageManager.text("Availability becomes available after you join a company with an invite code.", "Настройка доступности откроется после присоединения к компании по инвайт-коду."))
                        .multilineTextAlignment(.center)
                        .foregroundStyle(.secondary)
                }
                .padding(.horizontal, 20)

                CompanyMembershipBannerView(
                    title: languageManager.text("Enter an invite code to unlock availability and schedule preferences.", "Введите инвайт-код, чтобы открыть доступность и предпочтения по графику."),
                    buttonTitle: languageManager.text("Enter invite code", "Ввести код"),
                    action: onJoinCompany
                )

                Spacer()
            }
            .padding()
            .navigationTitle(languageManager.text("Availability", "Доступность"))
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}
