import SwiftUI

struct AvailabilityView: View {
    @StateObject private var viewModel: AvailabilityViewModel

    init(
        user: AppUser,
        repository: AvailabilityRepository = APIAvailabilityRepository()
    ) {
        _viewModel = StateObject(
            wrappedValue: AvailabilityViewModel(
                employeeId: user.employeeId,
                repository: repository
            )
        )
    }

    var body: some View {
        NavigationStack {
            ScrollView(showsIndicators: false) {
                VStack(spacing: 16) {
                    WeekSwitcherView(
                        title: viewModel.weekTitle,
                        onPreviousWeek: viewModel.goToPreviousWeek,
                        onNextWeek: viewModel.goToNextWeek
                    )

                    AvailabilityStatePickerView(
                        selectedState: viewModel.selectedState,
                        onSelectState: viewModel.selectState,
                        onCopyPreviousWeek: viewModel.copyPreviousWeek,
                        onResetWeek: viewModel.resetWeek,
                        isSaving: viewModel.isSaving
                    )

                    Button {
                        Task {
                            await viewModel.saveAvailability()
                        }
                    } label: {
                        HStack(spacing: 10) {
                            if viewModel.isSaving {
                                ProgressView()
                                    .tint(.white)
                            }

                            Text(viewModel.isSaving ? "Saving..." : "Save availability")
                                .font(.headline)
                                .fontWeight(.semibold)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                        .foregroundStyle(.white)
                        .background(
                            RoundedRectangle(cornerRadius: 18, style: .continuous)
                                .fill(viewModel.canSave ? Color.blue : Color.gray.opacity(0.55))
                        )
                    }
                    .buttonStyle(.plain)
                    .disabled(!viewModel.canSave)

                    if let statusMessage = viewModel.statusMessage {
                        Text(statusMessage)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }

                    if let errorMessage = viewModel.errorMessage {
                        Text(errorMessage)
                            .font(.footnote)
                            .foregroundStyle(.red)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }

                    AvailabilityGridView(viewModel: viewModel)
                }
                .padding()
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Availability")
            .navigationBarTitleDisplayMode(.inline)
            .task {
                await viewModel.loadAvailability()
            }
        }
    }
}
