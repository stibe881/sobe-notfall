package expo.modules.alarmsound

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.RingtoneManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Spielt den Alarmton über die Wecker-Lautstärke (STREAM_ALARM) statt der
 * Benachrichtigungs-Lautstärke ab – bleibt dadurch auch bei stummgeschaltetem oder auf 0
 * gestelltem Klingelton hörbar, wie ein Weckerklingeln. Läuft unabhängig von der Notification
 * selbst: play()/stop() werden aus notifications.ts rund um eine kritische Meldung aufgerufen.
 */
class AlarmSoundModule : Module() {
  private var player: MediaPlayer? = null
  private var audioManager: AudioManager? = null
  private val focusChangeListener = AudioManager.OnAudioFocusChangeListener { }

  override fun definition() = ModuleDefinition {
    Name("AlarmSound")

    Function("play") {
      startAlarm()
    }

    Function("stop") {
      stopAlarm()
    }

    OnDestroy {
      stopAlarm()
    }
  }

  private fun startAlarm() {
    stopAlarm()
    val context = appContext.reactContext ?: return
    val uri = RingtoneManager.getActualDefaultRingtoneUri(context, RingtoneManager.TYPE_ALARM)
      ?: RingtoneManager.getValidRingtoneUri(context)
      ?: return

    val manager = context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
    audioManager = manager
    @Suppress("DEPRECATION")
    manager?.requestAudioFocus(focusChangeListener, AudioManager.STREAM_ALARM, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)

    try {
      player = MediaPlayer().apply {
        setAudioAttributes(
          AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()
        )
        setDataSource(context, uri)
        isLooping = true
        setOnPreparedListener { it.start() }
        prepareAsync()
      }
    } catch (_: Exception) {
      // Kein Alarmton verfügbar – die Vollbild-/Vibrations-Meldung bleibt bestehen
      stopAlarm()
    }
  }

  private fun stopAlarm() {
    player?.let {
      try {
        if (it.isPlaying) it.stop()
      } catch (_: Exception) {
        // bereits gestoppt oder nie gestartet
      }
      it.release()
    }
    player = null
    @Suppress("DEPRECATION")
    audioManager?.abandonAudioFocus(focusChangeListener)
    audioManager = null
  }
}
