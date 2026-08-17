package com.digihub.sweetpop

import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import kotlin.concurrent.thread
import kotlin.math.PI
import kotlin.math.exp
import kotlin.math.sin

/**
 * Lightweight procedural sound engine — no external audio files.
 * Generates short tones/chimes for pop, swap, cascade, win, lose.
 */
class SoundManager {

    @Volatile
    var enabled: Boolean = true

    private val sampleRate = 22050

    fun playSwap() = playChord(floatArrayOf(520f, 660f), 70, 0.22f)
    fun playInvalid() = playChord(floatArrayOf(180f, 140f), 110, 0.18f)
    fun playPop(combo: Int) {
        val base = 480f + (combo.coerceAtMost(8) * 55f)
        playChord(floatArrayOf(base, base * 1.25f, base * 1.5f), 90 + combo * 8, 0.28f)
    }
    fun playFall() = playChord(floatArrayOf(320f), 40, 0.12f)
    fun playSelect() = playChord(floatArrayOf(700f), 45, 0.15f)
    fun playWin() = playMelody(floatArrayOf(523f, 659f, 784f, 1046f), 110)
    fun playLose() = playMelody(floatArrayOf(392f, 349f, 294f, 220f), 140)
    fun playButton() = playChord(floatArrayOf(640f, 800f), 55, 0.18f)

    private fun playMelody(freqs: FloatArray, noteMs: Int) {
        if (!enabled) return
        thread(name = "sfx-melody", isDaemon = true) {
            freqs.forEachIndexed { i, f ->
                val samples = synthTone(f, noteMs, 0.22f, fade = true)
                writeTrack(samples)
                if (i < freqs.lastIndex) Thread.sleep(18)
            }
        }
    }

    private fun playChord(freqs: FloatArray, durationMs: Int, volume: Float) {
        if (!enabled) return
        thread(name = "sfx", isDaemon = true) {
            val samples = mixTones(freqs, durationMs, volume)
            writeTrack(samples)
        }
    }

    private fun mixTones(freqs: FloatArray, durationMs: Int, volume: Float): ShortArray {
        val n = (sampleRate * durationMs / 1000.0).toInt().coerceAtLeast(1)
        val mix = DoubleArray(n)
        freqs.forEach { freq ->
            val tone = synthTone(freq, durationMs, volume / freqs.size, fade = true)
            for (i in 0 until n) {
                mix[i] += tone[i] / Short.MAX_VALUE.toDouble()
            }
        }
        return ShortArray(n) { i ->
            (mix[i].coerceIn(-1.0, 1.0) * Short.MAX_VALUE).toInt().toShort()
        }
    }

    private fun synthTone(freq: Float, durationMs: Int, volume: Float, fade: Boolean): ShortArray {
        val n = (sampleRate * durationMs / 1000.0).toInt().coerceAtLeast(1)
        val out = ShortArray(n)
        val twoPiF = 2.0 * PI * freq
        for (i in 0 until n) {
            val t = i.toDouble() / sampleRate
            var env = volume.toDouble()
            if (fade) {
                val attack = (i / (n * 0.08).coerceAtLeast(1.0)).coerceIn(0.0, 1.0)
                val release = exp(-3.2 * i / n.toDouble())
                env *= attack * release
            }
            // Soft square-ish candy pluck via sine + partial
            val sample = sin(twoPiF * t) * 0.72 + sin(twoPiF * 2 * t) * 0.18 + sin(twoPiF * 3 * t) * 0.08
            out[i] = (sample * env * Short.MAX_VALUE).toInt().coerceIn(Short.MIN_VALUE.toInt(), Short.MAX_VALUE.toInt()).toShort()
        }
        return out
    }

    private fun writeTrack(samples: ShortArray) {
        try {
            val attrs = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_GAME)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()
            val format = AudioFormat.Builder()
                .setSampleRate(sampleRate)
                .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                .build()
            val minBuf = AudioTrack.getMinBufferSize(
                sampleRate,
                AudioFormat.CHANNEL_OUT_MONO,
                AudioFormat.ENCODING_PCM_16BIT
            )
            val bufSize = maxOf(minBuf, samples.size * 2)
            val track = AudioTrack.Builder()
                .setAudioAttributes(attrs)
                .setAudioFormat(format)
                .setBufferSizeInBytes(bufSize)
                .setTransferMode(AudioTrack.MODE_STATIC)
                .build()
            track.write(samples, 0, samples.size)
            track.play()
            val ms = (samples.size * 1000L / sampleRate) + 30
            Thread.sleep(ms)
            track.stop()
            track.release()
        } catch (_: Exception) {
            // Audio may be unavailable on some emulators — ignore
        }
    }
}
