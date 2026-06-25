import Foundation

enum ScheduleShiftUpdateAction {
    case reassign(employeeId: Int)
    case remove
}

protocol ScheduleRepository {
    func generateSchedule(startDate: Date, endDate: Date) async throws -> AppSchedule
    func fetchSchedule(scheduleId: Int) async throws -> AppSchedule
    func fetchLatestSchedule(status: AppScheduleStatus?) async throws -> AppSchedule?
    func publishSchedule(scheduleId: Int) async throws -> AppSchedule
    func fetchMySchedule() async throws -> [AppScheduledShift]
    func updateShift(
        scheduleId: Int,
        shiftId: Int,
        action: ScheduleShiftUpdateAction
    ) async throws -> AppSchedule
}
