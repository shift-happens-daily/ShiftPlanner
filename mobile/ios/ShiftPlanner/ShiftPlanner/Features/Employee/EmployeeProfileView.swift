import SwiftUI

struct EmployeeProfileView: View {
    let user: AppUser
    let onLogout: () async -> Void

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                VStack(spacing: 12) {
                    Image(systemName: "person.crop.circle.fill")
                        .font(.system(size: 72))
                        .foregroundStyle(.blue)

                    Text(user.name)
                        .font(.title2)
                        .bold()

                    Text(user.email)
                        .foregroundStyle(.secondary)

                    Text(user.role.title)
                        .font(.subheadline)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(Color.blue.opacity(0.12))
                        .clipShape(Capsule())
                }

                Button {
                    Task {
                        await onLogout()
                    }
                } label: {
                    Text("Log out")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .tint(.red)

                Spacer()
            }
            .padding()
            .navigationTitle("Profile")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}
