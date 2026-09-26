import Foundation

struct WeekSummary: Hashable, Sendable {
    let weekStart: Date
    let workouts: [Workout]
    private let reportedPlannedMileage: Double?
    private let reportedActualMileage: Double?

    init(
        weekStart: Date,
        workouts: [Workout],
        plannedMileage: Double? = nil,
        actualMileage: Double? = nil
    ) {
        self.weekStart = weekStart
        self.workouts = workouts
        self.reportedPlannedMileage = plannedMileage
        self.reportedActualMileage = actualMileage
    }

    var actualMileage: Double {
        if let reportedActualMileage { return reportedActualMileage }
        return workouts.reduce(0) { total, workout in
            guard workout.kind == .run, workout.hasActualExecution else { return total }
            return total + (workout.distanceMiles ?? 0)
        }
    }

    var plannedMileage: Double {
        if let reportedPlannedMileage { return reportedPlannedMileage }
        return workouts.reduce(0) { $0 + ($1.plannedDistanceMiles ?? 0) }
    }

    var totalDurationSeconds: Int {
        workouts.reduce(0) { $0 + ($1.durationSeconds ?? 0) }
    }

    var workoutCount: Int {
        workouts.count
    }

    func workouts(on date: Date, calendar: Calendar = .runner) -> [Workout] {
        workouts.filter { calendar.isDate($0.date, inSameDayAs: date) }
    }

    func actualMileage(on date: Date, calendar: Calendar = .runner) -> Double {
        workouts(on: date, calendar: calendar).reduce(0) { total, workout in
            guard workout.kind == .run, workout.hasActualExecution else { return total }
            return total + (workout.distanceMiles ?? 0)
        }
    }
}

struct MileageTrendPoint: Identifiable, Hashable, Sendable {
    let weekStart: Date
    let actualMileage: Double
    let plannedMileage: Double

    init(weekStart: Date, actualMileage: Double, plannedMileage: Double = 0) {
        self.weekStart = weekStart
        self.actualMileage = actualMileage
        self.plannedMileage = plannedMileage
    }

    var id: Date { weekStart }
}

struct MileageAxisScale: Equatable, Sendable {
    let lowerBound: Double
    let upperBound: Double
    let tickStride: Double

    init(points: [MileageTrendPoint]) {
        let tickStride = 10.0
        let visibleMaximum = max(0, points.map(\.actualMileage).max() ?? 0)

        self.lowerBound = 0
        self.upperBound = max(tickStride, (floor(visibleMaximum / tickStride) + 1) * tickStride)
        self.tickStride = tickStride
    }
}

struct MileageComparison: Equatable, Sendable {
    enum Direction: Equatable, Sendable {
        case increase
        case decrease
        case unchanged
    }

    let current: Double
    let previous: Double

    var direction: Direction {
        if current > previous { return .increase }
        if current < previous { return .decrease }
        return .unchanged
    }

    var percentageChange: Double? {
        guard previous > 0 else { return nil }
        return ((current - previous) / previous) * 100
    }

    var absoluteChange: Double {
        current - previous
    }
}

struct MileageTrendSummary: Equatable, Sendable {
    let newestPoint: MileageTrendPoint?
    let weeklyComparison: MileageComparison?
    let currentAverage: Double
    let previousAverage: Double

    var averageComparison: MileageComparison {
        MileageComparison(current: currentAverage, previous: previousAverage)
    }

    init(currentWindow: [MileageTrendPoint], previousWindow: [MileageTrendPoint]) {
        newestPoint = currentWindow.last
        if currentWindow.count >= 2 {
            weeklyComparison = MileageComparison(
                current: currentWindow[currentWindow.count - 1].actualMileage,
                previous: currentWindow[currentWindow.count - 2].actualMileage
            )
        } else {
            weeklyComparison = nil
        }
        currentAverage = Self.average(currentWindow)
        previousAverage = Self.average(previousWindow)
    }

    private static func average(_ points: [MileageTrendPoint]) -> Double {
        guard !points.isEmpty else { return 0 }
        return points.reduce(0) { $0 + $1.actualMileage } / Double(points.count)
    }
}

extension Calendar {
    nonisolated static var runner: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.locale = Locale(identifier: "en_US_POSIX")
        calendar.firstWeekday = 2
        calendar.minimumDaysInFirstWeek = 4
        return calendar
    }
}

enum RunnerCalendar {
    nonisolated static func mondayStartingWeek(containing date: Date, calendar: Calendar = .runner) -> Date {
        let startOfDay = calendar.startOfDay(for: date)
        let weekday = calendar.component(.weekday, from: startOfDay)
        let daysSinceMonday = (weekday - calendar.firstWeekday + 7) % 7
        return calendar.date(byAdding: .day, value: -daysSinceMonday, to: startOfDay) ?? startOfDay
    }

    nonisolated static func datesInWeek(starting weekStart: Date, calendar: Calendar = .runner) -> [Date] {
        let monday = mondayStartingWeek(containing: weekStart, calendar: calendar)
        return (0..<7).compactMap { dayOffset in
            calendar.date(byAdding: .day, value: dayOffset, to: monday)
        }
    }
}

enum RunnerWeekRangeFormatter {
    nonisolated static func string(
        for weekStart: Date,
        calendar: Calendar = .runner,
        referenceDate: Date = .now
    ) -> String {
        let start = RunnerCalendar.mondayStartingWeek(containing: weekStart, calendar: calendar)
        let end = calendar.date(byAdding: .day, value: 6, to: start) ?? start
        let startYear = calendar.component(.year, from: start)
        let endYear = calendar.component(.year, from: end)
        let referenceYear = calendar.component(.year, from: referenceDate)
        let isSameMonth = startYear == endYear
            && calendar.component(.month, from: start) == calendar.component(.month, from: end)

        if startYear != endYear {
            return "\(format(start, as: "MMM d, yyyy", calendar: calendar))–\(format(end, as: "MMM d, yyyy", calendar: calendar))"
        }

        let range = isSameMonth
            ? "\(format(start, as: "MMM d", calendar: calendar))–\(format(end, as: "d", calendar: calendar))"
            : "\(format(start, as: "MMM d", calendar: calendar))–\(format(end, as: "MMM d", calendar: calendar))"

        return startYear == referenceYear ? range : "\(range), \(startYear)"
    }

    private nonisolated static func format(_ date: Date, as pattern: String, calendar: Calendar) -> String {
        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.timeZone = calendar.timeZone
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = pattern
        return formatter.string(from: date)
    }
}

enum RunnerWeekAxisFormatter {
    nonisolated static func string(for weekStart: Date, calendar: Calendar = .runner) -> String {
        let monday = RunnerCalendar.mondayStartingWeek(containing: weekStart, calendar: calendar)
        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.timeZone = calendar.timeZone
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "M/d"
        return formatter.string(from: monday)
    }
}
