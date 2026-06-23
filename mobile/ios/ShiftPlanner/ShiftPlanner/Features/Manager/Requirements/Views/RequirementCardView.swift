import SwiftUI

struct RequirementCardView: View {
    @EnvironmentObject private var themeManager: ThemeManager
    @EnvironmentObject private var languageManager: LanguageManager
    let requirement: StaffingRequirement
    let onEdit: () -> Void
    let onDuplicate: () -> Void
    let onDelete: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 6) {
                    Text(requirement.positionName)
                        .font(.headline)
                        .foregroundStyle(themeManager.selectedTheme.primaryTextColor)

                    Text("\(requirement.quantity) " + languageManager.text("required", "нужно"))
                        .font(.subheadline)
                        .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
                }

                Spacer()

                Text(timeRangeText)
                    .font(.footnote.monospaced())
                    .fontWeight(.semibold)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(themeManager.selectedTheme.cardTint)
                    .clipShape(Capsule())
            }

            HStack(spacing: 10) {
                Button(languageManager.text("Edit", "Изменить"), action: onEdit)
                    .buttonStyle(.plain)
                    .themeCompactSecondaryAction()

                Button(languageManager.text("Duplicate", "Дублировать"), action: onDuplicate)
                    .buttonStyle(.plain)
                    .themeCompactSecondaryAction()

                Button(languageManager.text("Delete", "Удалить"), role: .destructive, action: onDelete)
                    .buttonStyle(.plain)
                    .themeCompactSecondaryAction()
            }
        }
        .padding(18)
        .themeCard()
    }

    private var timeRangeText: String {
        "\(slotToTime(requirement.startSlot))–\(slotToTime(requirement.endSlot))"
    }

    private func slotToTime(_ slot: Int) -> String {
        let totalMinutes = slot * 30
        let hour = totalMinutes / 60
        let minutes = totalMinutes % 60
        return String(format: "%02d:%02d", hour, minutes)
    }
}
