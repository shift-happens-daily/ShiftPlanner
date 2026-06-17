import SwiftUI

struct ManagerScheduleView: View {
    let user: AppUser
    let onUserUpdated: (AppUser) -> Void

    var body: some View {
        NavigationStack {
            ScrollView {
                if user.hasCompany {
                    Text("Manager schedule info")
                        .frame(maxWidth: .infinity, minHeight: 240)
                } else {
                    ManagerCompanyAccessContentView(
                        user: user,
                        onUserUpdated: onUserUpdated
                    )
                    .padding()
                }
            }
            .navigationTitle("Schedule")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}
