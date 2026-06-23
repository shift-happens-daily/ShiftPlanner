import SwiftUI

struct ScheduleCalendarSectionView<Item: Identifiable, RowContent: View>: View {
    @EnvironmentObject private var themeManager: ThemeManager
    @EnvironmentObject private var languageManager: LanguageManager

    let items: [Item]
    let sectionTitle: String
    let dateProvider: (Item) -> Date
    let rowContent: (Item) -> RowContent

    @State private var selectedDate: Date?
    @State private var visibleMonth: Date = Date()
    @State private var granularity: ScheduleCalendarGranularity = .month

    private var calendar: Calendar {
        var calendar = Calendar.current
        calendar.locale = languageManager.locale
        return calendar
    }

    private var groupedItems: [Date: [Item]] {
        Dictionary(grouping: items) { item in
            calendar.startOfDay(for: dateProvider(item))
        }
    }

    private var availableDates: [Date] {
        groupedItems.keys.sorted()
    }

    private var effectiveSelectedDate: Date? {
        if let selectedDate, availableDates.contains(selectedDate) {
            return selectedDate
        }
        return availableDates.first
    }

    private var selectedItems: [Item] {
        guard let effectiveSelectedDate else { return [] }
        return groupedItems[effectiveSelectedDate] ?? []
    }

    private var availableWeeks: [Date] {
        Array(Set(availableDates.compactMap { weekStart(for: $0) })).sorted()
    }

    private var effectiveWeekStart: Date? {
        guard let effectiveSelectedDate else { return nil }
        return weekStart(for: effectiveSelectedDate)
    }

    private var selectedWeekDates: [Date] {
        guard let effectiveWeekStart else { return [] }
        return (0..<7).compactMap { offset in
            calendar.date(byAdding: .day, value: offset, to: effectiveWeekStart)
        }
    }

    private var selectedWeekSections: [ScheduleDaySection<Item>] {
        selectedWeekDates.compactMap { date in
            let normalizedDate = calendar.startOfDay(for: date)
            guard let items = groupedItems[normalizedDate], !items.isEmpty else { return nil }
            return ScheduleDaySection(date: normalizedDate, items: items)
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            granularityPicker

            switch granularity {
            case .day:
                dayModeContent
            case .week:
                weekModeContent
            case .month:
                monthModeContent
            }
        }
        .onAppear {
            syncSelection(with: availableDates)
        }
        .onChange(of: availableDates) { _, newDates in
            syncSelection(with: newDates)
        }
        .onChange(of: effectiveSelectedDate) { _, newValue in
            guard let newValue else { return }
            visibleMonth = monthStart(for: newValue)
        }
    }

