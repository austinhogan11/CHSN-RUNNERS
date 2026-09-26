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
                Workout(date: date, kind: .strength, title: "Strength", durationSeconds: 2_400, distanceMiles: 10),
                Workout(date: date, kind: .run, title: "Run two", durationSeconds: 2_700, distanceMiles: 5.3),
            ]
        )

        #expect(summary.actualMileage == 8.5)
        #expect(summary.totalDurationSeconds == 6_900)
        #expect(summary.workoutCount == 3)
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
        #expect(WorkoutDistance.parse("5") == 5)
        #expect(WorkoutDistance.parse("5.2") == 5.2)
        #expect(WorkoutDistance.parse("5.25") == 5.25)
        #expect(WorkoutDistance.parse("") == nil)
        #expect(WorkoutDistance.isValid(""))
        #expect(!WorkoutDistance.isValid("-2"))
        #expect(WorkoutDuration.parse(minutes: "58", seconds: "00") == 3_480)
        #expect(WorkoutDuration.parse(minutes: "75", seconds: "30") == 4_530)
        #expect(!WorkoutDuration.fieldsAreValid(minutes: "58", seconds: "60"))
    }

    @MainActor
    @Test("Mock trend data is ordered from oldest to newest")
    func trendMockDataOrdering() throws {
        let referenceDate = try sampleDate(day: 25)
        let state = DashboardState.mock(referenceDate: referenceDate, calendar: testCalendar)

        #expect(state.trend.count == 36)
        #expect(zip(state.trend, state.trend.dropFirst()).allSatisfy { earlier, later in
            earlier.weekStart < later.weekStart
        })
        #expect(state.selectedTrendWeekStart == state.currentWeekStart)
        #expect(state.selectedTrendPoint?.weekStart == state.currentWeekStart)
    }

    @MainActor
    @Test("Week navigation moves by seven days and preserves the selected weekday")
    func previousAndNextWeekNavigation() throws {
        let monday = try sampleDate(day: 21)
        let thursday = try sampleDate(day: 24)
        let priorMonday = try sampleDate(day: 14)
        let priorThursday = try sampleDate(day: 17)
        let priorMondayWorkout = Workout(
            date: priorMonday,
            kind: .run,
            title: "Prior week",
            durationSeconds: 1_200,
            distanceMiles: 2
        )
        let currentWorkout = Workout(
            date: monday,
            kind: .run,
            title: "Current week",
            durationSeconds: 1_800,
            distanceMiles: 3
        )
        let state = makeState(
            weekStart: monday,
            selectedDate: thursday,
            workouts: [priorMondayWorkout, currentWorkout]
        )

        #expect(state.displayedWeek.actualMileage == 3)
        #expect(state.displayedWeek.totalDurationSeconds == 1_800)
        #expect(state.displayedWeek.workoutCount == 1)

        state.showPreviousWeek()

        #expect(state.displayedWeekStart == priorMonday)
        #expect(state.selectedDate == priorThursday)
        #expect(state.displayedWeek.actualMileage == 2)
        #expect(state.displayedWeek.totalDurationSeconds == 1_200)
        #expect(state.displayedWeek.workoutCount == 1)

        state.showNextWeek()

        #expect(state.displayedWeekStart == monday)
        #expect(state.selectedDate == thursday)
        #expect(state.displayedWeek.actualMileage == 3)
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

        let now = try #require(
            testCalendar.date(from: DateComponents(year: 2026, month: 9, day: 25, hour: 14, minute: 37))
        )
        let defaultStartTime = WorkoutEditorDefaults.startTime(
            for: nil,
            workoutDate: monday,
            now: now,
            calendar: testCalendar
        )
        #expect(testCalendar.component(.day, from: defaultStartTime) == 21)
        #expect(testCalendar.component(.hour, from: defaultStartTime) == 14)
        #expect(testCalendar.component(.minute, from: defaultStartTime) == 37)
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

        let durationComponents = WorkoutDuration.components(from: 4_530)
        #expect(durationComponents.minutes == 75)
        #expect(durationComponents.seconds == 30)
        #expect(
            WorkoutEditorDefaults.startTime(
                for: result,
                workoutDate: monday,
                now: try sampleDate(day: 25),
                calendar: testCalendar
            ) == newStartTime
        )
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
        #expect(state.displayedWeek.totalDurationSeconds == 4_300)
        #expect(state.displayedWeek.workoutCount == 2)

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
        #expect(state.displayedWeek.totalDurationSeconds == 4_500)
        #expect(state.displayedWeek.workoutCount == 2)

        _ = state.deleteWorkout(id: added.id)

        #expect(state.displayedWeek.actualMileage == 4)
        #expect(state.displayedWeek.totalDurationSeconds == 2_000)
        #expect(state.displayedWeek.workoutCount == 1)
        #expect(state.trend.first(where: { $0.weekStart == monday })?.actualMileage == 4)
    }

    @MainActor
    @Test("Initial trend window contains the latest weeks")
    func initialTrendWindowUsesLatestWeeks() throws {
        let points = try trendPoints(count: 24)
        let state = makeState(
            weekStart: try sampleDate(day: 21),
            selectedDate: try sampleDate(day: 21),
            trend: points
        )

        #expect(state.visibleTrend.count == DashboardState.trendWindowSize)
        #expect(state.visibleTrendAxisLabels.count == DashboardState.trendWindowSize)
        #expect(
            zip(state.visibleTrend, state.visibleTrendAxisLabels).allSatisfy { point, label in
                label == RunnerWeekAxisFormatter.string(for: point.weekStart, calendar: testCalendar)
            }
        )
        #expect(state.visibleTrend.first?.weekStart == points[12].weekStart)
        #expect(state.visibleTrend.last?.weekStart == points.last?.weekStart)
        #expect(!state.canBrowseNewerTrend)

        let increase = MileageComparison(current: 33, previous: 30)
        let decrease = MileageComparison(current: 27, previous: 30)
        let unchanged = MileageComparison(current: 30, previous: 30)
        let zeroBaseline = MileageComparison(current: 5, previous: 0)
        #expect(increase.percentageChange == 10)
        #expect(increase.direction == .increase)
        #expect(decrease.percentageChange == -10)
        #expect(decrease.direction == .decrease)
        #expect(unchanged.percentageChange == 0)
        #expect(unchanged.direction == .unchanged)
        #expect(zeroBaseline.percentageChange == nil)
        #expect(zeroBaseline.absoluteChange == 5)

        let averageSummary = MileageTrendSummary(
            currentWindow: Array(points[12..<24]),
            previousWindow: Array(points[0..<12])
        )
        #expect(averageSummary.currentAverage == 18.5)
        #expect(averageSummary.previousAverage == 6.5)
        #expect(averageSummary.averageComparison.percentageChange == (12 / 6.5) * 100)
    }

    @MainActor
    @Test("Browsing backward exposes an older trend window")
    func backwardTrendNavigation() throws {
        let points = try trendPoints(count: 36)
        let state = makeState(
            weekStart: try sampleDate(day: 21),
            selectedDate: try sampleDate(day: 21),
            trend: points
        )

        state.browseTrendBackward()

        #expect(state.visibleTrend.first == points[12])
        #expect(state.visibleTrend.last?.weekStart == points[23].weekStart)
        #expect(state.canBrowseNewerTrend)
        #expect(state.selectedTrendPoint?.weekStart == points[23].weekStart)
        #expect(state.trendSummary.currentAverage == 18.5)
        #expect(state.trendSummary.previousAverage == 6.5)

        state.selectTrendPoint(points[15])
        #expect(state.selectedTrendPoint?.weekStart == points[15].weekStart)
        #expect(state.selectedTrendComparison?.current == 16)
        #expect(state.selectedTrendComparison?.previous == 15)
    }

    @MainActor
    @Test("Browsing forward stops at the latest trend window")
    func forwardTrendNavigationStopsAtLatest() throws {
        let points = try trendPoints(count: 24)
        let state = makeState(
            weekStart: try sampleDate(day: 21),
            selectedDate: try sampleDate(day: 21),
            trend: points
        )

        state.browseTrendBackward()
        state.browseTrendForward()
        state.browseTrendForward()

        #expect(state.visibleTrend.first == points[12])
        #expect(state.visibleTrend.last?.weekStart == points.last?.weekStart)
        #expect(!state.canBrowseNewerTrend)
        #expect(state.selectedTrendWeekStart == state.currentWeekStart)
        #expect(state.isCurrentWeekSelectedInTrend)
    }

    @MainActor
    @Test("Selecting a trend point exposes its week and mileage")
    func selectedTrendPoint() throws {
        let points = try trendPoints(count: 3)
        let state = makeState(
            weekStart: try sampleDate(day: 21),
            selectedDate: try sampleDate(day: 21),
            trend: points
        )

        state.selectTrendPoint(points[1])

        #expect(state.selectedTrendPoint?.weekStart == points[1].weekStart)
        #expect(state.selectedTrendPoint?.actualMileage == points[1].actualMileage)
        #expect(state.selectedTrendComparison?.current == points[1].actualMileage)
        #expect(state.selectedTrendComparison?.previous == points[0].actualMileage)
        #expect(!state.isCurrentWeekSelectedInTrend)
    }

    @Test("Week ranges format Monday through Sunday in the same month")
    func mondayThroughSundayRangeFormatting() throws {
        let monday = try sampleDate(day: 21)

        #expect(
            RunnerWeekRangeFormatter.string(
                for: monday,
                calendar: testCalendar,
                referenceDate: monday
            ) == "Sep 21–27"
        )
        #expect(RunnerWeekAxisFormatter.string(for: monday, calendar: testCalendar) == "9/21")
    }

    @Test("Week ranges format cleanly across months")
    func crossMonthRangeFormatting() throws {
        let monday = try #require(
            testCalendar.date(from: DateComponents(year: 2026, month: 9, day: 28))
        )

        #expect(
            RunnerWeekRangeFormatter.string(
                for: monday,
                calendar: testCalendar,
                referenceDate: monday
            ) == "Sep 28–Oct 4"
        )
    }

    @MainActor
    @Test("A zero-mile trend week remains selectable")
    func zeroMileWeekSelection() throws {
        let points = try trendPoints(count: 3, zeroMileageIndex: 1)
        let state = makeState(
            weekStart: try sampleDate(day: 21),
            selectedDate: try sampleDate(day: 21),
            trend: points
        )

        state.selectTrendPoint(points[1])

        #expect(state.selectedTrendPoint == points[1])
        #expect(state.selectedTrendPoint?.actualMileage == 0)
    }

    @MainActor
    @Test("Trend axis scale derives from the visible mileage window")
    func trendAxisUsesVisibleMileage() throws {
        let points = try trendPoints(count: 14)
        let state = makeState(
            weekStart: try sampleDate(day: 21),
            selectedDate: try sampleDate(day: 21),
            trend: points
        )

        #expect(state.visibleTrend.map(\.actualMileage).max() == 13)
        #expect(state.visibleTrendAxisScale.lowerBound == 0)
        #expect(state.visibleTrendAxisScale.upperBound == 20)
        #expect(state.visibleTrendAxisScale.tickStride == 10)
    }

    @MainActor
    @Test("Selecting a trend point does not change axis bounds")
    func trendSelectionKeepsAxisBounds() throws {
        let points = try trendPoints(count: 14)
        let state = makeState(
            weekStart: try sampleDate(day: 21),
            selectedDate: try sampleDate(day: 21),
            trend: points
        )
        let scaleBeforeSelection = state.visibleTrendAxisScale
        let labelsBeforeSelection = state.visibleTrendAxisLabels
        let weekStartsBeforeSelection = state.visibleTrend.map(\.weekStart)

        state.selectTrendPoint(state.visibleTrend[3])

        #expect(state.visibleTrendAxisScale == scaleBeforeSelection)
        #expect(state.visibleTrendAxisLabels == labelsBeforeSelection)
        #expect(state.visibleTrend.map(\.weekStart) == weekStartsBeforeSelection)
    }

    @MainActor
    @Test("Zero-mile weeks use the same stable trend axis logic")
    func zeroMileTrendAxisScale() throws {
        let monday = try sampleDate(day: 21)
        let zeroPoint = MileageTrendPoint(weekStart: monday, actualMileage: 0)
        let state = makeState(
            weekStart: monday,
            selectedDate: monday,
            trend: [zeroPoint]
        )
        let scaleBeforeSelection = state.visibleTrendAxisScale

        state.selectTrendPoint(zeroPoint)

        #expect(scaleBeforeSelection == MileageAxisScale(points: [zeroPoint]))
        #expect(scaleBeforeSelection.upperBound == 10)
        #expect(state.visibleTrendAxisScale == scaleBeforeSelection)
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
        workouts: [Workout] = [],
        trend: [MileageTrendPoint]? = nil
    ) -> DashboardState {
        DashboardState(
            currentWeekStart: weekStart,
            workouts: workouts,
            trend: trend ?? [MileageTrendPoint(weekStart: weekStart, actualMileage: 999)],
            selectedDate: selectedDate,
            calendar: testCalendar
        )
    }

    private func trendPoints(count: Int, zeroMileageIndex: Int? = nil) throws -> [MileageTrendPoint] {
        let latest = try sampleDate(day: 21)
        return try (0..<count).map { index in
            let weekOffset = index - count + 1
            let weekStart = try #require(
                testCalendar.date(byAdding: .weekOfYear, value: weekOffset, to: latest)
            )
            return MileageTrendPoint(
                weekStart: weekStart,
                actualMileage: index == zeroMileageIndex ? 0 : Double(index + 1)
            )
        }
    }
}
