import Foundation

protocol ScheduleRepository {
    /// Generate a schedule for the period. Returns one entry per branch that was
    /// scheduled (the deployed backend returns a single object; algorithm2 an array).
    func generateSchedule(startDate: Date, endDate: Date, branchId: Int?) async throws -> [AppSchedule]

    func fetchSchedule(scheduleId: Int) async throws -> AppSchedule

    func fetchLatestSchedule(status: AppScheduleStatus?) async throws -> AppSchedule?

    /// Schedules (any status) overlapping the period, optionally for one branch.
    /// Used to detect conflicts before generating.
    func fetchSchedules(
        startDate: Date?,
        endDate: Date?,
        branchId: Int?,
        status: AppScheduleStatus?
    ) async throws -> [AppScheduleListItem]

    func publishSchedule(scheduleId: Int) async throws -> AppSchedule

    func fetchMySchedule() async throws -> [AppScheduledShift]

    func fetchAvailableEmployees(
        scheduleId: Int,
        shift: AppScheduledShift,
        branchId: Int?,
        includeUnavailable: Bool
    ) async throws -> [AppAvailableEmployee]

    func assignRequirement(
        scheduleId: Int,
        requirementId: Int,
        employeeId: Int
    ) async throws -> AppSchedule

    func createShift(scheduleId: Int, mutation: ScheduleShiftMutation) async throws -> AppSchedule

    func updateShift(
        scheduleId: Int,
        shiftId: Int,
        mutation: ScheduleShiftMutation
    ) async throws -> AppSchedule

    func deleteSchedule(scheduleId: Int) async throws

    func deleteShift(scheduleId: Int, shiftId: Int) async throws -> AppSchedule

    func updateScheduleRequirement(
        scheduleId: Int,
        requirementId: Int,
        mutation: ScheduleShiftMutation,
        quantity: Int
    ) async throws -> AppSchedule
}
