import SwiftUI

struct AvailabilityGridView: View {
    @EnvironmentObject private var themeManager: ThemeManager
    @ObservedObject var viewModel: AvailabilityViewModel

    private let timeColumnWidth: CGFloat = 40
    private let slotHeight: CGFloat = 17
    private let headerHeight: CGFloat = 42
    @State private var isPainting = false

    private var contentHeight: CGFloat {
        headerHeight + slotHeight * CGFloat(viewModel.timeSlots.count) + 20
    }

    var body: some View {
        GeometryReader { geometry in
            let availableWidth = max(geometry.size.width - 20, 260)
            let dayColumnWidth = floor((availableWidth - timeColumnWidth) / 7)
            let contentWidth = timeColumnWidth + (dayColumnWidth * 7)

            VStack(spacing: 0) {
                headerRow(dayColumnWidth: dayColumnWidth)

                HStack(spacing: 0) {
                    timeColumn
                    paintableGrid(dayColumnWidth: dayColumnWidth)
                }
            }
            .frame(width: contentWidth, alignment: .leading)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .frame(height: contentHeight)
        .padding(10)
        .themeCard()
    }

    private func headerRow(dayColumnWidth: CGFloat) -> some View {
        HStack(spacing: 0) {
            Color.clear
                .frame(width: timeColumnWidth, height: headerHeight)

            ForEach(0..<7, id: \.self) { dayIndex in
                VStack(spacing: 4) {
                    Text(viewModel.shortDayLabel(for: dayIndex))
                        .font(.system(size: 10, weight: .semibold))
                        .fontWeight(.semibold)
                        .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)

                    Text(viewModel.dayNumberLabel(for: dayIndex))
                        .font(.system(size: 13, weight: .bold))
                }
                .frame(width: dayColumnWidth, height: headerHeight)
            }
        }
    }

    private var timeColumn: some View {
        VStack(spacing: 0) {
            ForEach(viewModel.timeSlots.indices, id: \.self) { slotIndex in
                Text(viewModel.timeLabel(for: slotIndex))
                    .font(.system(size: 10))
                    .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
                    .frame(width: timeColumnWidth, height: slotHeight, alignment: .topTrailing)
                    .padding(.trailing, 4)
            }
        }
    }

    private func paintableGrid(dayColumnWidth: CGFloat) -> some View {
        let gridWidth = dayColumnWidth * 7
        let gridHeight = slotHeight * CGFloat(viewModel.timeSlots.count)

        return ZStack(alignment: .topLeading) {
            VStack(spacing: 0) {
                ForEach(viewModel.timeSlots.indices, id: \.self) { slotIndex in
                    HStack(spacing: 0) {
                        ForEach(0..<7, id: \.self) { dayIndex in
                            let state = viewModel.state(forDayIndex: dayIndex, slotIndex: slotIndex)
                            let dividerColor = viewModel.isHalfHourSlot(slotIndex)
                                ? Color.white.opacity(0.75)
                                : Color.white.opacity(0.35)

                            RoundedRectangle(cornerRadius: 0, style: .continuous)
                                .fill(state.fillColor)
                                .overlay {
                                    RoundedRectangle(cornerRadius: 0, style: .continuous)
                                        .stroke(dividerColor, lineWidth: viewModel.isHalfHourSlot(slotIndex) ? 0.35 : 0.6)
                                }
                                .frame(width: dayColumnWidth, height: slotHeight)
                        }
                    }
                }
            }
        }
        .frame(width: gridWidth, height: gridHeight, alignment: .topLeading)
        .contentShape(Rectangle())
        .gesture(
            DragGesture(minimumDistance: 0, coordinateSpace: .local)
                .onChanged { value in
                    if !isPainting {
                        isPainting = true
                        viewModel.beginPainting()
                    }

                    if let cell = cell(at: value.location, dayColumnWidth: dayColumnWidth) {
                        viewModel.paint(dayIndex: cell.dayIndex, slotIndex: cell.slotIndex)
                    }
                }
                .onEnded { _ in
                    isPainting = false
                    viewModel.endPainting()
                }
        )
    }

    private func cell(at location: CGPoint, dayColumnWidth: CGFloat) -> AvailabilityGridCell? {
        let dayIndex = Int(location.x / dayColumnWidth)
        let slotIndex = Int(location.y / slotHeight)

        guard (0..<7).contains(dayIndex),
              viewModel.timeSlots.indices.contains(slotIndex) else {
            return nil
        }

        return AvailabilityGridCell(dayIndex: dayIndex, slotIndex: slotIndex)
    }
}
