import SwiftUI

struct AvailabilityLockedView: View {
    let onJoinCompany: () -> Void

    var body: some View {
        NavigationStack {
            VStack(spacing: 20) {
                Spacer()

                VStack(spacing: 14) {
                    Image(systemName: "building.2.crop.circle")
                        .font(.system(size: 56))
                        .foregroundStyle(.secondary)

                    Text(localized("Join a company first", "Сначала присоединитесь к компании"))
                        .font(.title3)
                        .fontWeight(.bold)

                    Text(localized(
                        "Availability becomes available after you join a company with an invite code.",
                        "Доступность откроется после присоединения к компании по коду приглашения."
                    ))
                        .multilineTextAlignment(.center)
                        .foregroundStyle(.secondary)
                }
                .padding(.horizontal, 20)

                CompanyMembershipBannerView(
                    title: localized(
                        "Enter an invite code to unlock availability and schedule preferences.",
                        "Введите код приглашения, чтобы открыть доступность и настройки расписания."
                    ),
                    buttonTitle: localized("Enter invite code", "Ввести код приглашения"),
                    action: onJoinCompany
                )

                Spacer()
            }
            .padding()
            .navigationTitle(localized("Availability", "Доступность"))
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}
