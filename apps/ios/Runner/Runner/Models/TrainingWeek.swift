import Foundation

struct WeekSummary: Hashable, Sendable {
    let weekStart: Date
    let workouts: [Workout]

    var actualMileage: Double {
        workouts.reduce(0) { total, workout in
            total + (workout.distanceMiles ?? 0)
        }
    }

    func workouts(on date: Date, calendar: Calendar = .runner) -> [Workout] {
        workouts.filter { calendar.isDate($0.date, inSameDayAs: date) }
    }

    func actualMileage(on date: Date, calendar: Calendar = .runner) -> Double {
        workouts(on: date, calendar: calendar).reduce(0) { total, workout in
            total + (workout.distanceMiles ?? 0)
        }
    }
}

struct MileageTrendPoint: Identifiable, Hashable, Sendable {
    let weekStart: Date
    let actualMileage: Double

    var id: Date { weekStart }
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
