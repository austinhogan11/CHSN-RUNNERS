import Foundation
import Observation

@MainActor
@Observable
final class DashboardState {
    let week: WeekSummary
    let trend: [MileageTrendPoint]
    let weekDates: [Date]
    var selectedDate: Date

    init(
        week: WeekSummary,
        trend: [MileageTrendPoint],
        selectedDate: Date,
        calendar: Calendar = .runner
    ) {
        self.week = week
        self.trend = trend.sorted { $0.weekStart < $1.weekStart }
        self.weekDates = RunnerCalendar.datesInWeek(starting: week.weekStart, calendar: calendar)
        self.selectedDate = selectedDate
    }

    var selectedDayWorkouts: [Workout] {
        week.workouts(on: selectedDate)
    }

    static func mock(referenceDate: Date = .now, calendar: Calendar = .runner) -> DashboardState {
        let weekStart = RunnerCalendar.mondayStartingWeek(containing: referenceDate, calendar: calendar)

        func date(dayOffset: Int, hour: Int? = nil, minute: Int = 0) -> Date {
            let day = calendar.date(byAdding: .day, value: dayOffset, to: weekStart) ?? weekStart
            guard let hour else { return day }
            return calendar.date(bySettingHour: hour, minute: minute, second: 0, of: day) ?? day
        }

        let workouts = [
            Workout(date: date(dayOffset: 0), kind: .run, title: "Easy miles", startTime: date(dayOffset: 0, hour: 6, minute: 30), durationSeconds: 2_760, distanceMiles: 5.2),
            Workout(date: date(dayOffset: 1), kind: .run, title: "Morning recovery", startTime: date(dayOffset: 1, hour: 7), durationSeconds: 1_920, distanceMiles: 3.4),
            Workout(date: date(dayOffset: 1), kind: .strength, title: "Lower-body strength", startTime: date(dayOffset: 1, hour: 17, minute: 30), durationSeconds: 2_100),
            Workout(date: date(dayOffset: 3), kind: .run, title: "Steady aerobic", startTime: date(dayOffset: 3, hour: 6, minute: 15), durationSeconds: 3_330, distanceMiles: 6.5),
            Workout(date: date(dayOffset: 4), kind: .run, title: "Tempo intervals", startTime: date(dayOffset: 4, hour: 6), durationSeconds: 3_480, distanceMiles: 7.1),
            Workout(date: date(dayOffset: 5), kind: .run, title: "Long run", startTime: date(dayOffset: 5, hour: 7, minute: 15), durationSeconds: 5_820, distanceMiles: 10.8),
        ]

        let historicalMileage = [22.4, 25.0, 23.8, 28.6, 31.2, 27.5, 30.1]
        let historicalTrend: [MileageTrendPoint] = historicalMileage.enumerated().compactMap { index, mileage in
            guard let start = calendar.date(
                byAdding: .weekOfYear,
                value: index - historicalMileage.count,
                to: weekStart
            ) else {
                return nil
            }
            return MileageTrendPoint(weekStart: start, actualMileage: mileage)
        }
        let week = WeekSummary(weekStart: weekStart, workouts: workouts)
        let trend = historicalTrend + [
            MileageTrendPoint(weekStart: weekStart, actualMileage: week.actualMileage)
        ]

        let selectedDate = RunnerCalendar.datesInWeek(starting: weekStart, calendar: calendar)
            .first(where: { calendar.isDate($0, inSameDayAs: referenceDate) }) ?? weekStart

        return DashboardState(
            week: week,
            trend: trend,
            selectedDate: selectedDate,
            calendar: calendar
        )
    }
}
