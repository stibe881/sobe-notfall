require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'MeridianIndoor'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = package['license']
  s.author         = 'SOBE Notfall'
  s.homepage       = 'https://edit.meridianapps.com'
  # Das Meridian-SDK 12 setzt iOS 16 voraus
  s.platforms      = { :ios => '16.0' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Das SDK selbst (dynamisches XCFramework von Aruba) lädt das Config-Plugin
  # beim Prebuild herunter – siehe plugin/index.js. Es liegt nicht im Git.
  s.vendored_frameworks = 'Meridian.xcframework'
  s.frameworks = 'CoreLocation', 'CoreBluetooth'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = '*.{h,m,swift}'
  s.public_header_files = 'SOBEMeridianBridge.h'
end
