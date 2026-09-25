//
//  RunnerTests.swift
//  RunnerTests
//
//  Created by Austin on 9/25/26.
//

import Foundation
import Testing
@testable import Runner

struct RunnerTests {
    @Test("Week generation runs Monday through Sunday")
    func weekDateGeneration() throws {
        let calendar = testCalendar
        let thursday = try #require(calendar.date(from: DateComponents(year: 2026, month: 9, day: 24)))
        let dates = RunnerCalendar.datesInWeek(starting: thursday, calendar: calendar)

        #expect(dates.count == 7)
        #expect(calendar.component(.weekday, from: dates[0]) == 2)
        #expect(calendar.component(.day, from: dates[0]) == 21)
        #expect(calendar.component(.weekday, from: dates[6]) == 1)
        #expect(calendar.component(.day, from: dates[6]) == 27)
    }

    @Test("Weekly mileage aggregates only actual workout distance")
    func weeklyMileageAggregation() throws {
        let date = try sampleDate(day: 21)
        let summary = WeekSummary(
            weekStart: date,
            workouts: [
                Workout(date: date, kind: .run, title: "Run one", durationSeconds: 1_800, distanceMiles: 3.2),
                Workout(date: date, kind: .strength, title: "Strength", durationSeconds: 2_400),
                Workout(date: date, kind: .run, title: "Run two", durationSeconds: 2_700, distanceMiles: 5.3),
            ]
        )

        #expect(summary.actualMileage == 8.5)
    }

    @Test("Selected-day filtering returns every workout on that day")
    func selectedDayWorkoutFiltering() throws {
        let monday = try sampleDate(day: 21)
        let tuesday = try sampleDate(day: 22)
        let summary = WeekSummary(
            weekStart: monday,
            workouts: [
                Workout(date: monday, kind: .run, title: "Monday run", distanceMiles: 4),
                Workout(date: tuesday, kind: .run, title: "Tuesday run", distanceMiles: 3),
                Workout(date: tuesday, kind: .strength, title: "Tuesday strength"),
            ]
        )

        let workouts = summary.workouts(on: tuesday, calendar: testCalendar)

        #expect(workouts.count == 2)
        #expect(workouts.map(\.title) == ["Tuesday run", "Tuesday strength"])
    }

    @Test("Pace is derived from actual duration and distance")
    func paceDerivation() throws {
        let date = try sampleDate(day: 21)
        let workout = Workout(
            date: date,
            kind: .run,
            title: "Six miles",
            durationSeconds: 3_600,
            distanceMiles: 6
        )
        let zeroDistance = Workout(
            date: date,
            kind: .run,
            title: "Invalid distance",
            durationSeconds: 1_800,
            distanceMiles: 0
        )

        #expect(workout.paceSecondsPerMile == 600)
        #expect(zeroDistance.paceSecondsPerMile == nil)
    }

