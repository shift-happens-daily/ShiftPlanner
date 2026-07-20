import Foundation

/// Polls the existing REST endpoints and raises a local notification for
/// anything new since the last poll. This is the "push to the phone"
/// mechanism: there is no server-side notification store or APNs, so we diff
/// client-side against `SeenStore` and only notify on genuinely new items.
///
/// Runs on foreground activation and from the background-refresh task.
/// Every network call is wrapped so a transient failure just skips this
/// cycle — the next poll re-baselines.
enum NotificationPoller {

    static func poll() async {
        guard let user = await APIAuthRepository().getCurrentUser() else { return }

        switch user.role {
        case .employee:
            await pollEmployee()
        case .manager:
            await pollManager(companyId: user.company?.id)
        }
    }

    // MARK: - Employee

    private static func pollEmployee() async {
        let seen = SeenStore()
        let firstRun = !seen.isInitialized(role: SeenStore.roleEmployee)

        let scheduleRepository = APIScheduleRepository()
        let published = try? await scheduleRepository.fetchLatestSchedule(status: .published)
        let shifts = (try? await scheduleRepository.fetchMySchedule()) ?? []

        // Newly published schedule
        if let published {
            let previousId = seen.lastScheduleId()
            if !firstRun && published.id != previousId {
                Notifier.notify(
                    id: "schedule_published_\(published.id)",
                    title: localized("Schedule published", "Расписание опубликовано"),
                    body: periodText(published.startDate, published.endDate).map {
                        localized("Schedule published for \($0)", "Опубликовано расписание на \($0)")
                    } ?? localized("A new schedule was published", "Опубликовано новое расписание")
                )
            }
            seen.setLastScheduleId(published.id)
        }

        // Newly assigned shifts
        let currentShiftIds = Set(shifts.map { String($0.id) })
        let freshShifts = seen.diffAndStore(key: SeenStore.keyShifts, current: currentShiftIds)
        if !firstRun && !freshShifts.isEmpty {
            Notifier.notify(
                id: "new_shifts",
                title: localized("New shifts", "Новые смены"),
                body: localized(
                    "You've been assigned \(freshShifts.count) shift(s)",
                    "Вам назначено смен: \(freshShifts.count)"
                )
            )
        }

        if firstRun { seen.markInitialized(role: SeenStore.roleEmployee) }
    }

    // MARK: - Manager

    private static func pollManager(companyId: Int?) async {
        let seen = SeenStore()
        let firstRun = !seen.isInitialized(role: SeenStore.roleManager)

        let scheduleRepository = APIScheduleRepository()
        let employeeRepository = APIEmployeeManagementRepository(companyId: companyId)
        let absenceRepository = APIAbsenceRepository()

        let exchange = (try? await scheduleRepository.fetchExchangeRequests()) ?? []
        let employeeRequests = (try? await employeeRepository.fetchEmployeeRequests()) ?? []
        let managerRequests = (try? await employeeRepository.fetchManagerRequests()) ?? []

        // Time off — fan out per employee (no aggregate endpoint).
        let employees = (try? await employeeRepository.fetchEmployees()) ?? []
        var timeOffIds: Set<String> = []
        for employee in employees {
            let absences = (try? await absenceRepository.fetchEmployeeAbsences(employeeId: employee.id)) ?? []
            for absence in absences { timeOffIds.insert("\(employee.id)_\(absence.id)") }
        }

        let freshExchange = seen.diffAndStore(key: SeenStore.keyExchange, current: Set(exchange.map { String($0.id) }))
        let freshEmployees = seen.diffAndStore(key: SeenStore.keyEmployeeRequests, current: Set(employeeRequests.map { String($0.id) }))
        let freshManagers = seen.diffAndStore(key: SeenStore.keyManagerRequests, current: Set(managerRequests.map { String($0.id) }))
        let freshTimeOff = seen.diffAndStore(key: SeenStore.keyTimeOff, current: timeOffIds)

        if !firstRun {
            if !freshExchange.isEmpty {
                Notifier.notify(
                    id: "exchange_requests",
                    title: localized("Exchange requests", "Запросы на обмен"),
                    body: localized(
                        "\(freshExchange.count) new exchange request(s)",
                        "Новых запросов на обмен: \(freshExchange.count)"
                    )
                )
            }
            if !freshEmployees.isEmpty {
                Notifier.notify(
                    id: "employee_requests",
                    title: localized("New employees", "Новые сотрудники"),
                    body: localized(
                        "\(freshEmployees.count) new join request(s)",
                        "Новых заявок на вступление: \(freshEmployees.count)"
                    )
                )
            }
            if !freshManagers.isEmpty {
                Notifier.notify(
                    id: "manager_requests",
                    title: localized("New managers", "Новые менеджеры"),
                    body: localized(
                        "\(freshManagers.count) new manager request(s)",
                        "Новых заявок менеджеров: \(freshManagers.count)"
                    )
                )
            }
            if !freshTimeOff.isEmpty {
                Notifier.notify(
                    id: "timeoff_requests",
                    title: localized("Time off", "Отгулы"),
                    body: localized(
                        "\(freshTimeOff.count) new time-off request(s)",
                        "Новых заявок на отгул: \(freshTimeOff.count)"
                    )
                )
            }
        }

        if firstRun { seen.markInitialized(role: SeenStore.roleManager) }
    }

    // MARK: - Helpers

    private static func periodText(_ start: Date?, _ end: Date?) -> String? {
        guard let start, let end else { return nil }
        let formatter = DateFormatter()
        formatter.dateFormat = "d MMM"
        return "\(formatter.string(from: start)) – \(formatter.string(from: end))"
    }
}
