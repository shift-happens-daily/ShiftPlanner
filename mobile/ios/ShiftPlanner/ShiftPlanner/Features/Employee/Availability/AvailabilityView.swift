import SwiftUI

struct AvailabilityView: View {
    @EnvironmentObject private var themeManager: ThemeManager
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
                                    .tint(themeManager.selectedTheme.primaryActionTextColor)
                            }

                            Text(viewModel.isSaving
                                ? localized("Saving...", "Сохранение...")
                                : localized("Save availability", "Сохранить доступность"))
                                .font(.headline)
                                .fontWeight(.semibold)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                        .foregroundStyle(themeManager.selectedTheme.primaryActionTextColor)
                        .background(
                            RoundedRectangle(cornerRadius: 18, style: .continuous)
                                .fill(viewModel.canSave ? themeManager.selectedTheme.primaryActionFillColor : themeManager.selectedTheme.secondaryTextColor.opacity(0.45))
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
            .background(themeManager.selectedTheme.screenBackground)
            .navigationTitle(localized("Availability", "Доступность"))
            .navigationBarTitleDisplayMode(.inline)
            .task {
                await viewModel.loadAvailability()
            }
        }
    }
}
