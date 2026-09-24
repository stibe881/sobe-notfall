/**
 * Name der Anwendung selbst – neben dem Logo in der Kopfzeile und auf der
 * Anmeldemaske.
 *
 * Drei Fälle: Ein Name ergibt den Namen, **kein Eintrag** («undefined», nie
 * gesetzt) die Vorgabe – und ein **leerer Eintrag** gar nichts. Wer neben
 * seinem Logo keinen Text will, soll das Feld im Portal leeren können, ohne
 * dass eine Vorgabe zurückkehrt. Dieselbe Regel gilt im Portal
 * (src/lib/branding.ts); beide müssen zusammenpassen.
 */
export function anwendungsname(appName: string | undefined): string {
  return appName === undefined ? 'SOBE Notfall' : appName.trim()
}
