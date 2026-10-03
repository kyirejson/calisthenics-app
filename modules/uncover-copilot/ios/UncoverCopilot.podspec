Pod::Spec.new do |s|
  s.name = 'UncoverCopilot'
  s.version = '1.0.0'
  s.summary = 'Local system shortcut bridge for Uncover'
  s.description = 'Consumes foreground Siri input without executing an action automatically.'
  s.author = 'Uncover'
  s.homepage = 'https://github.com/kyirejson/calisthenics-app'
  s.license = { :type => 'Proprietary' }
  s.platforms = { :ios => '16.0' }
  s.source = { :git => 'https://github.com/kyirejson/calisthenics-app.git' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.swift_version = '5.9'
  s.source_files = '**/*.swift'
end
