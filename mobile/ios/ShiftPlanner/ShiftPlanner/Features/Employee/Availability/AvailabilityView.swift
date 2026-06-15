import SwiftUI

struct AvailabilityView: View {
    @StateObject private var viewModel = AvailabilityViewModel()

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
                        onResetWeek: viewModel.resetWeek
                    )

                    AvailabilityGridView(viewModel: viewModel)
                }
                .padding()
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Availability")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}
