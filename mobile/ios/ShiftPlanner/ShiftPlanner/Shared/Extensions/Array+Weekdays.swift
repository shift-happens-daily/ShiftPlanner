extension Array where Element == String {
    func reorderedFromSundayToMonday() -> [String] {
        guard count == 7 else { return self }
        return Array(self[1...6]) + [self[0]]
    }
}
