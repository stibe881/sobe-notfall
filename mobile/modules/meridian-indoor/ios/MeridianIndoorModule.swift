import ExpoModulesCore

/**
 * Indoor-Ortung über das Aruba-Meridian-SDK.
 *
 * Die Access Points senden Bluetooth-Beacons; das SDK rechnet daraus eine
 * Position auf dem Grundriss (Karte + Pixel). Die eigentlichen SDK-Aufrufe
 * stehen in SOBEMeridianBridge.m – hier nur die Anbindung an JavaScript.
 */
public class MeridianIndoorModule: Module {
  private let bruecke = MeridianBruecke()

  public func definition() -> ModuleDefinition {
    Name("MeridianIndoor")

    Events("onLocation", "onError")

    AsyncFunction("configure") { (token: String, region: String) in
      MeridianBruecke.konfiguriere(token: token, region: region)
    }.runOnQueue(.main)

    AsyncFunction("start") { (appId: String) in
      self.bruecke.starte(
        appId: appId,
        position: { [weak self] position in
          self?.sendEvent("onLocation", position)
        },
        fehler: { [weak self] meldung in
          self?.sendEvent("onError", ["message": meldung])
        }
      )
    }.runOnQueue(.main)

    AsyncFunction("stop") {
      self.bruecke.stoppe()
    }.runOnQueue(.main)

    AsyncFunction("getCurrentLocation") { (appId: String, timeoutMs: Double, promise: Promise) in
      MeridianBruecke.aktuellePosition(appId: appId, timeout: timeoutMs / 1000) { position, _ in
        // Keine Position ist kein Fehler: Der Alarm geht dann ohne sie
        promise.resolve(position)
      }
    }.runOnQueue(.main)

    OnDestroy {
      DispatchQueue.main.async { [bruecke] in
        bruecke.stoppe()
      }
    }
  }
}
