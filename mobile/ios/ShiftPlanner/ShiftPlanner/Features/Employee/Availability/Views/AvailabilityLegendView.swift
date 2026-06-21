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
                Button("Copy previous week", action: onCopyPreviousWeek)
                    .buttonStyle(.plain)
                    .font(.footnote)
                    .foregroundStyle(.blue)

                Button("Reset week", action: onResetWeek)
                    .buttonStyle(.plain)
                    .font(.footnote)
                    .foregroundStyle(.red)

                Spacer()

                Text("Drag across the grid to paint your week")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.horizontal, 4)
    }
}
