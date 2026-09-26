import Foundation

@MainActor
protocol AccessTokenProvider {
    func accessToken() async throws -> String?
}

struct NoAccessTokenProvider: AccessTokenProvider {
    func accessToken() async throws -> String? { nil }
}

enum APIClientError: Error, Equatable {
    case invalidResponse
    case httpStatus(code: Int, detail: String?)
    case decoding
    case encoding
    case transport(String)
}

@MainActor
struct APIClient {
    nonisolated static let productionBaseURL = URL(string: "https://chosenrunning.com/api")!

    private let baseURL: URL
    private let session: URLSession
    private let tokenProvider: any AccessTokenProvider
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    init(
        baseURL: URL = productionBaseURL,
        session: URLSession = .shared,
        tokenProvider: (any AccessTokenProvider)? = nil
    ) {
        self.baseURL = baseURL
        self.session = session
        self.tokenProvider = tokenProvider ?? NoAccessTokenProvider()
    }

    func get<Response: Decodable>(
        _ path: String,
        queryItems: [URLQueryItem] = []
    ) async throws -> Response {
        try await send(path, method: "GET", queryItems: queryItems, body: Optional<EmptyBody>.none)
    }

    func post<Body: Encodable, Response: Decodable>(
        _ path: String,
        body: Body
    ) async throws -> Response {
        try await send(path, method: "POST", body: body)
    }

    func patch<Body: Encodable, Response: Decodable>(
        _ path: String,
        body: Body
    ) async throws -> Response {
        try await send(path, method: "PATCH", body: body)
    }

    func delete(_ path: String) async throws {
        let _: EmptyResponse = try await send(path, method: "DELETE", body: Optional<EmptyBody>.none)
    }

    private func send<Body: Encodable, Response: Decodable>(
        _ path: String,
        method: String,
        queryItems: [URLQueryItem] = [],
        body: Body?
    ) async throws -> Response {
        guard var components = URLComponents(
            url: baseURL.appending(path: path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))),
            resolvingAgainstBaseURL: false
        ) else {
            throw APIClientError.invalidResponse
        }
        if !queryItems.isEmpty { components.queryItems = queryItems }
        guard let url = components.url else { throw APIClientError.invalidResponse }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let token = try await tokenProvider.accessToken(), !token.isEmpty {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if let body {
            do {
                request.httpBody = try encoder.encode(body)
            } catch {
                throw APIClientError.encoding
            }
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw APIClientError.transport(String(describing: error))
        }
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIClientError.invalidResponse
        }
        guard 200..<300 ~= httpResponse.statusCode else {
            let detail = try? decoder.decode(APIErrorResponse.self, from: data).detail
            throw APIClientError.httpStatus(code: httpResponse.statusCode, detail: detail)
        }
        if Response.self == EmptyResponse.self {
            return EmptyResponse() as! Response
        }
        do {
            return try decoder.decode(Response.self, from: data)
        } catch {
            throw APIClientError.decoding
        }
    }
}

private struct EmptyBody: Encodable {}
private struct EmptyResponse: Decodable {}
private struct APIErrorResponse: Decodable { let detail: String? }
