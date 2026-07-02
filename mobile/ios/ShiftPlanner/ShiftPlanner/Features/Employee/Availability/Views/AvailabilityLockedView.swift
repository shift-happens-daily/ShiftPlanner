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

                    Text("Join a company first")
                        .font(.title3)
                        .fontWeight(.bold)

                    Text("Availability becomes available after you join a company with an invite code.")
                        .multilineTextAlignment(.center)
                        .foregroundStyle(.secondary)
                }
                .padding(.horizontal, 20)

                CompanyMembershipBannerView(
                    title: "Enter an invite code to unlock availability and schedule preferences.",
                    buttonTitle: "Enter invite code",
                    action: onJoinCompany
                )

                Spacer()
            }
            .padding()
            .navigationTitle("Availability")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}
