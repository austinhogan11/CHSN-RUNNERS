//
//  RunnerApp.swift
//  Runner
//
//  Created by Austin on 9/24/26.
//

import ClerkKit
import SwiftUI

@main
struct RunnerApp: App {
    @State private var authentication: AuthenticationState

    init() {
        let publishableKey = Bundle.main.object(
            forInfoDictionaryKey: "CLERK_PUBLISHABLE_KEY"
        ) as? String ?? ""
        let clerk = Clerk.configure(publishableKey: publishableKey)
        _authentication = State(initialValue: AuthenticationState(clerk: clerk))
    }

    var body: some Scene {
        WindowGroup {
            ContentView(authentication: authentication)
        }
    }
}
