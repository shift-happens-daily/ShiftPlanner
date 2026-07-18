import SwiftUI

struct AvailabilityLegendView: View {
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
                Button(localized("Copy previous week", "Скопировать прошлую неделю"), action: onCopyPreviousWeek)
                    .buttonStyle(.plain)
                    .font(.footnote)
                    .foregroundStyle(.blue)

                Button(localized("Reset week", "Сбросить неделю"), action: onResetWeek)
                    .buttonStyle(.plain)
                    .font(.footnote)
                    .foregroundStyle(.red)

                Spacer()

                Text(localized("Drag across the grid to paint your week", "Проведите по сетке, чтобы заполнить неделю"))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.horizontal, 4)
    }
}
