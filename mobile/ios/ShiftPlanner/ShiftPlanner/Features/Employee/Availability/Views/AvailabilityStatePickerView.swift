import SwiftUI

struct AvailabilityStatePickerView: View {
    @EnvironmentObject private var themeManager: ThemeManager
    let selectedState: AvailabilityState
    let onSelectState: (AvailabilityState) -> Void
    let onCopyPreviousWeek: () -> Void
    let onResetWeek: () -> Void
    let isSaving: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                ForEach(AvailabilityState.allCases) { state in
                    Button {
                        onSelectState(state)
                    } label: {
                        HStack(spacing: 8) {
                            RoundedRectangle(cornerRadius: 6, style: .continuous)
                                .fill(state.fillColor)
                                .overlay {
                                    RoundedRectangle(cornerRadius: 6, style: .continuous)
                                        .stroke(state.borderColor, lineWidth: 1.2)
                                }
                                .frame(width: 14, height: 14)

                            Text(state.shortTitle)
                                .font(.caption)
                                .fontWeight(.semibold)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .padding(.horizontal, 8)
                        .background(selectedState == state ? state.fillColor.opacity(0.22) : themeManager.selectedTheme.surfaceColor.opacity(0.88))
                        .overlay {
                            RoundedRectangle(cornerRadius: 14, style: .continuous)
                                .stroke(selectedState == state ? state.borderColor : .clear, lineWidth: 1.5)
                        }
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    }
                    .buttonStyle(.plain)
                }
            }

            HStack(spacing: 16) {
                Button("Copy previous week", action: onCopyPreviousWeek)
                    .buttonStyle(.plain)
                    .font(.footnote)
                    .foregroundStyle(themeManager.selectedTheme.accentColor)
                    .disabled(isSaving)

                Button("Reset week", action: onResetWeek)
                    .buttonStyle(.plain)
                    .font(.footnote)
                    .foregroundStyle(themeManager.selectedTheme.destructiveColor)
                    .disabled(isSaving)

                Spacer()
            }
        }
        .padding(12)
        .themeCard()
    }
}
