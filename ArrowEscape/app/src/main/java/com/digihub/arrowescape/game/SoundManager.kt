package com.digihub.arrowescape.game

import android.content.Context
import android.media.AudioManager
import android.media.ToneGenerator
import android.os.Handler
import android.os.Looper

/**
 * Lightweight SFX using ToneGenerator — no asset files required.
 */
class SoundManager(@Suppress("UNUSED_PARAMETER") context: Context) {
    private var enabled = true
    private val handler = Handler(Looper.getMainLooper())
    private var tone: ToneGenerator? = try {
        ToneGenerator(AudioManager.STREAM_MUSIC, 70)
    } catch (_: Exception) {
        null
    }

    fun setEnabled(on: Boolean) {
        enabled = on
    }

    fun playTap() = beep(ToneGenerator.TONE_PROP_BEEP, 40)
    fun playLaunch() = beep(ToneGenerator.TONE_CDMA_PIP, 80)
    fun playSuccess() {
        beep(ToneGenerator.TONE_PROP_ACK, 60)
        handler.postDelayed({ beep(ToneGenerator.TONE_PROP_BEEP2, 50) }, 70)
    }
    fun playCrash() = beep(ToneGenerator.TONE_CDMA_ALERT_CALL_GUARD, 100)
    fun playHeart() = beep(ToneGenerator.TONE_SUP_ERROR, 120)
    fun playWin() {
        beep(ToneGenerator.TONE_CDMA_CONFIRM, 100)
        handler.postDelayed({ beep(ToneGenerator.TONE_PROP_ACK, 80) }, 100)
        handler.postDelayed({ beep(ToneGenerator.TONE_CDMA_PIP, 80) }, 200)
    }
    fun playLose() = beep(ToneGenerator.TONE_CDMA_ABBR_ALERT, 200)
    fun playCoin() = beep(ToneGenerator.TONE_DTMF_1, 50)

    private fun beep(toneType: Int, durationMs: Int) {
        if (!enabled) return
        try {
            tone?.startTone(toneType, durationMs)
        } catch (_: Exception) {
        }
    }

    fun release() {
        tone?.release()
        tone = null
    }
}
