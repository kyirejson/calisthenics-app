import AppIntents
import Foundation

@available(iOS 16.0, *)
struct UncoverAgentIntent: AppIntent {
  static var title: LocalizedStringResource = "询问个人助手"
  static var description = IntentDescription("打开 Uncover 并填写问题；不会自动发送或修改数据。")
  static var openAppWhenRun = true
  @Parameter(title: "问题", default: "") var question: String
  @MainActor func perform() async throws -> some IntentResult {
    // Compiled into the application target (not the pod), so Siri and JS share app defaults.
    UserDefaults.standard.set(String(question.prefix(1000)), forKey: "uncover.copilot.pending.text")
    UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: "uncover.copilot.pending.at")
    return .result()
  }
}

@available(iOS 16.0, *)
struct UncoverAgentShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(intent: UncoverAgentIntent(), phrases: ["用\(.applicationName)询问个人助手", "打开\(.applicationName)个人助手"], shortTitle: "个人助手", systemImageName: "bubble.left.and.bubble.right")
  }
}
