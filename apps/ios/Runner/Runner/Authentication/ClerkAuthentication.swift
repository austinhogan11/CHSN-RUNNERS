import ClerkKit
import Foundation
import Observation

@MainActor
protocol ClerkSessionTokenFetching {
    func currentSessionToken() async throws -> String?
}

enum ClerkAccessTokenError: Error, Equatable {
    case sessionUnavailable
}

@MainActor
struct ClerkSessionTokenSource: ClerkSessionTokenFetching {
    func currentSessionToken() async throws -> String? {
        try await Clerk.shared.auth.getToken()
    }
}

@MainActor
struct ClerkAccessTokenProvider: AccessTokenProvider {
    private let tokenSource: any ClerkSessionTokenFetching

    init(tokenSource: (any ClerkSessionTokenFetching)? = nil) {
        self.tokenSource = tokenSource ?? ClerkSessionTokenSource()
    }

    func accessToken() async throws -> String? {
        guard let token = try await tokenSource.currentSessionToken(), !token.isEmpty else {
            throw ClerkAccessTokenError.sessionUnavailable
        }
        return token
    }
}

@MainActor
@Observable
final class AuthenticationState {
    enum WeekReadState: Equatable {
        case idle
        case loading
        case success(weekStart: Date, workoutCount: Int)
        case failure(String)
    }

    let clerk: Clerk
    private(set) var isWorking = false
    private(set) var errorMessage: String?
    private(set) var weekReadState: WeekReadState = .idle

    init(clerk: Clerk) {
        self.clerk = clerk
    }

    var isSignedIn: Bool {
        clerk.session != nil
    }

    func signIn() async {
        guard !isWorking else { return }
        isWorking = true
        errorMessage = nil
        defer { isWorking = false }

        do {
            try await clerk.auth.startHostedAuth()
            await proveAuthenticatedWeekRead()
        } catch is CancellationError {
            return
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func signOut() async {
        guard !isWorking else { return }
        isWorking = true
        errorMessage = nil
        defer { isWorking = false }

        do {
            try await clerk.auth.signOut()
            weekReadState = .idle
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func proveAuthenticatedWeekRead(date: Date = .now) async {
        guard clerk.session != nil else {
            weekReadState = .failure("Sign in before checking the API.")
            return
        }

        weekReadState = .loading
        do {
            let client = APIClient(tokenProvider: ClerkAccessTokenProvider())
            let repository = APIWorkoutRepository(client: client)
            let week = try await repository.loadWeek(containing: date)
            weekReadState = .success(
                weekStart: week.weekStart,
                workoutCount: week.workoutCount
            )
        } catch let error as APIClientError {
            weekReadState = .failure(apiFailureMessage(error))
        } catch {
            weekReadState = .failure(error.localizedDescription)
        }
    }

    private func apiFailureMessage(_ error: APIClientError) -> String {
        switch error {
        case let .httpStatus(code, detail):
            return detail.map { "API \(code): \($0)" } ?? "API request failed with status \(code)."
        case .invalidResponse:
            return "The API returned an invalid response."
        case .decoding:
            return "The API response could not be decoded."
        case .encoding:
            return "The API request could not be encoded."
        case let .transport(message):
            return message
        }
    }
}
