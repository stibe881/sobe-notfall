// Metro-Konfiguration fürs Monorepo (npm workspaces): Ohne diese Anpassungen
// findet Metro @sobe/shared-types nicht – das Paket liegt nicht unter
// mobile/node_modules, sondern nur als Verweis (Symlink) von npm workspaces
// auf packages/shared-types im Projektstamm, und Metro durchsucht von sich
// aus nur das eigene Projektverzeichnis. Vorgehen nach der offiziellen
// Expo-Monorepo-Anleitung: https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const projectRoot = __dirname
const monorepoRoot = path.resolve(projectRoot, '..')

const config = getDefaultConfig(projectRoot)

// 1. Den ganzen Projektstamm beobachten – sonst bemerkt Metro Änderungen an
//    packages/shared-types nicht (weder beim ersten Start noch bei Fast Refresh).
config.watchFolders = [monorepoRoot]

// 2. Erst im eigenen node_modules suchen, dann im gehobenen node_modules des
//    Projektstamms – dort liegen die von npm workspaces gemeinsam genutzten
//    Abhängigkeiten (und der Symlink auf packages/shared-types).
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
]

// 3. Abhängigkeiten ausschliesslich über die obigen Pfade auflösen, nicht
//    zusätzlich Verzeichnis für Verzeichnis nach oben suchen – vermeidet, dass
//    eine zufällig doppelt vorhandene Paketversion irgendwo im Projektstamm
//    gewinnt statt der in mobile/package.json verlangten.
config.resolver.disableHierarchicalLookup = true

module.exports = config
