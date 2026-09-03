const { existsSync } = require('fs')
const { join } = require('path')

/**
 * Ergänzt app.json zur Laufzeit: Liegt google-services.json (Firebase/FCM) im
 * Verzeichnis, wird sie eingebunden – ohne sie baut die App weiterhin, nur
 * bleiben Remote-Pushs auf Android dann aus. So scheitert der Update-Knopf des
 * Portals nicht an einer fehlenden Datei, bevor Firebase eingerichtet ist.
 * Die Datei ist bewusst NICHT in .gitignore: EAS packt das Arbeitsverzeichnis
 * nach .gitignore-Regeln, eine ignorierte Datei käme also nie beim Build an.
 */
module.exports = ({ config }) => {
  if (existsSync(join(__dirname, 'google-services.json'))) {
    config.android = { ...config.android, googleServicesFile: './google-services.json' }
  }
  return config
}
