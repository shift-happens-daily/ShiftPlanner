import SwiftUI

struct TimeSlotWheelPicker: View {
    @Binding var selection: Int
    let title: String
    let allowedRange: ClosedRange<Int>

    var body: some View {
        HStack {
            Text(title)

            Spacer()

            HStack(spacing: 0) {
                Picker(title, selection: hourBinding) {
                    ForEach(availableHours, id: \.self) { hour in
                        Text(String(format: "%02d", hour)).tag(hour)
                    }
                }
                .pickerStyle(.wheel)
                .frame(width: 72, height: 110)
                .clipped()

                Text(":")
                    .font(.title3.monospaced())
                    .fontWeight(.semibold)

                Picker(title, selection: minuteBinding) {
                    ForEach(availableMinutes, id: \.self) { minute in
                        Text(String(format: "%02d", minute)).tag(minute)
                    }
                }
                .pickerStyle(.wheel)
                .frame(width: 72, height: 110)
                .clipped()
            }
        }
    }

    private var availableHours: [Int] {
        Array(Set((allowedRange.lowerBound...allowedRange.upperBound).map { $0 / 2 })).sorted()
    }

    private var currentHour: Int {
        selection / 2
    }

    private var availableMinutes: [Int] {
        availableMinutes(for: currentHour)
    }

    private var hourBinding: Binding<Int> {
        Binding(
            get: { currentHour },
            set: { newHour in
                let preferredMinute = (selection % 2) * 30
                let minutes = availableMinutes(for: newHour)
                let chosenMinute = minutes.contains(preferredMinute) ? preferredMinute : (minutes.first ?? 0)
                selection = clampedSlot(hour: newHour, minute: chosenMinute)
            }
        )
    }

    private var minuteBinding: Binding<Int> {
        Binding(
            get: {
                let minute = (selection % 2) * 30
                return availableMinutes.contains(minute) ? minute : (availableMinutes.first ?? 0)
            },
            set: { newMinute in
                selection = clampedSlot(hour: currentHour, minute: newMinute)
            }
        )
    }

    private func availableMinutes(for hour: Int) -> [Int] {
        (allowedRange.lowerBound...allowedRange.upperBound)
            .filter { ($0 / 2) == hour }
            .map { ($0 % 2) * 30 }
    }

    private func clampedSlot(hour: Int, minute: Int) -> Int {
        let slot = (hour * 60 + minute) / 30
        return min(max(slot, allowedRange.lowerBound), allowedRange.upperBound)
    }
}
