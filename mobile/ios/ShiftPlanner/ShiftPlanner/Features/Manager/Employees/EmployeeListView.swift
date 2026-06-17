
import SwiftUI

struct EmployeeListView: View {
    let user: AppUser
    let onUserUpdated: (AppUser) -> Void

    var body: some View {
        NavigationStack {
            ScrollView {
                if user.hasCompany {
                    Text("Employee List")
                        .frame(maxWidth: .infinity, minHeight: 240)
                } else {
                    ManagerCompanyAccessContentView(
                        user: user,
                        onUserUpdated: onUserUpdated
                    )
                    .padding()
                }
            }
            .navigationTitle("Employees")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}
