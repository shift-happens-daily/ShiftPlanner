import SwiftUI
import UIKit

struct CompanyView: View {
    let user: AppUser
    let onUserUpdated: (AppUser) -> Void

    @State private var isShowingInviteSheet = false
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
                                .buttonStyle(.bordered)

                                ShareLink(
                                    item: "Join \(company.name) in ShiftPlanner with invite code: \(company.inviteCode)",
                                    subject: Text("ShiftPlanner invite")
                                ) {
                                    Label("Share", systemImage: "square.and.arrow.up")
                                }
                                .buttonStyle(.borderedProminent)
                            }

                            Text("Share this code with employees so they can join the company.")
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding()
                        .background(Color.blue.opacity(0.08))
                        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                    } else {
                        VStack(alignment: .leading, spacing: 16) {
                            Text("You are not attached to a company yet.")
                                .font(.title3)
                                .bold()

                            Text("You can enter an invite code if your company already exists, or create a new company.")
                                .foregroundStyle(.secondary)
                        }

                        VStack(alignment: .leading, spacing: 12) {
                            Text("Join by invite code")
                                .font(.headline)
                            Text("Useful when your company already exists or when multiple managers will be supported.")
                                .foregroundStyle(.secondary)

                            Button("Enter invite code") {
                                isShowingInviteSheet = true
                            }
                            .buttonStyle(.bordered)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding()
                        .background(Color.orange.opacity(0.08))
                        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))

                        VStack(alignment: .leading, spacing: 12) {
                            Text("Create a company")
                                .font(.headline)
                            Text("Set up the company name now and prepare branch data for the upcoming backend expansion.")
                                .foregroundStyle(.secondary)

                            NavigationLink("Open company setup") {
                                CompanySetupView { createdCompany in
                                    companyOverride = createdCompany
                                }
                            }
                            .buttonStyle(.borderedProminent)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding()
                        .background(Color.blue.opacity(0.08))
                        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                    }
                }
                .padding()
            }
            .navigationTitle("Company")
            .onChange(of: user.company?.inviteCode) { _, _ in
                if let company = user.company?.asAppCompany() {
                    companyOverride = company
                }
            }
            .sheet(isPresented: $isShowingInviteSheet) {
                CompanyInviteView(
                    mode: .managerInvite,
                    onUserJoined: onUserUpdated
                )
            }
        }
    }
}