    private var granularityPicker: some View {
        Picker("", selection: $granularity) {
            Text(languageManager.text("Day", "День"))
                .tag(ScheduleCalendarGranularity.day)
            Text(languageManager.text("Week", "Неделя"))
                .tag(ScheduleCalendarGranularity.week)
            Text(languageManager.text("Month", "Месяц"))
                .tag(ScheduleCalendarGranularity.month)
        }
        .pickerStyle(.segmented)
        .padding(8)
        .background(themeManager.selectedTheme.elevatedSurfaceColor)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(themeManager.selectedTheme.borderColor, lineWidth: 1)
        }
    }

    @ViewBuilder
    private var dayModeContent: some View {
        if let effectiveSelectedDate {
            VStack(alignment: .leading, spacing: 16) {
                HStack {
                    Button {
                        moveDay(by: -1)
                    } label: {
                        navigationCircle(systemName: "chevron.left")
                    }
                    .buttonStyle(.plain)
                    .disabled(!canMoveDay(by: -1))
                    .opacity(canMoveDay(by: -1) ? 1 : 0.35)

                    Spacer()

                    VStack(spacing: 4) {
                        Text(languageManager.text("Selected day", "Выбранный день"))
                            .font(.caption)
                            .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
                        Text(formattedDate(effectiveSelectedDate))
                            .font(.headline)
                            .foregroundStyle(themeManager.selectedTheme.primaryTextColor)
                    }

                    Spacer()

                    Button {
                        moveDay(by: 1)
                    } label: {
                        navigationCircle(systemName: "chevron.right")
                    }
                    .buttonStyle(.plain)
                    .disabled(!canMoveDay(by: 1))
                    .opacity(canMoveDay(by: 1) ? 1 : 0.35)
                }
                .padding(18)
                .themeCard()

                itemsCard(
                    title: sectionTitle,
                    subtitle: formattedDate(effectiveSelectedDate),
                    items: selectedItems
                )
            }
        }
    }

    @ViewBuilder
    private var weekModeContent: some View {
        if let effectiveWeekStart {
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 14) {
                    HStack {
                        Button {
                            moveWeek(by: -1)
                        } label: {
                            navigationCircle(systemName: "chevron.left")
                        }
                        .buttonStyle(.plain)
                        .disabled(!canMoveWeek(by: -1))
                        .opacity(canMoveWeek(by: -1) ? 1 : 0.35)

                        Spacer()

                        Text(formattedWeekRange(start: effectiveWeekStart))
                            .font(.headline)
                            .foregroundStyle(themeManager.selectedTheme.primaryTextColor)

                        Spacer()

                        Button {
                            moveWeek(by: 1)
                        } label: {
                            navigationCircle(systemName: "chevron.right")
                        }
                        .buttonStyle(.plain)
                        .disabled(!canMoveWeek(by: 1))
                        .opacity(canMoveWeek(by: 1) ? 1 : 0.35)
                    }

                    HStack(spacing: 8) {
                        ForEach(selectedWeekDates, id: \.self) { date in
                            weekDayCell(date)
                        }
                    }
                }
                .padding(18)
                .themeCard()

                VStack(alignment: .leading, spacing: 14) {
                    Text(sectionTitle)
                        .font(.headline)
                        .foregroundStyle(themeManager.selectedTheme.primaryTextColor)

                    ForEach(selectedWeekSections, id: \.date) { section in
                        VStack(alignment: .leading, spacing: 10) {
                            Text(formattedDate(section.date))
                                .font(.subheadline)
                                .fontWeight(.semibold)
                                .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)

                            ForEach(section.items) { item in
                                rowContent(item)
                            }
                        }
                    }
                }
                .padding(18)
                .themeCard()
            }
        }
    }

    @ViewBuilder
    private var monthModeContent: some View {
        ScheduleCalendarMonthPickerView(
            visibleMonth: $visibleMonth,
            selectedDate: Binding(
                get: { effectiveSelectedDate },
                set: { selectedDate = $0 }
            ),
            availableDates: availableDates
        )

        if let effectiveSelectedDate {
            itemsCard(
                title: sectionTitle,
                subtitle: formattedDate(effectiveSelectedDate),
                items: selectedItems
            )
        }
    }

    private func itemsCard(title: String, subtitle: String, items: [Item]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title)
                .font(.headline)
                .foregroundStyle(themeManager.selectedTheme.primaryTextColor)

            Text(subtitle)
                .font(.subheadline)
                .fontWeight(.semibold)
                .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)

            ForEach(items) { item in
                rowContent(item)
            }
        }
        .padding(18)
        .themeCard()
    }

    private func weekDayCell(_ date: Date) -> some View {
        let normalizedDate = calendar.startOfDay(for: date)
        let isAvailable = groupedItems[normalizedDate] != nil
        let isSelected = normalizedDate == effectiveSelectedDate
        let shortLabel = shortWeekdayLabel(for: date)
        let dayNumber = calendar.component(.day, from: date)

        return Button {
            if isAvailable {
                selectedDate = normalizedDate
            }
        } label: {
            VStack(spacing: 4) {
                Text(shortLabel)
                    .font(.caption2)
                    .fontWeight(.semibold)

                Text("\(dayNumber)")
                    .font(.subheadline.weight(.semibold))

                Circle()
                    .fill(isAvailable ? currentDotColor(isSelected: isSelected) : .clear)
                    .frame(width: 5, height: 5)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 54)
            .foregroundStyle(currentTextColor(isSelected: isSelected, isAvailable: isAvailable))
            .background(currentBackgroundColor(isSelected: isSelected, isAvailable: isAvailable))
            .overlay {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(currentBorderColor(isSelected: isSelected, isAvailable: isAvailable), lineWidth: 1)
            }
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
        .buttonStyle(.plain)
        .disabled(!isAvailable)
    }

    private func navigationCircle(systemName: String) -> some View {
        Image(systemName: systemName)
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(themeManager.selectedTheme.accentColor)
            .frame(width: 34, height: 34)
            .background(themeManager.selectedTheme.cardTint)
            .clipShape(Circle())
    }

    private func syncSelection(with dates: [Date]) {
        guard let firstDate = dates.first else {
            selectedDate = nil
            return
        }

        if let selectedDate, dates.contains(selectedDate) {
            visibleMonth = monthStart(for: selectedDate)
            return
        }

        selectedDate = firstDate
        visibleMonth = monthStart(for: firstDate)
    }

    private func canMoveDay(by value: Int) -> Bool {
        guard let currentDate = effectiveSelectedDate else { return false }
        return indexOfDate(currentDate) != nil && targetDate(from: currentDate, step: value) != nil
    }

    private func moveDay(by value: Int) {
        guard let currentDate = effectiveSelectedDate, let nextDate = targetDate(from: currentDate, step: value) else {
            return
        }
        selectedDate = nextDate
    }

    private func targetDate(from currentDate: Date, step: Int) -> Date? {
        guard let currentIndex = indexOfDate(currentDate) else { return nil }
        let nextIndex = currentIndex + step
        guard availableDates.indices.contains(nextIndex) else { return nil }
        return availableDates[nextIndex]
    }

    private func indexOfDate(_ date: Date) -> Int? {
        availableDates.firstIndex(of: calendar.startOfDay(for: date))
    }

    private func canMoveWeek(by value: Int) -> Bool {
        guard let currentWeekStart = effectiveWeekStart, let currentIndex = availableWeeks.firstIndex(of: currentWeekStart) else {
            return false
        }
        return availableWeeks.indices.contains(currentIndex + value)
    }

    private func moveWeek(by value: Int) {
        guard let currentWeekStart = effectiveWeekStart, let currentIndex = availableWeeks.firstIndex(of: currentWeekStart) else {
            return
        }

        let nextIndex = currentIndex + value
        guard availableWeeks.indices.contains(nextIndex) else { return }

        let nextWeekStart = availableWeeks[nextIndex]
        if let firstAvailableDate = availableDates.first(where: { weekStart(for: $0) == nextWeekStart }) {
            selectedDate = firstAvailableDate
        }
    }

    private func weekStart(for date: Date) -> Date? {
        guard let start = calendar.dateInterval(of: .weekOfYear, for: date)?.start else {
            return nil
        }
        return calendar.startOfDay(for: start)
    }

    private func monthStart(for date: Date) -> Date {
        calendar.date(from: calendar.dateComponents([.year, .month], from: date)) ?? date
    }

    private func shortWeekdayLabel(for date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = languageManager.locale
        formatter.dateFormat = "EE"
        return formatter.string(from: date).uppercased()
    }

    private func formattedDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = languageManager.locale
        formatter.dateFormat = "EEEE, d MMM"
        return formatter.string(from: date)
    }

    private func formattedWeekRange(start: Date) -> String {
        guard let end = calendar.date(byAdding: .day, value: 6, to: start) else {
            return formattedDate(start)
        }

        let formatter = DateFormatter()
        formatter.locale = languageManager.locale
        formatter.dateFormat = "d MMM"
        return "\(formatter.string(from: start)) - \(formatter.string(from: end))"
    }

    private func currentTextColor(isSelected: Bool, isAvailable: Bool) -> Color {
        if isSelected {
            return themeManager.selectedTheme.primaryActionTextColor
        }

        if isAvailable {
            return themeManager.selectedTheme.primaryTextColor
        }

        return themeManager.selectedTheme.secondaryTextColor.opacity(0.45)
    }

    private func currentBackgroundColor(isSelected: Bool, isAvailable: Bool) -> Color {
        if isSelected {
            return themeManager.selectedTheme.primaryActionFillColor
        }

        if isAvailable {
            return themeManager.selectedTheme.cardTint
        }

        return .clear
    }

    private func currentBorderColor(isSelected: Bool, isAvailable: Bool) -> Color {
        if isSelected {
            return themeManager.selectedTheme.primaryActionFillColor
        }

        if isAvailable {
            return themeManager.selectedTheme.borderColor
        }

        return .clear
    }

    private func currentDotColor(isSelected: Bool) -> Color {
        isSelected
            ? themeManager.selectedTheme.primaryActionTextColor
            : themeManager.selectedTheme.accentColor
    }
}

