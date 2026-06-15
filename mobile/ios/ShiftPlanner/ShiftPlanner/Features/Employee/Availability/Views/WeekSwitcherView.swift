import SwiftUI

struct WeekSwitcherView: View {
    let title: String
    let onPreviousWeek: () -> Void
    let onNextWeek: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            Button(action: onPreviousWeek) {
                Image(systemName: "chevron.left")
                    .font(.headline)
                    .frame(width: 40, height: 40)
                    .background(.white.opacity(0.72))
                    .clipShape(Circle())
            }

            Spacer()

            VStack(spacing: 4) {
                Text("Week")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text(title)
                    .font(.headline)
                    .fontWeight(.semibold)
            }

            Spacer()

            Button(action: onNextWeek) {
                Image(systemName: "chevron.right")
                    .font(.headline)
                    .frame(width: 40, height: 40)
                    .background(.white.opacity(0.72))
                    .clipShape(Circle())
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 12)
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
    }
}
