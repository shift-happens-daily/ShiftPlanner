import Foundation

protocol ScheduleRepository {
    func generateSchedule(startDate: Date, endDate: Date) async throws -> AppSchedule
    func fetchLatestSchedule(status: AppScheduleStatus?) async throws -> AppSchedule?
    func publishSchedule(scheduleId: Int) async throws -> AppSchedule
    func fetchMySchedule() async throws -> [AppScheduledShift]
}
