import Foundation
import Combine

@MainActor
final class RequirementsViewModel: ObservableObject {
    @Published private(set) var selectedWeekday = 0
    @Published var requirements: [StaffingRequirement] = []
    @Published var activeDraft: StaffingRequirementDraft?

    let availablePositions: [RequirementPositionOption] = [
        RequirementPositionOption(id: UUID(), name: "Barista"),
        RequirementPositionOption(id: UUID(), name: "Waiter"),
        RequirementPositionOption(id: UUID(), name: "Cook"),
        RequirementPositionOption(id: UUID(), name: "Host"),
        RequirementPositionOption(id: UUID(), name: "Manager")
    ]

    let weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    let timeSlots = Array(stride(from: 16, through: 44, by: 1))

    init() {
        let barista = availablePositions[0]
        let waiter = availablePositions[1]
        let host = availablePositions[3]

        requirements = [
            StaffingRequirement(id: UUID(), weekday: 0, positionId: barista.id, positionName: barista.name, quantity: 2, startSlot: 17, endSlot: 36),
            StaffingRequirement(id: UUID(), weekday: 0, positionId: waiter.id, positionName: waiter.name, quantity: 2, startSlot: 18, endSlot: 36),
            StaffingRequirement(id: UUID(), weekday: 0, positionId: host.id, positionName: host.name, quantity: 1, startSlot: 20, endSlot: 32),
            StaffingRequirement(id: UUID(), weekday: 4, positionId: waiter.id, positionName: waiter.name, quantity: 3, startSlot: 20, endSlot: 40)
        ]
    }

    var selectedWeekdaySummary: String {
        weekdayLabels[selectedWeekday]
    }

    var requirementsForSelectedDay: [StaffingRequirement] {
        requirements
            .filter { $0.weekday == selectedWeekday }
            .sorted { lhs, rhs in
                if lhs.startSlot == rhs.startSlot {
                    return lhs.positionName < rhs.positionName
                }
                return lhs.startSlot < rhs.startSlot
            }
    }

    func weekdayTitle(for weekday: Int) -> String {
        weekdayLabels[weekday]
    }

    func selectWeekday(_ weekday: Int) {
        selectedWeekday = weekday
    }

    func startCreating() {
        activeDraft = StaffingRequirementDraft(
            id: UUID(),
            editingRequirementId: nil,
            weekdays: [selectedWeekday],
            positionId: availablePositions.first?.id,
            quantity: 1,
            startSlot: 17,
            endSlot: 36
        )
    }

    func startEditing(_ requirement: StaffingRequirement) {
        activeDraft = StaffingRequirementDraft(
            id: UUID(),
            editingRequirementId: requirement.id,
            weekdays: [requirement.weekday],
            positionId: requirement.positionId,
            quantity: requirement.quantity,
            startSlot: requirement.startSlot,
            endSlot: requirement.endSlot
        )
    }

    func cancelEditing() {
        activeDraft = nil
    }

    func saveDraft(_ draft: StaffingRequirementDraft) {
        guard let positionId = draft.positionId,
              let position = availablePositions.first(where: { $0.id == positionId }) else {
            return
        }

        let normalizedEndSlot = max(draft.endSlot, draft.startSlot + 1)
        let normalizedWeekdays = draft.weekdays.isEmpty ? [selectedWeekday] : draft.weekdays

        if let editingId = draft.editingRequirementId,
           let index = requirements.firstIndex(where: { $0.id == editingId }),
           let weekday = normalizedWeekdays.sorted().first {
            requirements[index].weekday = weekday
            requirements[index].positionId = position.id
            requirements[index].positionName = position.name
            requirements[index].quantity = max(1, draft.quantity)
            requirements[index].startSlot = draft.startSlot
            requirements[index].endSlot = normalizedEndSlot
            selectedWeekday = weekday
        } else {
            let newItems = normalizedWeekdays.sorted().map { weekday in
                StaffingRequirement(
                    id: UUID(),
                    weekday: weekday,
                    positionId: position.id,
                    positionName: position.name,
                    quantity: max(1, draft.quantity),
                    startSlot: draft.startSlot,
                    endSlot: normalizedEndSlot
                )
            }
            requirements.append(contentsOf: newItems)
            selectedWeekday = normalizedWeekdays.sorted().first ?? selectedWeekday
        }

        activeDraft = nil
    }

    func delete(_ requirement: StaffingRequirement) {
        requirements.removeAll { $0.id == requirement.id }
    }

    func duplicate(_ requirement: StaffingRequirement) {
        requirements.append(
            StaffingRequirement(
                id: UUID(),
                weekday: requirement.weekday,
                positionId: requirement.positionId,
                positionName: requirement.positionName,
                quantity: requirement.quantity,
                startSlot: requirement.startSlot,
                endSlot: requirement.endSlot
            )
        )
    }

    func clearSelectedDay() {
        requirements.removeAll { $0.weekday == selectedWeekday }
    }

    func copySelectedDay(to targetWeekdays: Set<Int>) {
        let validTargets = targetWeekdays.filter { $0 != selectedWeekday }
        guard !validTargets.isEmpty else { return }

        let source = requirementsForSelectedDay
        guard !source.isEmpty else { return }

        requirements.removeAll { validTargets.contains($0.weekday) }

        let cloned = validTargets.sorted().flatMap { weekday in
            source.map {
                StaffingRequirement(
                    id: UUID(),
                    weekday: weekday,
                    positionId: $0.positionId,
                    positionName: $0.positionName,
                    quantity: $0.quantity,
                    startSlot: $0.startSlot,
                    endSlot: $0.endSlot
                )
            }
        }

        requirements.append(contentsOf: cloned)
    }
}
