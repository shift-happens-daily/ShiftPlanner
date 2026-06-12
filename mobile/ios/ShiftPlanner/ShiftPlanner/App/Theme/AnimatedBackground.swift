import SwiftUI

struct AnimatedBackground: View {
    let theme: AppTheme

    @State private var animate = false

    var body: some View {
        ZStack {
            LinearGradient(
                colors: theme.gradientColors,
                startPoint: animate ? .topLeading : .bottomTrailing,
                endPoint: animate ? .bottomTrailing : .topLeading
            )
            .ignoresSafeArea()

            ForEach(0..<theme.gradientColors.count, id: \.self) { index in
                Circle()
                    .fill(theme.gradientColors[index].opacity(0.07))
                    .frame(
                        width: CGFloat(260 + index * 45),
                        height: CGFloat(260 + index * 45)
                    )
                    .blur(radius: 50)
                    .offset(
                        x: animate
                        ? CGFloat(-140 + index * 90)
                        : CGFloat(160 - index * 80),
                        y: animate
                        ? CGFloat(220 - index * 120)
                        : CGFloat(-180 + index * 90)
                    )
            }
        }
        .animation(
            .easeInOut(duration: 30)
            .repeatForever(autoreverses: true),
            value: animate
        )
        .onAppear {
            animate = true
        }
    }
}
