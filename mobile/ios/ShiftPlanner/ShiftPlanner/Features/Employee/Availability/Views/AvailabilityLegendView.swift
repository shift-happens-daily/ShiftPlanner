import SwiftUI

struct AvailabilityLegendView: View {
    @EnvironmentObject private var languageManager: LanguageManager
    let onCopyPreviousWeek: () -> Void
    let onResetWeek: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 16) {
                ForEach(AvailabilityState.allCases) { state in
                    HStack(spacing: 8) {
                        RoundedRectangle(cornerRadius: 6, style: .continuous)
                            .fill(state.fillColor)
                            .overlay {
                                RoundedRectangle(cornerRadius: 6, style: .continuous)
                                    .stroke(state.borderColor, lineWidth: 1)
                            }
                            .frame(width: 18, height: 18)

                        Text(state.shortTitle)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }

            HStack(spacing: 16) {
                Button(languageManager.text("Copy previous week", "Копировать прошлую"), action: onCopyPreviousWeek)
                    .buttonStyle(.plain)
                    .font(.footnote)
                    .foregroundStyle(.blue)

                Button(languageManager.text("Reset week", "Сбросить неделю"), action: onResetWeek)
                    .buttonStyle(.plain)
                    .font(.footnote)
                    .foregroundStyle(.red)

                Spacer()

                Text(languageManager.text("Drag across the grid to paint your week", "Проведите по сетке, чтобы закрасить неделю"))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.horizontal, 4)
    }
}
