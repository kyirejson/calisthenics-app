import ExpoModulesCore

public class UncoverCopilotModule: Module {
  public func definition() -> ModuleDefinition {
    Name("UncoverCopilot")
    AsyncFunction("consumeSystemCommand") { () -> String? in
      let defaults = UserDefaults.standard
      let text = defaults.string(forKey: "uncover.copilot.pending.text")
      let at = defaults.double(forKey: "uncover.copilot.pending.at")
      defaults.removeObject(forKey: "uncover.copilot.pending.text")
      defaults.removeObject(forKey: "uncover.copilot.pending.at")
      let age = Date().timeIntervalSince1970 - at
      return age >= 0 && age <= 300 ? text : nil
    }
    AsyncFunction("requestAssistantShortcut") { false }
  }
}
