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
}
