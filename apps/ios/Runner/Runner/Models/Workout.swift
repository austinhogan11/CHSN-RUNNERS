import Foundation

struct Workout: Identifiable, Hashable, Sendable {
    enum Kind: String, Hashable, Sendable {
        case run
        case strength
        case crossTraining
        case other

        var label: String {
            switch self {
            case .run: "Run"
            case .strength: "Strength"
            case .crossTraining: "Cross training"
            case .other: "Other"
            }
        }
    }

    let id: UUID
    let date: Date
    let kind: Kind
    let title: String
    let startTime: Date?
    let durationSeconds: Int?
    let distanceMiles: Double?

    init(
        id: UUID = UUID(),
        date: Date,
        kind: Kind,
        title: String,
        startTime: Date? = nil,
        durationSeconds: Int? = nil,
        distanceMiles: Double? = nil
    ) {
        self.id = id
        self.date = date
        self.kind = kind
        self.title = title
        self.startTime = startTime
        self.durationSeconds = durationSeconds
        self.distanceMiles = distanceMiles
    }

    var paceSecondsPerMile: Int? {
        guard let durationSeconds,
              durationSeconds > 0,
              let distanceMiles,
              distanceMiles > 0
        else {
            return nil
        }

        return Int((Double(durationSeconds) / distanceMiles).rounded())
    }

    var hasActualExecution: Bool {
        distanceMiles != nil || durationSeconds != nil
    }

    func updating(with input: WorkoutInput) -> Workout {
        Workout(
            id: id,
            date: date,
            kind: kind,
            title: input.title,
            startTime: input.startTime,
            durationSeconds: input.durationSeconds,
            distanceMiles: input.distanceMiles
        )
    }
}

struct WorkoutInput: Hashable, Sendable {
    let date: Date
    let title: String
    let distanceMiles: Double?
    let durationSeconds: Int?
    let startTime: Date?

    init(
        date: Date,
        title: String,
        distanceMiles: Double?,
        durationSeconds: Int?,
        startTime: Date?
    ) {
        self.date = date
        self.title = title.trimmingCharacters(in: .whitespacesAndNewlines)
        self.distanceMiles = distanceMiles.flatMap { $0 > 0 ? $0 : nil }
        self.durationSeconds = durationSeconds.flatMap { $0 > 0 ? $0 : nil }
        self.startTime = startTime
    }
}

enum WorkoutDuration {
    nonisolated static func parse(_ text: String) -> Int? {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }

        let components = trimmed.split(separator: ":", omittingEmptySubsequences: false)
        guard components.count == 2 || components.count == 3,
              components.allSatisfy({ !$0.isEmpty && $0.allSatisfy(\.isNumber) }),
              let seconds = Int(components[components.count - 1]),
              let minutes = Int(components[components.count - 2]),
              seconds < 60,
              components.count == 2 || minutes < 60
        else {
            return nil
        }

        let hours = components.count == 3 ? Int(components[0]) ?? 0 : 0
        return hours * 3_600 + minutes * 60 + seconds
    }

    nonisolated static func format(_ seconds: Int?) -> String {
        guard let seconds else { return "" }
        let hours = seconds / 3_600
        let minutes = (seconds % 3_600) / 60
        let remainingSeconds = seconds % 60
        return hours > 0
            ? String(format: "%d:%02d:%02d", hours, minutes, remainingSeconds)
            : String(format: "%d:%02d", minutes, remainingSeconds)
    }
}
