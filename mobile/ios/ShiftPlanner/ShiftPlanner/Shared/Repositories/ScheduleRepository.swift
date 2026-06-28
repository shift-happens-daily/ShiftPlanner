import Foundation

struct ScheduleShiftMutation: Equatable {
    let date: Date
    let startMinutes: Int
    let endMinutes: Int
    let positionId: Int
    let employeeId: Int?
}

protocol ScheduleRepository {
    func generateSchedule(startDate: Date, endDate: Date) async throws -> AppSchedule
    func fetchSchedule(scheduleId: Int) async throws -> AppSchedule
    func fetchLatestSchedule(status: AppScheduleStatus?) async throws -> AppSchedule?
    func publishSchedule(scheduleId: Int) async throws -> AppSchedule
    func fetchMySchedule() async throws -> [AppScheduledShift]
    func fetchAvailableEmployees(
        scheduleId: Int,
        shift: AppScheduledShift,
        branchId: Int?
    ) async throws -> [AppAvailableEmployee]
    func assignRequirement(
        scheduleId: Int,
        requirementId: Int,
        employeeId: Int
    ) async throws -> AppSchedule
    func createShift(
        scheduleId: Int,
        payload: ScheduleShiftMutation
    ) async throws -> AppSchedule
    func updateShift(
        scheduleId: Int,
        shiftId: Int,
        payload: ScheduleShiftMutation
    ) async throws -> AppSchedule
    func deleteShift(
        scheduleId: Int,
        shiftId: Int
    ) async throws -> AppSchedule
    func updateScheduleRequirement(
        scheduleId: Int,
        requirementId: Int,
        date: Date,
        positionId: Int,
        quantity: Int,
        startSlot: Int,
        endSlot: Int
    ) async throws -> AppSchedule
}
