import Foundation

@MainActor
protocol WorkoutRepository {
    func loadWeek(containing date: Date) async throws -> WeekSummary
    func loadMileageTrend(ending endDate: Date, weeks: Int) async throws -> [MileageTrendPoint]
    func createWorkout(_ input: WorkoutInput) async throws -> Workout
    func updateWorkout(id: Workout.ID, with input: WorkoutInput) async throws -> Workout
    func deleteWorkout(id: Workout.ID) async throws
}

enum WorkoutRepositoryError: Error, Equatable {
    case workoutNotFound
}

@MainActor
final class InMemoryWorkoutRepository: WorkoutRepository {
    private var workouts: [Workout]
    private let baselineTrend: [MileageTrendPoint]
    private let calendar: Calendar

    init(workouts: [Workout], trend: [MileageTrendPoint], calendar: Calendar = .runner) {
        self.workouts = workouts
        self.baselineTrend = trend.sorted { $0.weekStart < $1.weekStart }
        self.calendar = calendar
    }

    func loadWeek(containing date: Date) -> WeekSummary {
        let weekStart = RunnerCalendar.mondayStartingWeek(containing: date, calendar: calendar)
        return WeekSummary(
            weekStart: weekStart,
            workouts: workouts.filter {
                RunnerCalendar.mondayStartingWeek(containing: $0.date, calendar: calendar) == weekStart
            }
        )
    }

    func loadMileageTrend(ending endDate: Date, weeks: Int) -> [MileageTrendPoint] {
        let endWeek = RunnerCalendar.mondayStartingWeek(containing: endDate, calendar: calendar)
        let baseline = Dictionary(uniqueKeysWithValues: baselineTrend.map { ($0.weekStart, $0) })
        return (0..<max(weeks, 0)).compactMap { offset in
            guard let weekStart = calendar.date(
                byAdding: .weekOfYear,
                value: offset - weeks + 1,
                to: endWeek
            ) else { return nil }
            let matching = workouts.filter {
                RunnerCalendar.mondayStartingWeek(containing: $0.date, calendar: calendar) == weekStart
            }
            guard !matching.isEmpty else {
                return baseline[weekStart] ?? MileageTrendPoint(weekStart: weekStart, actualMileage: 0)
            }
            return MileageTrendPoint(
                weekStart: weekStart,
                actualMileage: WeekSummary(weekStart: weekStart, workouts: matching).actualMileage
            )
        }
    }

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
        return workout
    }

    func updateWorkout(id: Workout.ID, with input: WorkoutInput) throws -> Workout {
        guard let index = workouts.firstIndex(where: { $0.id == id }) else {
            throw WorkoutRepositoryError.workoutNotFound
        }
        let updated = workouts[index].updating(with: input)
        workouts[index] = updated
        return updated
    }

    func deleteWorkout(id: Workout.ID) throws {
        guard let index = workouts.firstIndex(where: { $0.id == id }) else {
            throw WorkoutRepositoryError.workoutNotFound
        }
        workouts.remove(at: index)
    }
}

@MainActor
struct APIWorkoutRepository: WorkoutRepository {
    let client: APIClient
    let calendar: Calendar

    init(client: APIClient, calendar: Calendar = .runner) {
        self.client = client
        self.calendar = calendar
    }

    func loadWeek(containing date: Date) async throws -> WeekSummary {
        let day = APIValueFormatter.dateString(from: date, calendar: calendar)
        let dto: WeekSummaryDTO = try await client.get("weeks/\(day)")
        return try WorkoutDTOMapper.weekSummary(from: dto, calendar: calendar)
    }

    func loadMileageTrend(ending endDate: Date, weeks: Int) async throws -> [MileageTrendPoint] {
        let dtos: [MileageTrendPointDTO] = try await client.get(
            "trends/mileage",
            queryItems: [
                URLQueryItem(name: "end", value: APIValueFormatter.dateString(from: endDate, calendar: calendar)),
                URLQueryItem(name: "weeks", value: String(weeks)),
            ]
        )
        return try dtos.map { try WorkoutDTOMapper.trendPoint(from: $0, calendar: calendar) }
    }

    func createWorkout(_ input: WorkoutInput) async throws -> Workout {
        let dto: WorkoutDTO = try await client.post(
            "workouts",
            body: WorkoutCreateDTO(
                date: APIValueFormatter.dateString(from: input.date, calendar: calendar),
                type: .run,
                title: input.title,
                startTime: input.startTime.map { APIValueFormatter.timeString(from: $0, calendar: calendar) },
                durationSeconds: input.durationSeconds,
                distance: input.distanceMiles
            )
        )
        return try WorkoutDTOMapper.workout(from: dto, calendar: calendar)
    }

    func updateWorkout(id: Workout.ID, with input: WorkoutInput) async throws -> Workout {
        let dto: WorkoutDTO = try await client.patch(
            "workouts/\(id)",
            body: WorkoutUpdateDTO(
                title: input.title,
                startTime: input.startTime.map { APIValueFormatter.timeString(from: $0, calendar: calendar) },
                durationSeconds: input.durationSeconds,
                distance: input.distanceMiles
            )
        )
        return try WorkoutDTOMapper.workout(from: dto, calendar: calendar)
    }

    func deleteWorkout(id: Workout.ID) async throws {
        try await client.delete("workouts/\(id)")
    }

    func health() async throws -> StatusResponseDTO { try await client.get("health") }
    func readiness() async throws -> StatusResponseDTO { try await client.get("ready") }
    func version() async throws -> VersionResponseDTO { try await client.get("version") }
}
