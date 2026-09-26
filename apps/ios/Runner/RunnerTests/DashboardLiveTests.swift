import Foundation
import Testing
@testable import Runner

@MainActor
@Suite(.serialized)
struct DashboardLiveTests {
    @Test("Initial load fetches the production-style week and trend with loading transitions")
    func initialLoad() async throws {
        let fixture = try Fixture()
        let repository = FakeWorkoutRepository(week: fixture.initialWeek, trend: fixture.trend)
        let state = fixture.state(repository: repository)

        #expect(state.initialLoadState == .idle)
        await state.loadInitialData()

        #expect(state.initialLoadState == .loaded)
        #expect(state.displayedWeek.workouts == fixture.initialWeek.workouts)
        #expect(state.trend == fixture.trend)
        #expect(repository.loadedWeeks == [fixture.monday])
        #expect(repository.trendLoadCount == 1)
    }

    @Test("Week navigation fetches requested weeks and retains the selected weekday")
    func weekNavigation() async throws {
        let fixture = try Fixture()
        let previousMonday = try #require(fixture.calendar.date(byAdding: .day, value: -7, to: fixture.monday))
        let previousWorkout = Workout(id: "previous", date: previousMonday, kind: .run, title: "Previous", distanceMiles: 4)
        let repository = FakeWorkoutRepository(
            weeks: [
                fixture.monday: fixture.initialWeek,
                previousMonday: WeekSummary(weekStart: previousMonday, workouts: [previousWorkout]),
            ],
            trend: fixture.trend
        )
        let state = fixture.state(repository: repository)
        await state.loadInitialData()

        await state.loadPreviousWeek()
        #expect(state.displayedWeekStart == previousMonday)
        #expect(fixture.calendar.component(.weekday, from: state.selectedDate) == 5)
        #expect(state.displayedWeek.workouts == [previousWorkout])

        await state.loadNextWeek()
        #expect(state.displayedWeekStart == fixture.monday)
        #expect(repository.loadedWeeks.count == 3)
    }

    @Test("A failed week load retains last-known-good data and exposes a recoverable error")
    func failedWeekLoadRetainsData() async throws {
        let fixture = try Fixture()
        let repository = FakeWorkoutRepository(week: fixture.initialWeek, trend: fixture.trend)
        let state = fixture.state(repository: repository)
        await state.loadInitialData()
        repository.loadWeekError = FakeRepositoryError.failed

        await state.loadPreviousWeek()

        #expect(state.displayedWeekStart == fixture.monday)
        #expect(state.displayedWeek.workouts == fixture.initialWeek.workouts)
        #expect(state.errorMessage != nil)
        #expect(!state.isWeekLoading)
    }

    @Test("Create, update, and delete refresh backend-authoritative week, totals, and trend")
    func successfulMutationsRefresh() async throws {
        let fixture = try Fixture()
        let repository = FakeWorkoutRepository(week: fixture.initialWeek, trend: fixture.trend)
        let state = fixture.state(repository: repository)
        await state.loadInitialData()
        let input = WorkoutInput(
            date: fixture.monday,
            title: "Live run",
            distanceMiles: 5,
            durationSeconds: 2_400,
            startTime: nil
        )

        let created = try await state.createWorkout(input)
        #expect(state.displayedWeek.actualMileage == 8)
        #expect(state.displayedWeek.totalDurationSeconds == 4_200)
        #expect(state.displayedWeek.workoutCount == 2)

        _ = try await state.updateWorkout(
            id: created.id,
            with: WorkoutInput(
                date: fixture.monday,
                title: "Updated live run",
                distanceMiles: 6,
                durationSeconds: 3_000,
                startTime: nil
            )
        )
        #expect(state.displayedWeek.actualMileage == 9)
        #expect(state.displayedWeek.workouts.contains { $0.title == "Updated live run" })

        _ = try await state.deleteWorkout(id: created.id)
        #expect(state.displayedWeek.actualMileage == 3)
        #expect(state.displayedWeek.workoutCount == 1)
        #expect(repository.trendLoadCount == 4)
        #expect(repository.loadedWeeks.count == 4)
    }

    @Test("Mutation failures retain server data and surface errors")
    func failedMutationsRetainData() async throws {
        let fixture = try Fixture()
        let repository = FakeWorkoutRepository(week: fixture.initialWeek, trend: fixture.trend)
        let state = fixture.state(repository: repository)
        await state.loadInitialData()
        let original = state.displayedWeek.workouts
        let input = WorkoutInput(date: fixture.monday, title: "Failure", distanceMiles: 1, durationSeconds: nil, startTime: nil)

        repository.createError = FakeRepositoryError.failed
        await #expect(throws: FakeRepositoryError.failed) { try await state.createWorkout(input) }
        #expect(state.displayedWeek.workouts == original)

        repository.createError = nil
        repository.updateError = FakeRepositoryError.failed
        await #expect(throws: FakeRepositoryError.failed) {
            try await state.updateWorkout(id: try #require(original.first?.id), with: input)
        }
        #expect(state.displayedWeek.workouts == original)

        repository.updateError = nil
        repository.deleteError = FakeRepositoryError.failed
        await #expect(throws: FakeRepositoryError.failed) {
            try await state.deleteWorkout(id: try #require(original.first?.id))
        }
        #expect(state.displayedWeek.workouts == original)
        #expect(state.errorMessage != nil)
        #expect(!state.isMutating)
    }