private struct ScheduleCalendarMonthPickerView: View {
    @EnvironmentObject private var themeManager: ThemeManager
    @EnvironmentObject private var languageManager: LanguageManager

    @Binding var visibleMonth: Date
    @Binding var selectedDate: Date?

    let availableDates: [Date]

    private let columns = Array(repeating: GridItem(.flexible(), spacing: 8), count: 7)

    private var calendar: Calendar {
        var calendar = Calendar.current
        calendar.locale = languageManager.locale
        return calendar
    }

    private var normalizedAvailableDates: Set<Date> {
        Set(availableDates.map { calendar.startOfDay(for: $0) })
    }

    private var daysInVisibleMonth: [CalendarDayItem] {
        guard
            let monthInterval = calendar.dateInterval(of: .month, for: visibleMonth),
            let weekdayRange = calendar.range(of: .day, in: .month, for: visibleMonth)
        else {
            return []
        }

        let firstDay = monthInterval.start
        let firstWeekday = calendar.component(.weekday, from: firstDay)
        let leadingSlots = (firstWeekday - calendar.firstWeekday + 7) % 7

        var days = Array(
            repeating: CalendarDayItem(id: UUID().uuidString, date: nil, isAvailable: false, isSelected: false),
            count: leadingSlots
        )

        for day in weekdayRange {
            guard let date = calendar.date(byAdding: .day, value: day - 1, to: firstDay) else {
                continue
            }

            let normalizedDate = calendar.startOfDay(for: date)
            days.append(
                CalendarDayItem(
                    id: "\(normalizedDate.timeIntervalSince1970)",
                    date: normalizedDate,
                    isAvailable: normalizedAvailableDates.contains(normalizedDate),
                    isSelected: normalizedDate == selectedDate
                )
            )
        }

        return days
    }

