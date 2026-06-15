import SwiftUI

struct EmployeeMainView: View {
    var body: some View {
        TabView {
            AvailabilityView()
                .tabItem {
                    Label("Availability", systemImage: "clock.badge.checkmark")
                }
            
            EmployeeScheduleView()
                .tabItem {
                    Label("Schedule", systemImage: "calendar")
                }
        }
    }
}
