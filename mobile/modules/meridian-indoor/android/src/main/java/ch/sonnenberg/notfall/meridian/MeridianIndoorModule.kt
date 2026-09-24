package ch.sonnenberg.notfall.meridian

import android.content.Context
import com.arubanetworks.meridian.Meridian
import com.arubanetworks.meridian.editor.EditorKey
import com.arubanetworks.meridian.location.LocationProvider
import com.arubanetworks.meridian.location.LocationRequest
import com.arubanetworks.meridian.location.MeridianLocation
import com.arubanetworks.meridian.location.MeridianLocationManager
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Indoor-Ortung über das Aruba-Meridian-SDK.
 *
 * Die Access Points senden Bluetooth-Beacons (und je nach Gerät WLAN-Signale);
 * das SDK rechnet daraus eine Position auf dem Grundriss (Karte + Pixel).
 */
class MeridianIndoorModule : Module() {
  private var manager: MeridianLocationManager? = null
  private var konfiguriert = false

  private val context: Context
    get() = requireNotNull(appContext.reactContext?.applicationContext) { "Kein Android-Kontext verfügbar" }

  override fun definition() = ModuleDefinition {
    Name("MeridianIndoor")

    Events("onLocation", "onError")

    AsyncFunction("configure") { token: String, region: String ->
      val domain = if (region == "us") Meridian.DomainRegion.DomainRegionUS else Meridian.DomainRegion.DomainRegionEU
      if (!konfiguriert) {
        Meridian.configure(context, token)
        konfiguriert = true
      } else {
        Meridian.getShared().setEditorToken(token)
      }
      Meridian.getShared().setDomainRegion(domain)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("start") { appId: String ->
      stoppe()
      val neu = MeridianLocationManager(context, EditorKey.forApp(appId), object : MeridianLocationManager.LocationUpdateListener {
        override fun onLocationUpdate(location: MeridianLocation?) {
          if (location != null && !location.isInvalid) sendEvent("onLocation", position(location))
        }

        override fun onLocationError(tr: Throwable) {
          sendEvent("onError", mapOf("message" to (tr.localizedMessage ?: "Ortung fehlgeschlagen")))
        }

        // Das SDK bittet, Bluetooth, WLAN oder Standort einzuschalten – die App zeigt das als Hinweis
        override fun onEnableBluetoothRequest() {
          sendEvent("onError", mapOf("message" to "Bluetooth ist ausgeschaltet", "code" to "bluetooth"))
        }

        override fun onEnableWiFiRequest() {
          sendEvent("onError", mapOf("message" to "WLAN ist ausgeschaltet", "code" to "wlan"))
        }

        override fun onEnableGPSRequest() {
          sendEvent("onError", mapOf("message" to "Standort ist ausgeschaltet", "code" to "standort"))
        }
      })
      manager = neu
      neu.startListeningForLocation()
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("stop") {
      stoppe()
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("getCurrentLocation") { appId: String, timeoutMs: Double, promise: Promise ->
      LocationRequest.requestCurrentLocation(context, EditorKey.forApp(appId), object : LocationRequest.LocationRequestListener {
        override fun onResult(location: MeridianLocation) {
          promise.resolve(if (location.isInvalid) null else position(location))
        }

        // Keine Position ist kein Fehler: Der Alarm geht dann ohne sie
        override fun onError(type: LocationRequest.ErrorType) {
          promise.resolve(null)
        }
      }, timeoutMs.toLong())
    }.runOnQueue(Queues.MAIN)

    OnDestroy {
      stoppe()
    }
  }

  private fun stoppe() {
    manager?.stopListeningForLocation()
    manager = null
  }

  private fun position(location: MeridianLocation): Map<String, Any?> {
    val punkt = location.point
    val quelle = when (location.provider?.type) {
      LocationProvider.ProviderType.BEACON_PROVIDER -> "beacons"
      LocationProvider.ProviderType.WIFI_PROVIDER -> "wlan"
      LocationProvider.ProviderType.SYSTEM_PROVIDER -> "system"
      else -> "unbekannt"
    }
    return mapOf(
      "mapId" to (location.mapKey?.id ?: ""),
      "x" to punkt.x.toDouble(),
      "y" to punkt.y.toDouble(),
      "genauigkeitM" to location.accuracy,
      "ermitteltAt" to (location.timestamp?.time ?: System.currentTimeMillis()).toDouble(),
      "quelle" to quelle,
    )
  }
}
