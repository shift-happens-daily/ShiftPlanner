import SwiftUI

struct ManagerMainView: View {
    var body: some View {
        TabView {
            CompanyView()
                .tabItem {
                    Label("Company", systemImage: "building.2")
                }
            
            EmployeeListView()
                .tabItem {
                    Label("Employees", systemImage: "person.3")
                }
            
            RequirementsView()
                .tabItem {
                    Label("Rules", systemImage: "slider.horizontal.3")
                }
            
            ManagerScheduleView()
                .tabItem {
                    Label("Schedule", systemImage: "calendar")
                }
            
            
        }
    }
}
