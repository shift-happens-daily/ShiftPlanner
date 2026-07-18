import SwiftUI

/// One option in a `ThemedSegmentedPicker`.
struct ThemedSegment<Value: Hashable> {
    let value: Value
    let title: String

    init(_ value: Value, _ title: String) {
        self.value = value
        self.title = title
    }
}

/// A segmented control that follows the app's color scheme (theme-tinted track,
/// primary-action fill for the selected segment) instead of the stock gray/white
/// UIKit look. Fully reactive to theme changes, so the theme switcher itself
/// recolors live.
struct ThemedSegmentedPicker<Value: Hashable>: View {
    @EnvironmentObject private var themeManager: ThemeManager

    @Binding var selection: Value
    let segments: [ThemedSegment<Value>]

    var body: some View {
        HStack(spacing: 4) {
            ForEach(segments.indices, id: \.self) { index in
                segmentView(segments[index])
            }
        }
        .padding(4)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(themeManager.selectedTheme.cardTint)
        )
    }

    private func segmentView(_ segment: ThemedSegment<Value>) -> some View {
        let isSelected = segment.value == selection
        return Text(segment.title)
            .font(.subheadline.weight(isSelected ? .semibold : .regular))
            .lineLimit(1)
            .minimumScaleFactor(0.75)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
            .foregroundStyle(isSelected
                ? themeManager.selectedTheme.primaryActionTextColor
                : themeManager.selectedTheme.primaryTextColor)
            .background(
                RoundedRectangle(cornerRadius: 9, style: .continuous)
                    .fill(isSelected ? themeManager.selectedTheme.primaryActionFillColor : Color.clear)
            )
            .contentShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
            .onTapGesture {
                guard segment.value != selection else { return }
                withAnimation(.easeInOut(duration: 0.18)) {
                    selection = segment.value
                }
            }
    }
}
