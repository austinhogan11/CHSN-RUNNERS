import Foundation
import Observation

@MainActor
@Observable
final class DashboardState {
    let currentWeekStart: Date
    private(set) var displayedWeekStart: Date
    private(set) var workouts: [Workout]
    private let baselineTrend: [MileageTrendPoint]
    private let calendar: Calendar
    private var locallyChangedWeeks: Set<Date>
    var selectedDate: Date

    init(
        currentWeekStart: Date,
        displayedWeekStart: Date? = nil,
        workouts: [Workout],
        trend: [MileageTrendPoint],
        selectedDate: Date,
        calendar: Calendar = .runner
    ) {
        let normalizedCurrentWeek = RunnerCalendar.mondayStartingWeek(
            containing: currentWeekStart,
            calendar: calendar
        )
        let normalizedDisplayedWeek = RunnerCalendar.mondayStartingWeek(
            containing: displayedWeekStart ?? currentWeekStart,
            calendar: calendar
        )

        self.currentWeekStart = normalizedCurrentWeek
        self.displayedWeekStart = normalizedDisplayedWeek
        self.workouts = workouts
        self.baselineTrend = trend.sorted { $0.weekStart < $1.weekStart }
        self.selectedDate = selectedDate
        self.calendar = calendar
        self.locallyChangedWeeks = [normalizedCurrentWeek]
    }

    var weekDates: [Date] {
        RunnerCalendar.datesInWeek(starting: displayedWeekStart, calendar: calendar)
    }

    var displayedWeek: WeekSummary {
        WeekSummary(
            weekStart: displayedWeekStart,
            workouts: workouts.filter { workout in
                RunnerCalendar.mondayStartingWeek(containing: workout.date, calendar: calendar) == displayedWeekStart
            }
        )
    }

    var selectedDayWorkouts: [Workout] {
        displayedWeek.workouts(on: selectedDate, calendar: calendar)
    }

    var isViewingCurrentWeek: Bool {
        displayedWeekStart == currentWeekStart
    }

    var trend: [MileageTrendPoint] {
        var pointsByWeek = Dictionary(uniqueKeysWithValues: baselineTrend.map { ($0.weekStart, $0) })
        for weekStart in locallyChangedWeeks {
            pointsByWeek[weekStart] = MileageTrendPoint(
                weekStart: weekStart,
                actualMileage: actualMileage(forWeekStarting: weekStart)
            )
        }
        return pointsByWeek.values.sorted { $0.weekStart < $1.weekStart }
    }

    func showPreviousWeek() {
        moveWeek(by: -1)
    }

    func showNextWeek() {
        moveWeek(by: 1)
    }

    func showCurrentWeek() {
        move(to: currentWeekStart)
    }

    @discardableResult
    func createWorkout(_ input: WorkoutInput) -> Workout {
        let workout = Workout(
            date: input.date,
            kind: .run,
            title: input.title,
            startTime: input.startTime,
            durationSeconds: input.durationSeconds,
            distanceMiles: input.distanceMiles
        )
        workouts.append(workout)
        markWeekChanged(containing: workout.date)
        return workout
    }

    @discardableResult
    func updateWorkout(id: Workout.ID, with input: WorkoutInput) -> Bool {
        guard let index = workouts.firstIndex(where: { $0.id == id }) else { return false }
        let originalDate = workouts[index].date
        workouts[index] = workouts[index].updating(with: input)
        markWeekChanged(containing: originalDate)
        return true
    }

    @discardableResult
    func deleteWorkout(id: Workout.ID) -> Bool {
        guard let index = workouts.firstIndex(where: { $0.id == id }) else { return false }
        let removed = workouts.remove(at: index)
        markWeekChanged(containing: removed.date)
        return true
    }

    private func moveWeek(by weekOffset: Int) {
        guard let target = calendar.date(
            byAdding: .weekOfYear,
            value: weekOffset,
            to: displayedWeekStart
        ) else {
            return
        }
        move(to: target)
    }

    private func move(to weekStart: Date) {
        let selectedWeekdayOffset = calendar.dateComponents(
            [.day],
            from: displayedWeekStart,
            to: calendar.startOfDay(for: selectedDate)
        ).day ?? 0
        displayedWeekStart = RunnerCalendar.mondayStartingWeek(containing: weekStart, calendar: calendar)
        selectedDate = calendar.date(
            byAdding: .day,
            value: min(max(selectedWeekdayOffset, 0), 6),
            to: displayedWeekStart
        ) ?? displayedWeekStart
    }

    private func actualMileage(forWeekStarting weekStart: Date) -> Double {
        workouts.reduce(0) { total, workout in
            let workoutWeek = RunnerCalendar.mondayStartingWeek(containing: workout.date, calendar: calendar)
            guard workoutWeek == weekStart, workout.hasActualExecution else { return total }
            return total + (workout.distanceMiles ?? 0)
        }
    }

    private func markWeekChanged(containing date: Date) {
        locallyChangedWeeks.insert(
            RunnerCalendar.mondayStartingWeek(containing: date, calendar: calendar)
        )
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
        let currentWeek = WeekSummary(weekStart: weekStart, workouts: workouts)
        let trend = historicalTrend + [
            MileageTrendPoint(weekStart: weekStart, actualMileage: currentWeek.actualMileage)
        ]
        let selectedDate = RunnerCalendar.datesInWeek(starting: weekStart, calendar: calendar)
            .first(where: { calendar.isDate($0, inSameDayAs: referenceDate) }) ?? weekStart

        return DashboardState(
            currentWeekStart: weekStart,
            workouts: workouts,
            trend: trend,
            selectedDate: selectedDate,
            calendar: calendar
        )
    }
}
