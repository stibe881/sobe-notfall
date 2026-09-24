const { createHash } = require('crypto')
const { execFileSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { withDangerousMod, withInfoPlist, withProjectBuildGradle } = require('expo/config-plugins')

/**
 * Config-Plugin für die Indoor-Ortung (Aruba Meridian).
 *
 * Aruba verteilt das Meridian-SDK nicht über CocoaPods oder Maven Central,
 * sondern als ZIP-Datei. Das Plugin lädt beim Prebuild (lokal wie auf EAS)
 * genau die hier festgelegte Version, prüft die Prüfsumme und legt sie dort
 * ab, wo Podspec und Gradle sie erwarten. Die Dateien sind gross und liegen
 * deshalb nicht im Git (siehe .gitignore).
 *
 * Neue SDK-Version: Version, Adresse und Prüfsumme unten anpassen – für iOS
 * steht die Prüfsumme in Package.swift von github.com/arubanetworks/meridian-ios-sdk.
 */
const SDK = {
  ios: {
    version: '12.0.0',
    url: 'https://files.meridianapps.com/meridian-ios-sdk/meridian-ios-sdk-only-12.0.0.zip',
    sha256: '9be86ccaa056cb13db9477c26b9a22308e8cdcdaf0f1aa25d1b6371d8ffe4ef5',
  },
  android: {
    version: '12.0.0',
    url: 'https://files.meridianapps.com/meridian-android-sdk/meridian-android-sdk-12.0.0.zip',
    sha256: '0cf6c59d02fd57ad994b2b7d86cb42b04934bc7c55235ff6e487b51c74fa4344',
  },
}

const MODUL = path.resolve(__dirname, '..')
const MAVEN = path.join(MODUL, 'android', 'maven')

async function ladeGeprueft(ziel) {
  const antwort = await fetch(ziel.url)
  if (!antwort.ok) throw new Error(`[meridian-indoor] Download fehlgeschlagen (${antwort.status}): ${ziel.url}`)
  const daten = Buffer.from(await antwort.arrayBuffer())
  const pruefsumme = createHash('sha256').update(daten).digest('hex')
  if (pruefsumme !== ziel.sha256) {
    throw new Error(`[meridian-indoor] Prüfsumme stimmt nicht für ${ziel.url}: ${pruefsumme}`)
  }
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'meridian-'))
  const zip = path.join(temp, 'sdk.zip')
  fs.writeFileSync(zip, daten)
  execFileSync('unzip', ['-q', '-o', zip, '-d', temp])
  return temp
}

/** Merker: Welche SDK-Version liegt bereits bereit? So lädt ein erneuter Prebuild nicht noch einmal. */
function bereit(merker, ziel) {
  return fs.existsSync(merker) && fs.readFileSync(merker, 'utf8').trim() === ziel.sha256
}

async function ladeIosSdk() {
  const ziel = SDK.ios
  const framework = path.join(MODUL, 'ios', 'Meridian.xcframework')
  const merker = path.join(MODUL, 'ios', '.meridian-sdk')
  if (bereit(merker, ziel) && fs.existsSync(framework)) return
  const temp = await ladeGeprueft(ziel)
  fs.rmSync(framework, { recursive: true, force: true })
  fs.cpSync(path.join(temp, 'Meridian.xcframework'), framework, { recursive: true })
  fs.writeFileSync(merker, ziel.sha256)
  fs.rmSync(temp, { recursive: true, force: true })
}

async function ladeAndroidSdk() {
  const ziel = SDK.android
  const ordner = path.join(MAVEN, 'com', 'arubanetworks', 'meridian', 'meridian', ziel.version)
  const aar = path.join(ordner, `meridian-${ziel.version}.aar`)
  const merker = path.join(MAVEN, '.meridian-sdk')
  if (bereit(merker, ziel) && fs.existsSync(aar)) return
  const temp = await ladeGeprueft(ziel)
  fs.rmSync(MAVEN, { recursive: true, force: true })
  fs.mkdirSync(ordner, { recursive: true })
  fs.copyFileSync(path.join(temp, `meridian-android-sdk-${ziel.version}`, `meridian-${ziel.version}.aar`), aar)
  fs.writeFileSync(
    path.join(ordner, `meridian-${ziel.version}.pom`),
    `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.arubanetworks.meridian</groupId>
  <artifactId>meridian</artifactId>
  <version>${ziel.version}</version>
  <packaging>aar</packaging>
</project>
`,
  )
  fs.writeFileSync(merker, ziel.sha256)
  fs.rmSync(temp, { recursive: true, force: true })
}

const MAVEN_EINTRAG = 'meridian-indoor/android/maven'

module.exports = function withMeridianIndoor(config) {
  config = withDangerousMod(config, [
    'ios',
    async (c) => {
      await ladeIosSdk()
      return c
    },
  ])
  config = withDangerousMod(config, [
    'android',
    async (c) => {
      await ladeAndroidSdk()
      return c
    },
  ])

  // Die App löst die Abhängigkeiten des Moduls mit ihren eigenen Repositories auf
  config = withProjectBuildGradle(config, (c) => {
    if (!c.modResults.contents.includes(MAVEN_EINTRAG)) {
      const relativ = path.relative(path.join(c.modRequest.platformProjectRoot), MAVEN).split(path.sep).join('/')
      c.modResults.contents = c.modResults.contents.replace(
        /allprojects\s*\{\s*repositories\s*\{/,
        (treffer) => `${treffer}\n    // Aruba-Meridian-SDK (${MAVEN_EINTRAG}), vom Config-Plugin geladen\n    maven { url "$rootDir/${relativ}" }`,
      )
      if (!c.modResults.contents.includes(MAVEN_EINTRAG)) {
        throw new Error('[meridian-indoor] allprojects.repositories in android/build.gradle nicht gefunden')
      }
    }
    return c
  })

  // Das SDK fragt den Bluetooth-Zustand ab – iOS verlangt dafür einen Begründungstext
  config = withInfoPlist(config, (c) => {
    c.modResults.NSBluetoothAlwaysUsageDescription =
      c.modResults.NSBluetoothAlwaysUsageDescription ??
      'SOBE Notfall erkennt über die Bluetooth-Signale der Access Points, in welchem Raum Sie sich befinden – damit Helfende Sie bei einem Alarm finden. Die Position wird nur mit einem Alarm übermittelt.'
    return c
  })

  return config
}
