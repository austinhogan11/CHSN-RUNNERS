import Foundation
import Observation

enum DashboardOperationError: Error, Equatable {
    case operationInProgress
}

@MainActor
@Observable
final class DashboardState {
    static let trendWindowSize = 12
    static let productionTrendWeekCount = 52

    enum LoadState: Equatable {
        case idle
        case loading
        case loaded
        case failed
    }

    let currentWeekStart: Date
    private(set) var displayedWeekStart: Date
    private(set) var workouts: [Workout]
    private var baselineTrend: [MileageTrendPoint]
    private let calendar: Calendar
    private let repository: any WorkoutRepository
    private var locallyChangedWeeks: Set<Date>
    private var trendWindowEndIndex: Int?
    var selectedDate: Date
    private(set) var selectedTrendWeekStart: Date?
    private(set) var initialLoadState: LoadState = .idle
    private(set) var isWeekLoading = false
    private(set) var isTrendLoading = false
    private(set) var isMutating = false
    private(set) var errorMessage: String?
    private(set) var requiresAuthentication = false

    init(
        currentWeekStart: Date,
        displayedWeekStart: Date? = nil,
        workouts: [Workout],
        trend: [MileageTrendPoint],
        selectedDate: Date,
        calendar: Calendar = .runner,
        repository: (any WorkoutRepository)? = nil
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
        self.repository = repository ?? InMemoryWorkoutRepository(
            workouts: workouts,
            trend: trend,
            calendar: calendar
        )
        self.locallyChangedWeeks = [normalizedCurrentWeek]
        self.trendWindowEndIndex = nil
        self.selectedTrendWeekStart = normalizedCurrentWeek
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

    static func production(
        repository: any WorkoutRepository,
        referenceDate: Date = .now,
        calendar: Calendar = .runner
    ) -> DashboardState {
        let weekStart = RunnerCalendar.mondayStartingWeek(containing: referenceDate, calendar: calendar)
        return DashboardState(
            currentWeekStart: weekStart,
            workouts: [],
            trend: [],
            selectedDate: referenceDate,
            calendar: calendar,
            repository: repository
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

    var visibleTrend: [MileageTrendPoint] {
        let allPoints = trend
        let endIndex = min(trendWindowEndIndex ?? allPoints.count, allPoints.count)
        let startIndex = max(0, endIndex - Self.trendWindowSize)
        return Array(allPoints[startIndex..<endIndex])
    }

    var visibleTrendAxisScale: MileageAxisScale {
        MileageAxisScale(points: visibleTrend)
    }

    var visibleTrendAxisLabels: [String] {
        visibleTrend.map { RunnerWeekAxisFormatter.string(for: $0.weekStart, calendar: calendar) }
    }

    var trendSummary: MileageTrendSummary {
        let allPoints = trend
        let endIndex = min(trendWindowEndIndex ?? allPoints.count, allPoints.count)
        let startIndex = max(0, endIndex - Self.trendWindowSize)
        let previousStartIndex = max(0, startIndex - Self.trendWindowSize)
        let previousWindow = Array(allPoints[previousStartIndex..<startIndex])
        return MileageTrendSummary(currentWindow: visibleTrend, previousWindow: previousWindow)
    }

    var selectedTrendPoint: MileageTrendPoint? {
        guard let selectedTrendWeekStart else { return nil }
        return trend.first { $0.weekStart == selectedTrendWeekStart }
    }

    var selectedTrendComparison: MileageComparison? {
        guard let selectedTrendWeekStart,
              let selectedIndex = trend.firstIndex(where: { $0.weekStart == selectedTrendWeekStart }),
              selectedIndex > trend.startIndex
        else {
            return nil
        }
        return MileageComparison(
            current: trend[selectedIndex].actualMileage,
            previous: trend[trend.index(before: selectedIndex)].actualMileage
        )
    }

    var isCurrentWeekSelectedInTrend: Bool {
        selectedTrendWeekStart == currentWeekStart
    }

    var canBrowseOlderTrend: Bool {
        guard let firstVisible = visibleTrend.first, let oldest = trend.first else { return false }
        return firstVisible.weekStart > oldest.weekStart
    }

    var canBrowseNewerTrend: Bool {
        guard let lastVisible = visibleTrend.last, let latest = trend.last else { return false }
        return lastVisible.weekStart < latest.weekStart
    }

    func browseTrendBackward() {
        let allPoints = trend
        guard canBrowseOlderTrend else { return }
        let currentEnd = min(trendWindowEndIndex ?? allPoints.count, allPoints.count)
        let currentStart = max(0, currentEnd - Self.trendWindowSize)
        trendWindowEndIndex = max(Self.trendWindowSize, currentStart)
        selectNewestVisibleTrendPoint()
    }

    func browseTrendForward() {
        let allPoints = trend
        guard canBrowseNewerTrend else { return }
        let currentEnd = min(trendWindowEndIndex ?? allPoints.count, allPoints.count)
        let nextEnd = min(allPoints.count, currentEnd + Self.trendWindowSize)
        trendWindowEndIndex = nextEnd == allPoints.count ? nil : nextEnd
        selectNewestVisibleTrendPoint()
    }

    func selectTrendPoint(_ point: MileageTrendPoint?) {
        selectedTrendWeekStart = point?.weekStart
    }

    private func selectNewestVisibleTrendPoint() {
        selectedTrendWeekStart = visibleTrend.last?.weekStart
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

    func loadInitialData() async {
        guard initialLoadState != .loading else { return }
        initialLoadState = .loading
        errorMessage = nil
        requiresAuthentication = false

        do {
            let week = try await repository.loadWeek(containing: displayedWeekStart)
            apply(week)
            let points = try await repository.loadMileageTrend(
                ending: currentWeekStart,
                weeks: Self.productionTrendWeekCount
            )
            applyTrend(points)
            initialLoadState = .loaded
        } catch {
            initialLoadState = .failed
            record(error)
        }
    }

    func retryLoading() async {
        await loadInitialData()
    }

    func loadPreviousWeek() async {
        await loadWeek(offset: -1)
    }

    func loadNextWeek() async {
        await loadWeek(offset: 1)
    }

    func loadCurrentWeek() async {
        await loadWeek(starting: currentWeekStart)
    }

    private func loadWeek(offset: Int) async {
        guard let target = calendar.date(byAdding: .weekOfYear, value: offset, to: displayedWeekStart) else {
            return
        }
        await loadWeek(starting: target)
    }

    private func loadWeek(starting target: Date) async {
        guard !isWeekLoading else { return }
        isWeekLoading = true
        errorMessage = nil
        defer { isWeekLoading = false }

        do {
            let summary = try await repository.loadWeek(containing: target)
            let selectedWeekdayOffset = calendar.dateComponents(
                [.day],
                from: displayedWeekStart,
                to: calendar.startOfDay(for: selectedDate)
            ).day ?? 0
            apply(summary)
            selectedDate = calendar.date(
                byAdding: .day,
                value: min(max(selectedWeekdayOffset, 0), 6),
                to: displayedWeekStart
            ) ?? displayedWeekStart
        } catch {
            record(error)
        }
    }

    func refreshDisplayedWeek() async throws {
        let summary = try await repository.loadWeek(containing: displayedWeekStart)
        apply(summary)
    }

    func refreshTrend(ending endDate: Date, weeks: Int) async throws {
        applyTrend(try await repository.loadMileageTrend(ending: endDate, weeks: weeks))
    }

    @discardableResult
    func createWorkout(_ input: WorkoutInput) async throws -> Workout {
        try beginMutation()
        defer { isMutating = false }
        do {
            let workout = try await repository.createWorkout(input)
            await refreshAfterConfirmedMutation(affecting: input.date)
            return workout
        } catch {
            record(error)
            throw error
        }
    }

    @discardableResult
    func updateWorkout(id: Workout.ID, with input: WorkoutInput) async throws -> Bool {
        guard workouts.contains(where: { $0.id == id }) else { return false }
        try beginMutation()
        defer { isMutating = false }
        do {
            _ = try await repository.updateWorkout(id: id, with: input)
            await refreshAfterConfirmedMutation(affecting: input.date)
            return true
        } catch {
            record(error)
            throw error
        }
    }

    @discardableResult
    func deleteWorkout(id: Workout.ID) async throws -> Bool {
        guard let workout = workouts.first(where: { $0.id == id }) else { return false }
        try beginMutation()
        defer { isMutating = false }
        do {
            try await repository.deleteWorkout(id: id)
            await refreshAfterConfirmedMutation(affecting: workout.date)
            return true
        } catch {
            record(error)
            throw error
        }
    }

    func clearError() {
        errorMessage = nil
    }

    private func beginMutation() throws {
        guard !isMutating else { throw DashboardOperationError.operationInProgress }
        isMutating = true
        errorMessage = nil
    }

    private func refreshAfterConfirmedMutation(affecting date: Date) async {
        do {
            let affectedWeek = RunnerCalendar.mondayStartingWeek(containing: date, calendar: calendar)
            if affectedWeek == displayedWeekStart {
                apply(try await repository.loadWeek(containing: affectedWeek))
            }
            applyTrend(try await repository.loadMileageTrend(
                ending: currentWeekStart,
                weeks: Self.productionTrendWeekCount
            ))
        } catch {
            record(error)
        }
    }

    private func apply(_ summary: WeekSummary) {
        let normalizedWeek = RunnerCalendar.mondayStartingWeek(containing: summary.weekStart, calendar: calendar)
        workouts.removeAll {
            RunnerCalendar.mondayStartingWeek(containing: $0.date, calendar: calendar) == normalizedWeek
        }
        workouts.append(contentsOf: summary.workouts)
        displayedWeekStart = normalizedWeek
        locallyChangedWeeks.remove(normalizedWeek)
    }

    private func applyTrend(_ points: [MileageTrendPoint]) {
        baselineTrend = points.sorted { $0.weekStart < $1.weekStart }
        locallyChangedWeeks.removeAll()
        trendWindowEndIndex = nil
        selectNewestVisibleTrendPoint()
    }

    private func record(_ error: Error) {
        requiresAuthentication = false
        switch error {
        case ClerkAccessTokenError.sessionUnavailable:
            requiresAuthentication = true
            errorMessage = "Your session is unavailable. Please sign in again."
        case let APIClientError.httpStatus(code, _):
            if code == 401 {
                requiresAuthentication = true
                errorMessage = "Your session expired. Please sign in again."
            } else {
                errorMessage = "Runner could not load your data (HTTP \(code))."
            }
        case APIClientError.transport:
            errorMessage = "Runner could not reach the server. Check your connection and retry."
        case APIClientError.decoding, APIClientError.invalidResponse:
            errorMessage = "Runner received an unexpected response. Please retry."
        case APIClientError.encoding:
            errorMessage = "Runner could not prepare that request."
        default:
            errorMessage = "Runner could not complete that request. Please retry."
        }
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
            guard workoutWeek == weekStart,
                  workout.kind == .run,
                  workout.hasActualExecution
            else {
                return total
            }
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

        let historicalMileage = [
            14.8, 16.2, 18.0, 0, 19.4, 21.1, 17.8, 22.6,
            20.3, 23.7, 25.1, 21.9, 18.2, 20.4, 24.0, 22.1,
            24.8, 21.6, 26.3, 28.0, 25.7, 29.4, 31.0, 27.8,
            30.6, 32.2, 29.9, 34.1, 28.7, 33.5, 35.0, 31.8,
            36.2, 34.6, 30.1,
        ]
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
