import SwiftUI

enum RunnerTheme {
    static let background = Color(red: 0.035, green: 0.043, blue: 0.052)
    static let surface = Color(red: 0.075, green: 0.086, blue: 0.098)
    static let elevatedSurface = Color(red: 0.105, green: 0.118, blue: 0.132)
    static let border = Color.white.opacity(0.09)
    static let accent = Color(red: 0.25, green: 0.76, blue: 1.0)
    static let mutedText = Color.white.opacity(0.58)
    static let crimson = Color(red: 0.78, green: 0.14, blue: 0.22)
}

struct RunnerCardModifier: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding(18)
            .background(RunnerTheme.surface, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .stroke(RunnerTheme.border, lineWidth: 1)
            }
    }
}

extension View {
    func runnerCard() -> some View {
        modifier(RunnerCardModifier())
    }
}