    @MainActor
    @Test("Mock trend data is ordered from oldest to newest")
    func trendMockDataOrdering() throws {
        let referenceDate = try sampleDate(day: 25)
        let state = DashboardState.mock(referenceDate: referenceDate, calendar: testCalendar)

        #expect(state.trend.count == 8)
        #expect(zip(state.trend, state.trend.dropFirst()).allSatisfy { earlier, later in
            earlier.weekStart < later.weekStart
        })
    }

    @MainActor
    @Test("Week navigation moves by seven days and preserves the selected weekday")
    func previousAndNextWeekNavigation() throws {
        let monday = try sampleDate(day: 21)
        let thursday = try sampleDate(day: 24)
        let priorMonday = try sampleDate(day: 14)
        let priorThursday = try sampleDate(day: 17)
        let state = makeState(weekStart: monday, selectedDate: thursday)

        state.showPreviousWeek()

        #expect(state.displayedWeekStart == priorMonday)
        #expect(state.selectedDate == priorThursday)

        state.showNextWeek()

        #expect(state.displayedWeekStart == monday)
        #expect(state.selectedDate == thursday)
    }

    @MainActor
    @Test("Current-week return restores the current week and selected weekday")
    func currentWeekReturn() throws {
        let monday = try sampleDate(day: 21)
        let friday = try sampleDate(day: 25)
        let state = makeState(weekStart: monday, selectedDate: friday)

        state.showPreviousWeek()
        #expect(!state.isViewingCurrentWeek)

        state.showCurrentWeek()

        #expect(state.isViewingCurrentWeek)
        #expect(state.displayedWeekStart == monday)
        #expect(state.selectedDate == friday)
    }

    @MainActor
    @Test("Creating a workout adds it to the selected day in memory")
    func workoutCreation() throws {
        let monday = try sampleDate(day: 21)
        let startTime = try #require(testCalendar.date(bySettingHour: 6, minute: 45, second: 0, of: monday))
        let state = makeState(weekStart: monday, selectedDate: monday)

        let created = state.createWorkout(
            WorkoutInput(
                date: monday,
                title: "  Easy run  ",
                distanceMiles: 4.2,
                durationSeconds: 2_100,
                startTime: startTime
            )
        )

        #expect(state.selectedDayWorkouts == [created])
        #expect(created.title == "Easy run")
        #expect(created.startTime == startTime)
    }

    @MainActor
    @Test("Editing a workout preserves identity and date while updating editable values")
    func workoutEditing() throws {
        let monday = try sampleDate(day: 21)
        let workout = Workout(
            date: monday,
            kind: .run,
            title: "Before",
            durationSeconds: 1_800,
            distanceMiles: 3
        )
        let state = makeState(weekStart: monday, selectedDate: monday, workouts: [workout])
        let newStartTime = try #require(testCalendar.date(bySettingHour: 7, minute: 15, second: 0, of: monday))

        let updated = state.updateWorkout(
            id: workout.id,
            with: WorkoutInput(
                date: try sampleDate(day: 22),
                title: "After",
                distanceMiles: 5,
                durationSeconds: 2_400,
                startTime: newStartTime
            )
        )

        let result = try #require(state.workouts.first)
        #expect(updated)
        #expect(result.id == workout.id)
        #expect(result.date == monday)
        #expect(result.title == "After")
        #expect(result.distanceMiles == 5)
        #expect(result.durationSeconds == 2_400)
        #expect(result.startTime == newStartTime)
        #expect(result.paceSecondsPerMile == 480)
    }

    @MainActor
    @Test("Deleting a workout removes it immediately")
    func workoutDeletion() throws {
        let monday = try sampleDate(day: 21)
        let workout = Workout(date: monday, kind: .run, title: "Delete me", distanceMiles: 3)
        let state = makeState(weekStart: monday, selectedDate: monday, workouts: [workout])

        let deleted = state.deleteWorkout(id: workout.id)

        #expect(deleted)
        #expect(state.workouts.isEmpty)
        #expect(state.selectedDayWorkouts.isEmpty)
    }

    @MainActor
    @Test("Weekly mileage and trend recalculate after local mutations")
    func weeklyMileageRecalculation() throws {
        let monday = try sampleDate(day: 21)
        let initial = Workout(
            date: monday,
            kind: .run,
            title: "Initial",
            durationSeconds: 1_800,
            distanceMiles: 3
        )
        let state = makeState(weekStart: monday, selectedDate: monday, workouts: [initial])
        #expect(state.displayedWeek.actualMileage == 3)

        let added = state.createWorkout(
            WorkoutInput(
                date: try sampleDate(day: 22),
                title: "Added",
                distanceMiles: 5,
                durationSeconds: 2_500,
                startTime: nil
            )
        )
        #expect(state.displayedWeek.actualMileage == 8)

        _ = state.updateWorkout(
            id: initial.id,
            with: WorkoutInput(
                date: monday,
                title: "Initial edited",
                distanceMiles: 4,
                durationSeconds: 2_000,
                startTime: nil
            )
        )
        #expect(state.displayedWeek.actualMileage == 9)

        _ = state.deleteWorkout(id: added.id)

        #expect(state.displayedWeek.actualMileage == 4)
        #expect(state.trend.first(where: { $0.weekStart == monday })?.actualMileage == 4)
    }

    private var testCalendar: Calendar {
        var calendar = Calendar.runner
        if let timeZone = TimeZone(secondsFromGMT: 0) {
            calendar.timeZone = timeZone
        }
        return calendar
    }

    private func sampleDate(day: Int) throws -> Date {
        try #require(testCalendar.date(from: DateComponents(year: 2026, month: 9, day: day)))
    }

    @MainActor
    private func makeState(
        weekStart: Date,
        selectedDate: Date,
        workouts: [Workout] = []
    ) -> DashboardState {
        DashboardState(
            currentWeekStart: weekStart,
            workouts: workouts,
            trend: [MileageTrendPoint(weekStart: weekStart, actualMileage: 999)],
            selectedDate: selectedDate,
            calendar: testCalendar
        )
    }
}
