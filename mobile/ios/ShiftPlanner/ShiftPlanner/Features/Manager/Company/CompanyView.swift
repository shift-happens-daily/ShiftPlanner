import SwiftUI
import UIKit

struct CompanyView: View {
    @EnvironmentObject private var themeManager: ThemeManager
    let user: AppUser
    let onUserUpdated: (AppUser) -> Void

    @State private var companyOverride: AppCompany?
    @State private var didCopyInviteCode = false

    private var displayedCompany: AppCompany? {
        companyOverride ?? user.company?.asAppCompany()
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    if let company = displayedCompany {
                        VStack(alignment: .leading, spacing: 12) {
                            Text(company.name)
                                .font(.title2)
                                .bold()

                            VStack(alignment: .leading, spacing: 8) {
                                Text("Invite code")
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)

                                Text(company.inviteCode)
                                    .font(.title3.monospaced())
                                    .fontWeight(.semibold)
                            }

                            HStack(spacing: 12) {
                                Button(didCopyInviteCode ? "Copied" : "Copy code") {
                                    UIPasteboard.general.string = company.inviteCode
                                    didCopyInviteCode = true
                                }
                                .buttonStyle(.plain)
                                .themeSecondaryAction()

                                ShareLink(
                                    item: "Join \(company.name) in ShiftPlanner with invite code: \(company.inviteCode)",
                                    subject: Text("ShiftPlanner invite")
                                ) {
                                    Label("Share", systemImage: "square.and.arrow.up")
                                }
                                .buttonStyle(.borderedProminent)
                                .tint(themeManager.selectedTheme.primaryActionFillColor)
                            }

                            Text("Share this code with employees so they can join the company.")
                                .font(.footnote)
                                .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding()
                        .themeCard()
                    } else {
                        ManagerCompanyAccessContentView(
                            user: user,
                            onUserUpdated: { updatedUser in
                                companyOverride = updatedUser.company?.asAppCompany()
                                onUserUpdated(updatedUser)
                            }
                        )
                    }
                }
                .padding()
            }
            .background(themeManager.selectedTheme.screenBackground)
            .navigationTitle("Company")
            .navigationBarTitleDisplayMode(.inline)
            .onChange(of: user.company?.inviteCode) { _, _ in
                if let company = user.company?.asAppCompany() {
                    companyOverride = company
                }
            }
        }
    }
}