    @Test("Authentication and transport failures are classified without discarding data")
    func errorClassification() async throws {
        let fixture = try Fixture()
        let repository = FakeWorkoutRepository(week: fixture.initialWeek, trend: fixture.trend)
        let state = fixture.state(repository: repository)
        await state.loadInitialData()

        repository.loadWeekError = ClerkAccessTokenError.sessionUnavailable
        await state.loadPreviousWeek()
        #expect(state.requiresAuthentication)
        #expect(state.errorMessage == "Your session is unavailable. Please sign in again.")

        repository.loadWeekError = APIClientError.httpStatus(code: 401, detail: "Unauthorized")
        await state.loadPreviousWeek()
        #expect(state.requiresAuthentication)
        #expect(state.errorMessage == "Your session expired. Please sign in again.")

        repository.loadWeekError = APIClientError.transport("offline")
        await state.loadPreviousWeek()
        #expect(!state.requiresAuthentication)
        #expect(state.errorMessage?.contains("connection") == true)
        #expect(state.displayedWeek.workouts == fixture.initialWeek.workouts)
    }
}

private enum FakeRepositoryError: Error, Equatable {
    case failed
}

@MainActor
private final class FakeWorkoutRepository: WorkoutRepository {
    private var weeks: [Date: WeekSummary]
    private var trend: [MileageTrendPoint]
    private let calendar: Calendar
    var loadedWeeks: [Date] = []
    var trendLoadCount = 0
    var loadWeekError: Error?
    var trendError: Error?
    var createError: Error?
    var updateError: Error?
    var deleteError: Error?

    init(week: WeekSummary, trend: [MileageTrendPoint], calendar: Calendar = Fixture.calendar) {
        self.weeks = [week.weekStart: week]
        self.trend = trend
        self.calendar = calendar
    }

    init(weeks: [Date: WeekSummary], trend: [MileageTrendPoint], calendar: Calendar = Fixture.calendar) {
        self.weeks = weeks
        self.trend = trend
        self.calendar = calendar
    }

    func loadWeek(containing date: Date) async throws -> WeekSummary {
        if let loadWeekError { throw loadWeekError }
        let monday = RunnerCalendar.mondayStartingWeek(containing: date, calendar: calendar)
        loadedWeeks.append(monday)
        return weeks[monday] ?? WeekSummary(weekStart: monday, workouts: [])
    }

    func loadMileageTrend(ending endDate: Date, weeks: Int) async throws -> [MileageTrendPoint] {
        if let trendError { throw trendError }
        trendLoadCount += 1
        return trend
    }

    func createWorkout(_ input: WorkoutInput) async throws -> Workout {
        if let createError { throw createError }
        let workout = Workout(id: "created", date: input.date, kind: .run, title: input.title, startTime: input.startTime, durationSeconds: input.durationSeconds, distanceMiles: input.distanceMiles)
        mutateWeek(containing: input.date) { $0.append(workout) }
        return workout
    }

    func updateWorkout(id: Workout.ID, with input: WorkoutInput) async throws -> Workout {
        if let updateError { throw updateError }
        var updated: Workout?
        mutateWeek(containing: input.date) { workouts in
            guard let index = workouts.firstIndex(where: { $0.id == id }) else { return }
            workouts[index] = workouts[index].updating(with: input)
            updated = workouts[index]
        }
        guard let updated else { throw WorkoutRepositoryError.workoutNotFound }
        return updated
    }

    func deleteWorkout(id: Workout.ID) async throws {
        if let deleteError { throw deleteError }
        for key in weeks.keys {
            guard let week = weeks[key] else { continue }
            weeks[key] = WeekSummary(
                weekStart: week.weekStart,
                workouts: week.workouts.filter { $0.id != id }
            )
        }
    }

    private func mutateWeek(containing date: Date, mutation: (inout [Workout]) -> Void) {
        let monday = RunnerCalendar.mondayStartingWeek(containing: date, calendar: calendar)
        var workouts = weeks[monday]?.workouts ?? []
        mutation(&workouts)
        weeks[monday] = WeekSummary(weekStart: monday, workouts: workouts)
    }
}

private struct Fixture {
    static var calendar: Calendar {
        var calendar = Calendar.runner
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        return calendar
    }

    let calendar = Self.calendar
    let monday: Date
    let thursday: Date
    let initialWeek: WeekSummary
    let trend: [MileageTrendPoint]

    init() throws {
        let calendar = Self.calendar
        let monday = try #require(calendar.date(from: DateComponents(year: 2026, month: 9, day: 21)))
        self.monday = monday
        thursday = try #require(calendar.date(from: DateComponents(year: 2026, month: 9, day: 24)))
        let workout = Workout(id: "existing", date: monday, kind: .run, title: "Existing", durationSeconds: 1_800, distanceMiles: 3)
        initialWeek = WeekSummary(weekStart: monday, workouts: [workout])
        trend = (0..<24).compactMap { offset in
            guard let date = calendar.date(byAdding: .weekOfYear, value: offset - 23, to: monday) else { return nil }
            return MileageTrendPoint(weekStart: date, actualMileage: Double(offset))
        }
    }

    @MainActor
    func state(repository: any WorkoutRepository) -> DashboardState {
        DashboardState(
            currentWeekStart: monday,
            workouts: [],
            trend: [],
            selectedDate: thursday,
            calendar: calendar,
            repository: repository
        )
    }
}