    private var monthBounds: ClosedRange<Date>? {
        guard
            let firstDate = availableDates.first,
            let lastDate = availableDates.last,
            let firstMonth = calendar.date(from: calendar.dateComponents([.year, .month], from: firstDate)),
            let lastMonth = calendar.date(from: calendar.dateComponents([.year, .month], from: lastDate))
        else {
            return nil
        }

        return firstMonth...lastMonth
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Button {
                    moveMonth(by: -1)
                } label: {
                    navigationCircle(systemName: "chevron.left")
                }
                .buttonStyle(.plain)
                .disabled(!canMoveMonth(by: -1))
                .opacity(canMoveMonth(by: -1) ? 1 : 0.35)

                Spacer()

                Text(monthTitle)
                    .font(.headline)
                    .foregroundStyle(themeManager.selectedTheme.primaryTextColor)

                Spacer()

                Button {
                    moveMonth(by: 1)
                } label: {
                    navigationCircle(systemName: "chevron.right")
                }
                .buttonStyle(.plain)
                .disabled(!canMoveMonth(by: 1))
                .opacity(canMoveMonth(by: 1) ? 1 : 0.35)
            }

            LazyVGrid(columns: columns, spacing: 8) {
                ForEach(weekdaySymbols, id: \.self) { symbol in
                    Text(symbol)
                        .font(.caption2)
                        .fontWeight(.semibold)
                        .foregroundStyle(themeManager.selectedTheme.secondaryTextColor)
                        .frame(maxWidth: .infinity)
                }

                ForEach(daysInVisibleMonth) { day in
                    dayCell(day)
                }
            }
        }
        .padding(18)
        .themeCard()
    }

    private var monthTitle: String {
        let formatter = DateFormatter()
        formatter.locale = languageManager.locale
        formatter.dateFormat = "LLLL yyyy"
        return formatter.string(from: visibleMonth)
    }

    private var weekdaySymbols: [String] {
        let formatter = DateFormatter()
        formatter.locale = languageManager.locale

        let symbols = formatter.shortStandaloneWeekdaySymbols ?? formatter.shortWeekdaySymbols ?? []
        guard !symbols.isEmpty else { return [] }

        let shift = max(0, calendar.firstWeekday - 1)
        return Array(symbols[shift...] + symbols[..<shift]).map { $0.uppercased() }
    }

    @ViewBuilder
    private func dayCell(_ day: CalendarDayItem) -> some View {
        if let date = day.date {
            Button {
                selectedDate = date
            } label: {
                VStack(spacing: 4) {
                    Text("\(calendar.component(.day, from: date))")
                        .font(.subheadline.weight(.semibold))

                    Circle()
                        .fill(day.isAvailable ? currentDotColor(for: day) : .clear)
                        .frame(width: 5, height: 5)
                }
                .frame(maxWidth: .infinity)
                .frame(height: 42)
                .foregroundStyle(currentTextColor(for: day))
                .background(currentBackgroundColor(for: day))
                .overlay {
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .stroke(currentBorderColor(for: day), lineWidth: 1)
                }
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
            .buttonStyle(.plain)
            .disabled(!day.isAvailable)
        } else {
            Color.clear
                .frame(height: 42)
        }
    }

    private func canMoveMonth(by value: Int) -> Bool {
        guard
            let monthBounds,
            let targetMonth = calendar.date(byAdding: .month, value: value, to: visibleMonth)
        else {
            return false
        }

        let normalizedTargetMonth = monthStart(for: targetMonth)
        return monthBounds.contains(normalizedTargetMonth)
    }

    private func moveMonth(by value: Int) {
        guard let nextMonth = calendar.date(byAdding: .month, value: value, to: visibleMonth) else {
            return
        }

        visibleMonth = monthStart(for: nextMonth)

        let datesInMonth = availableDates.filter { date in
            calendar.isDate(date, equalTo: visibleMonth, toGranularity: .month)
        }

        if let firstDateInMonth = datesInMonth.first {
            selectedDate = firstDateInMonth
        }
    }

    private func monthStart(for date: Date) -> Date {
        calendar.date(from: calendar.dateComponents([.year, .month], from: date)) ?? date
    }

    private func navigationCircle(systemName: String) -> some View {
        Image(systemName: systemName)
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(themeManager.selectedTheme.accentColor)
            .frame(width: 34, height: 34)
            .background(themeManager.selectedTheme.cardTint)
            .clipShape(Circle())
    }

    private func currentTextColor(for day: CalendarDayItem) -> Color {
        if day.isSelected {
            return themeManager.selectedTheme.primaryActionTextColor
        }

        if day.isAvailable {
            return themeManager.selectedTheme.primaryTextColor
        }

        return themeManager.selectedTheme.secondaryTextColor.opacity(0.45)
    }

    private func currentBackgroundColor(for day: CalendarDayItem) -> Color {
        if day.isSelected {
            return themeManager.selectedTheme.primaryActionFillColor
        }

        if day.isAvailable {
            return themeManager.selectedTheme.cardTint
        }

        return .clear
    }

    private func currentBorderColor(for day: CalendarDayItem) -> Color {
        if day.isSelected {
            return themeManager.selectedTheme.primaryActionFillColor
        }

        if day.isAvailable {
            return themeManager.selectedTheme.borderColor
        }

        return .clear
    }

    private func currentDotColor(for day: CalendarDayItem) -> Color {
        day.isSelected
            ? themeManager.selectedTheme.primaryActionTextColor
            : themeManager.selectedTheme.accentColor
    }
}

private struct CalendarDayItem: Identifiable {
    let id: String
    let date: Date?
    let isAvailable: Bool
    let isSelected: Bool
}

private struct ScheduleDaySection<Item: Identifiable> {
    let date: Date
    let items: [Item]
}

enum SchedulePresentationMode: Hashable {
    case list
    case calendar
}

enum ScheduleCalendarGranularity: Hashable {
    case day
    case week
    case month
}
