import SwiftUI

struct EmployeeScheduleView: View {
    @EnvironmentObject private var languageManager: LanguageManager

    var body: some View {
        NavigationStack {
            Text(languageManager.text("Employee schedule", "График сотрудника"))
                .navigationTitle(languageManager.text("Employee schedule", "График сотрудника"))
                .navigationBarTitleDisplayMode(.inline)
        }
    }
}
