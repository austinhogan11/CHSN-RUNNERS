import Foundation
import Testing
@testable import Runner

@Suite(.serialized)
struct APIClientTests {
    @MainActor
    @Test("Clerk access-token provider forwards the current session token")
    func clerkAccessTokenProvider() async throws {
        let source = StubClerkTokenSource(result: .success("clerk-session-token"))
        let provider = ClerkAccessTokenProvider(tokenSource: source)

        #expect(try await provider.accessToken() == "clerk-session-token")
    }

    @MainActor
    @Test("Clerk access-token provider preserves token-source failures")
    func clerkAccessTokenProviderFailure() async {
        let source = StubClerkTokenSource(result: .failure(TokenSourceError.unavailable))
        let provider = ClerkAccessTokenProvider(tokenSource: source)

        await #expect(throws: TokenSourceError.unavailable) {
            try await provider.accessToken()
        }
    }

    @MainActor
    @Test("Clerk access-token provider rejects a missing session token")
    func clerkAccessTokenProviderMissingSession() async {
        let source = StubClerkTokenSource(result: .success(nil))
        let provider = ClerkAccessTokenProvider(tokenSource: source)

        await #expect(throws: ClerkAccessTokenError.sessionUnavailable) {
            try await provider.accessToken()
        }
    }

    @MainActor
    @Test("Week and trend DTOs decode real API field names and zero values")
    func decodesWeekAndTrendContracts() async throws {
        let weekJSON = """
        {
          "week_start": "2026-09-21",
          "planned_distance": 5.0,
          "actual_distance": 0.0,
          "workouts": [{
            "id": "4A72D02A-1276-4D40-B346-1E5BBA52D67D",
            "date": "2026-09-21",
            "type": "run",
            "title": null,
            "description": null,
            "planned_distance": 5.0,
            "start_time": null,
            "duration_seconds": null,
            "distance": null,
            "status": "planned"
          }]
        }
        """
        let client = makeClient { request in
            #expect(request.url?.path == "/api/weeks/2026-09-21")
            return response(for: request, json: weekJSON)
        }

        let week: WeekSummaryDTO = try await client.get("weeks/2026-09-21")

        #expect(week.weekStart == "2026-09-21")
        #expect(week.actualDistance == 0)
        #expect(week.workouts[0].distance == nil)
        #expect(week.workouts[0].durationSeconds == nil)
        #expect(week.workouts[0].plannedDistance == 5)
        let mappedWeek = try WorkoutDTOMapper.weekSummary(from: week)
        #expect(mappedWeek.plannedMileage == 5)
        #expect(mappedWeek.actualMileage == 0)

        let trendJSON = """
        [{"week_start":"2026-09-14","planned_distance":0,"actual_distance":0}]
        """
        URLProtocolStub.handler = { request in response(for: request, json: trendJSON) }
        let trend: [MileageTrendPointDTO] = try await client.get("trends/mileage")
        #expect(trend == [MileageTrendPointDTO(weekStart: "2026-09-14", plannedDistance: 0, actualDistance: 0)])
        let mappedTrend = try WorkoutDTOMapper.trendPoint(from: trend[0])
        #expect(mappedTrend.plannedMileage == 0)
        #expect(mappedTrend.actualMileage == 0)
    }

    @MainActor
    @Test("DTO mapping preserves IDs, local date/time, nullable execution, and planned distance")
    func mapsDTOToDomain() throws {
        var calendar = Calendar.runner
        calendar.timeZone = try #require(TimeZone(secondsFromGMT: -14_400))
        let dto = WorkoutDTO(
            id: "4A72D02A-1276-4D40-B346-1E5BBA52D67D",
            date: "2026-09-21",
            type: .crossTraining,
            title: "Bike",
            description: "Easy aerobic ride",
            plannedDistance: 20,
            startTime: "07:15:00",
            durationSeconds: 0,
            distance: 0,
            status: .completed
        )

        let workout = try WorkoutDTOMapper.workout(from: dto, calendar: calendar)

        #expect(workout.id == dto.id)
        #expect(workout.kind == .crossTraining)
        #expect(workout.description == "Easy aerobic ride")
        #expect(workout.plannedDistanceMiles == 20)
        #expect(workout.durationSeconds == 0)
        #expect(workout.distanceMiles == 0)
        #expect(calendar.component(.day, from: workout.date) == 21)
        #expect(calendar.component(.hour, from: try #require(workout.startTime)) == 7)
    }

    @MainActor
    @Test("API client injects a bearer token")
    func injectsAuthorizationHeader() async throws {
        let client = makeClient(tokenProvider: FixedTokenProvider(token: "session-token")) { request in
            #expect(request.value(forHTTPHeaderField: "Authorization") == "Bearer session-token")
            return response(for: request, json: #"{"status":"ok"}"#)
        }
        let result: StatusResponseDTO = try await client.get("health")
        #expect(result.status == "ok")
    }

    @MainActor
    @Test("API client omits authorization when no token exists")
    func omitsAuthorizationHeader() async throws {
        let client = makeClient { request in
            #expect(request.value(forHTTPHeaderField: "Authorization") == nil)
            return response(for: request, json: #"{"status":"ready"}"#)
        }
        let result: StatusResponseDTO = try await client.get("ready")
        #expect(result.status == "ready")
    }

    @MainActor
    @Test("API client surfaces HTTP errors", arguments: [401, 404, 422, 500])
    func handlesHTTPStatus(_ status: Int) async {
        let client = makeClient { request in
            response(for: request, status: status, json: #"{"detail":"failure"}"#)
        }
        do {
            let _: StatusResponseDTO = try await client.get("health")
            Issue.record("Expected HTTP error")
        } catch let error as APIClientError {
            #expect(error == .httpStatus(code: status, detail: "failure"))
        } catch {
            Issue.record("Unexpected error: \(error)")
        }
    }

    @MainActor
    @Test("API client surfaces malformed JSON")
    func handlesMalformedJSON() async {
        let client = makeClient { request in response(for: request, json: "not-json") }
        do {
            let _: StatusResponseDTO = try await client.get("health")
            Issue.record("Expected decoding error")
        } catch let error as APIClientError {
            #expect(error == .decoding)
        } catch {
            Issue.record("Unexpected error: \(error)")
        }
    }

    @MainActor
    @Test("API client surfaces transport failures")
    func handlesTransportFailure() async {
        let client = makeClient { _ in throw URLError(.notConnectedToInternet) }
        do {
            let _: StatusResponseDTO = try await client.get("health")
            Issue.record("Expected transport error")
        } catch APIClientError.transport {
            // Expected.
        } catch {
            Issue.record("Unexpected error: \(error)")
        }
    }

    @MainActor
    @Test("In-memory repository preserves local CRUD and aggregation")
    func inMemoryRepositoryBehavior() async throws {
        let date = try APIValueFormatter.date(from: "2026-09-21")
        let repository: any WorkoutRepository = InMemoryWorkoutRepository(
            workouts: [],
            trend: [],
            calendar: .runner
        )
        let created = try await repository.createWorkout(
            WorkoutInput(date: date, title: "Easy", distanceMiles: 5, durationSeconds: 2_400, startTime: nil)
        )
        #expect(try await repository.loadWeek(containing: date).actualMileage == 5)

        let updated = try await repository.updateWorkout(
            id: created.id,
            with: WorkoutInput(date: date, title: "Steady", distanceMiles: 6, durationSeconds: nil, startTime: nil)
        )
        #expect(updated.title == "Steady")
        #expect(try await repository.loadMileageTrend(ending: date, weeks: 1).first?.actualMileage == 6)

        try await repository.deleteWorkout(id: created.id)
        #expect(try await repository.loadWeek(containing: date).workouts.isEmpty)
    }

    @MainActor
    private func makeClient(
        tokenProvider: (any AccessTokenProvider)? = nil,
        handler: @escaping @Sendable (URLRequest) throws -> (HTTPURLResponse, Data)
    ) -> APIClient {
        URLProtocolStub.handler = handler
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [URLProtocolStub.self]
        return APIClient(
            baseURL: URL(string: "https://chosenrunning.com/api")!,
            session: URLSession(configuration: configuration),
            tokenProvider: tokenProvider
        )
    }

    private func response(
        for request: URLRequest,
        status: Int = 200,
        json: String
    ) -> (HTTPURLResponse, Data) {
        let response = HTTPURLResponse(
            url: request.url!,
            statusCode: status,
            httpVersion: nil,
            headerFields: ["Content-Type": "application/json"]
        )!
        return (response, Data(json.utf8))
    }
}

private enum TokenSourceError: Error, Equatable {
    case unavailable
}

@MainActor
private struct StubClerkTokenSource: ClerkSessionTokenFetching {
    let result: Result<String?, TokenSourceError>

    func currentSessionToken() async throws -> String? {
        try result.get()
    }
}

private struct FixedTokenProvider: AccessTokenProvider {
    let token: String?
    func accessToken() async throws -> String? { token }
}

private final class URLProtocolStub: URLProtocol, @unchecked Sendable {
    nonisolated(unsafe) static var handler: (@Sendable (URLRequest) throws -> (HTTPURLResponse, Data))?

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        guard let handler = Self.handler else {
            client?.urlProtocol(self, didFailWithError: URLError(.unknown))
            return
        }
        do {
            let (response, data) = try handler(request)
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: data)
            client?.urlProtocolDidFinishLoading(self)
        } catch {
            client?.urlProtocol(self, didFailWithError: error)
        }
    }

    override func stopLoading() {}
}
