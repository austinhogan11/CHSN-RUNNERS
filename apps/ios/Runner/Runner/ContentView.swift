//
//  ContentView.swift
//  Runner
//
//  Created by Austin on 9/24/26.
//

import ClerkKit
import SwiftUI

struct ContentView: View {
    @Bindable var authentication: AuthenticationState
    @State private var dashboardState: DashboardState

    init(authentication: AuthenticationState, dashboardState: DashboardState? = nil) {
        self.authentication = authentication
        let repository = APIWorkoutRepository(
            client: APIClient(tokenProvider: ClerkAccessTokenProvider())
        )
        _dashboardState = State(
            initialValue: dashboardState ?? DashboardState.production(repository: repository)
        )
    }

    var body: some View {
        Group {
            if !authentication.clerk.isLoaded {
                ProgressView("Loading Runner…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(RunnerTheme.background)
            } else if authentication.isSignedIn {
                RunnerDashboardView(
                    state: dashboardState,
                    reauthenticate: {
                        await authentication.signOut()
                    }
                )
                    .safeAreaInset(edge: .top, spacing: 0) {
                        SignedInBar(authentication: authentication)
                    }
            } else {
                SignedOutView(authentication: authentication)
            }
        }
        .preferredColorScheme(.dark)
    }
}

#Preview {
    let key = Bundle.main.object(forInfoDictionaryKey: "CLERK_PUBLISHABLE_KEY") as? String ?? ""
    let clerk = Clerk.configure(publishableKey: key)
    ContentView(authentication: AuthenticationState(clerk: clerk))
}

private struct SignedOutView: View {
    @Bindable var authentication: AuthenticationState

    var body: some View {
        VStack(spacing: 22) {
            Spacer()

            Text("R")
                .font(.largeTitle.bold().italic())
                .foregroundStyle(RunnerTheme.background)
                .frame(width: 64, height: 64)
                .background(RunnerTheme.accent, in: RoundedRectangle(cornerRadius: 18))

            VStack(spacing: 7) {
                Text("Runner")
                    .font(.largeTitle.bold())
                Text("Sign in to continue")
                    .font(.subheadline)
                    .foregroundStyle(RunnerTheme.mutedText)
            }

            Button {
                Task { await authentication.signIn() }
            } label: {
                Group {
                    if authentication.isWorking {
                        ProgressView()
                    } else {
                        Text("Sign in")
                    }
                }
                .font(.headline)
                .frame(maxWidth: .infinity)
                .frame(height: 50)
            }
            .buttonStyle(.plain)
            .foregroundStyle(RunnerTheme.background)
            .background(RunnerTheme.accent, in: RoundedRectangle(cornerRadius: 14))
            .disabled(authentication.isWorking)

            if let errorMessage = authentication.errorMessage {
                Text(errorMessage)
                    .font(.caption)
                    .foregroundStyle(Color.white.opacity(0.8))
                    .multilineTextAlignment(.center)
            }

            Spacer()
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(RunnerTheme.background)
    }
}

private struct SignedInBar: View {
    @Bindable var authentication: AuthenticationState

    var body: some View {
        HStack(spacing: 12) {
            Text("Signed in")
                .foregroundStyle(RunnerTheme.mutedText)

            Spacer()

            Button("Sign out") {
                Task { await authentication.signOut() }
            }
            .disabled(authentication.isWorking)
        }
        .font(.caption.weight(.semibold))
        .foregroundStyle(RunnerTheme.accent)
        .padding(.horizontal, 16)
        .frame(height: 38)
        .background(RunnerTheme.surface)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(RunnerTheme.border)
                .frame(height: 1)
        }
    }

}
