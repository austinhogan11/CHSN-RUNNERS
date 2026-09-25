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
}
