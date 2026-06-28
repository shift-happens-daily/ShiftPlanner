import Foundation

struct ScheduleShiftEditorDraft: Identifiable, Equatable {
    let id: UUID
    let shiftId: Int?
    var date: Date
    var positionId: Int?
    var positionName: String?
    var employeeId: Int?
    var startSlot: Int
    var endSlot: Int

    init(
        id: UUID = UUID(),
        shiftId: Int?,
        date: Date,
        positionId: Int?,
        positionName: String? = nil,
        employeeId: Int?,
        startSlot: Int,
        endSlot: Int
    ) {
        self.id = id
        self.shiftId = shiftId
        self.date = date
        self.positionId = positionId
        self.positionName = positionName
        self.employeeId = employeeId
        self.startSlot = startSlot
        self.endSlot = endSlot
    }

    var isExistingShift: Bool {
        shiftId != nil
    }

    var recommendationKey: String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .autoupdatingCurrent
        formatter.dateFormat = "yyyy-MM-dd"
        return "\(formatter.string(from: date))-\(positionId ?? 0)-\(startSlot)-\(endSlot)-\(employeeId ?? 0)"
    }
}
