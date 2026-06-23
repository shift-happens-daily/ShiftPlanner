import SwiftUI

struct RequirementsDayPickerView: View {
    @EnvironmentObject private var themeManager: ThemeManager
    let selectedWeekday: Int
    let onSelectWeekday: (Int) -> Void
    let labels: [String]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Button {
                    onSelectWeekday((selectedWeekday + labels.count - 1) % labels.count)
                } label: {
                    Image(systemName: "chevron.left")
                        .font(.headline)
                        .frame(width: 36, height: 36)
                        .background(themeManager.selectedTheme.surfaceColor)
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)

                Spacer()

                Text(labels[selectedWeekday])
                    .font(.headline)
                    .fontWeight(.bold)
                    .foregroundStyle(themeManager.selectedTheme.primaryTextColor)

                Spacer()

                Button {
                    onSelectWeekday((selectedWeekday + 1) % labels.count)
                } label: {
                    Image(systemName: "chevron.right")
                        .font(.headline)
                        .frame(width: 36, height: 36)
                        .background(themeManager.selectedTheme.surfaceColor)
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
            }

            HStack(spacing: 8) {
                ForEach(Array(labels.enumerated()), id: \.offset) { index, label in
                    Button {
                        onSelectWeekday(index)
                    } label: {
                        Text(label)
                            .font(.subheadline)
                            .fontWeight(.semibold)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                            .background(
                                selectedWeekday == index
                                    ? themeManager.selectedTheme.primaryActionFillColor
                                    : themeManager.selectedTheme.surfaceColor
                            )
                            .foregroundStyle(
                                selectedWeekday == index
                                    ? themeManager.selectedTheme.primaryActionTextColor
                                    : themeManager.selectedTheme.primaryTextColor
                            )
                            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(10)
        .themeCard()
    }
}
