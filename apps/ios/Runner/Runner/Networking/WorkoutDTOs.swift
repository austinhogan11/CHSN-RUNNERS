import Foundation

enum WorkoutTypeDTO: String, Codable, Sendable {
    case run, rest, strength, other
    case crossTraining = "cross_training"
}

enum WorkoutStatusDTO: String, Codable, Sendable {
    case planned, completed, skipped
}

struct WorkoutDTO: Codable, Sendable {
    let id: String
    let date: String
    let type: WorkoutTypeDTO
    let title: String?
    let description: String?
    let plannedDistance: Double?
    let startTime: String?
    let durationSeconds: Int?
    let distance: Double?
    let status: WorkoutStatusDTO

    enum CodingKeys: String, CodingKey {
        case id, date, type, title, description, distance, status
        case plannedDistance = "planned_distance"
        case startTime = "start_time"
        case durationSeconds = "duration_seconds"
    }
}

struct WeekSummaryDTO: Codable, Sendable {
    let weekStart: String
    let plannedDistance: Double
    let actualDistance: Double
    let workouts: [WorkoutDTO]

    enum CodingKeys: String, CodingKey {
        case workouts
        case weekStart = "week_start"
        case plannedDistance = "planned_distance"
        case actualDistance = "actual_distance"
    }
}

struct MileageTrendPointDTO: Codable, Equatable, Sendable {
    let weekStart: String
    let plannedDistance: Double
    let actualDistance: Double

    enum CodingKeys: String, CodingKey {
        case weekStart = "week_start"
        case plannedDistance = "planned_distance"
        case actualDistance = "actual_distance"
    }
}

struct WorkoutCreateDTO: Encodable, Sendable {
    let date: String
    let type: WorkoutTypeDTO
    let title: String?
    let startTime: String?
    let durationSeconds: Int?
    let distance: Double?

    enum CodingKeys: String, CodingKey {
        case date, type, title, distance
        case startTime = "start_time"
        case durationSeconds = "duration_seconds"
    }
}

struct WorkoutUpdateDTO: Encodable, Sendable {
    let title: String?
    let startTime: String?
    let durationSeconds: Int?
    let distance: Double?

    enum CodingKeys: String, CodingKey {
        case title, distance
        case startTime = "start_time"
        case durationSeconds = "duration_seconds"
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(title, forKey: .title)
        try container.encode(startTime, forKey: .startTime)
        try container.encode(durationSeconds, forKey: .durationSeconds)
        try container.encode(distance, forKey: .distance)
    }
}

struct StatusResponseDTO: Codable, Sendable { let status: String }
struct VersionResponseDTO: Codable, Sendable {
    let version: String
    let environment: String
}

enum WorkoutDTOMapper {
    static func workout(from dto: WorkoutDTO, calendar: Calendar = .runner) throws -> Workout {
        let date = try APIValueFormatter.date(from: dto.date, calendar: calendar)
        let startTime = try dto.startTime.map {
            try APIValueFormatter.dateTime(on: date, from: $0, calendar: calendar)
        }
        return Workout(
            id: dto.id,
            date: date,
            kind: kind(from: dto.type),
            title: dto.title ?? "Workout",
            description: dto.description,
            plannedDistanceMiles: dto.plannedDistance,
            startTime: startTime,
            durationSeconds: dto.durationSeconds,
            distanceMiles: dto.distance
        )
    }

    static func weekSummary(from dto: WeekSummaryDTO, calendar: Calendar = .runner) throws -> WeekSummary {
        WeekSummary(
            weekStart: try APIValueFormatter.date(from: dto.weekStart, calendar: calendar),
            workouts: try dto.workouts.map { try workout(from: $0, calendar: calendar) },
            plannedMileage: dto.plannedDistance,
            actualMileage: dto.actualDistance
        )
    }

    static func trendPoint(from dto: MileageTrendPointDTO, calendar: Calendar = .runner) throws -> MileageTrendPoint {
        MileageTrendPoint(
            weekStart: try APIValueFormatter.date(from: dto.weekStart, calendar: calendar),
            actualMileage: dto.actualDistance,
            plannedMileage: dto.plannedDistance
        )
    }

    private static func kind(from type: WorkoutTypeDTO) -> Workout.Kind {
        switch type {
        case .run: .run
        case .rest: .rest
        case .strength: .strength
        case .crossTraining: .crossTraining
        case .other: .other
        }
    }
}

enum APIValueFormatter {
    static func date(from value: String, calendar: Calendar = .runner) throws -> Date {
        let parts = value.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3,
              let date = calendar.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2]))
        else { throw APIClientError.decoding }
        return date
    }

    static func dateString(from date: Date, calendar: Calendar = .runner) -> String {
        let components = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", components.year ?? 0, components.month ?? 0, components.day ?? 0)
    }

    static func timeString(from date: Date, calendar: Calendar = .runner) -> String {
        let components = calendar.dateComponents([.hour, .minute, .second], from: date)
        return String(format: "%02d:%02d:%02d", components.hour ?? 0, components.minute ?? 0, components.second ?? 0)
    }

    static func dateTime(on date: Date, from value: String, calendar: Calendar = .runner) throws -> Date {
        let parts = value.split(separator: ":")
        guard parts.count >= 2,
              let hour = Int(parts[0]),
              let minute = Int(parts[1]),
              let second = parts.count > 2 ? Int(parts[2].split(separator: ".")[0]) : 0,
              let result = calendar.date(bySettingHour: hour, minute: minute, second: second, of: date)
        else { throw APIClientError.decoding }
        return result
    }
}
