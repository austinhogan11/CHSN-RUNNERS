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
    struct Components: Equatable, Sendable {
        let minutes: Int
        let seconds: Int
    }

    nonisolated static func components(from durationSeconds: Int?) -> Components {
        guard let durationSeconds, durationSeconds > 0 else {
            return Components(minutes: 0, seconds: 0)
        }
        return Components(minutes: durationSeconds / 60, seconds: durationSeconds % 60)
    }

    nonisolated static func parse(minutes: String, seconds: String) -> Int? {
        guard fieldsAreValid(minutes: minutes, seconds: seconds) else { return nil }
        let trimmedMinutes = minutes.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedSeconds = seconds.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedMinutes.isEmpty || !trimmedSeconds.isEmpty else { return nil }

        let total = (Int(trimmedMinutes) ?? 0) * 60 + (Int(trimmedSeconds) ?? 0)
        return total > 0 ? total : nil
    }

    nonisolated static func fieldsAreValid(minutes: String, seconds: String) -> Bool {
        let trimmedMinutes = minutes.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedSeconds = seconds.trimmingCharacters(in: .whitespacesAndNewlines)
        let minutesAreValid = trimmedMinutes.isEmpty
            || (trimmedMinutes.allSatisfy(\.isNumber) && Int(trimmedMinutes) != nil)
        let secondsAreValid = trimmedSeconds.isEmpty
            || (trimmedSeconds.allSatisfy(\.isNumber)
                && (Int(trimmedSeconds).map { 0...59 ~= $0 } ?? false))
        return minutesAreValid && secondsAreValid
    }

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

enum WorkoutDistance {
    nonisolated static func parse(_ text: String) -> Double? {
        let normalized = text
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: ",", with: ".")
        guard !normalized.isEmpty,
              let value = Double(normalized),
              value.isFinite,
              value > 0
        else {
            return nil
        }
        return value
    }

    nonisolated static func isValid(_ text: String) -> Bool {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty || parse(trimmed) != nil
    }
}

enum WorkoutEditorDefaults {
    nonisolated static func startTime(
        for workout: Workout?,
        workoutDate: Date,
        now: Date = .now,
        calendar: Calendar = .runner
    ) -> Date {
        if let existingStartTime = workout?.startTime {
            return existingStartTime
        }

        let clock = calendar.dateComponents([.hour, .minute], from: now)
        return calendar.date(
            bySettingHour: clock.hour ?? 0,
            minute: clock.minute ?? 0,
            second: 0,
            of: workoutDate
        ) ?? now
    }
}
