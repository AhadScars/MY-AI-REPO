package com.digihub.arrowescape

import android.os.Bundle
import android.view.View
import android.widget.FrameLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import com.digihub.arrowescape.data.SaveData
import com.digihub.arrowescape.game.GameView
import com.digihub.arrowescape.game.SoundManager

class GameActivity : AppCompatActivity(), GameView.Listener {

    companion object {
        const val EXTRA_LEVEL = "level"
    }

    private lateinit var gameView: GameView
    private lateinit var save: SaveData
    private lateinit var sound: SoundManager
    private lateinit var overlay: FrameLayout
    private lateinit var overlayTitle: TextView
    private lateinit var overlaySubtitle: TextView
    private lateinit var overlayStars: TextView
    private lateinit var overlayReward: TextView
    private lateinit var overlayPrimary: TextView
    private lateinit var overlaySecondary: TextView
    private lateinit var overlayTertiary: TextView
    private lateinit var hudLevel: TextView
    private lateinit var hudHearts: TextView
    private lateinit var hudCoins: TextView
    private lateinit var hudHint: TextView

    private var currentLevel = 1
    private var overlayMode = OverlayMode.NONE

    private enum class OverlayMode { NONE, WIN, LOSE, PAUSE }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_game)

        save = SaveData(this)
        sound = SoundManager(this)
        sound.setEnabled(save.soundEnabled)

        gameView = findViewById(R.id.gameView)
        overlay = findViewById(R.id.overlay)
        overlayTitle = findViewById(R.id.overlayTitle)
        overlaySubtitle = findViewById(R.id.overlaySubtitle)
        overlayStars = findViewById(R.id.overlayStars)
        overlayReward = findViewById(R.id.overlayReward)
        overlayPrimary = findViewById(R.id.overlayPrimary)
        overlaySecondary = findViewById(R.id.overlaySecondary)
        overlayTertiary = findViewById(R.id.overlayTertiary)
        hudLevel = findViewById(R.id.hudLevel)
        hudHearts = findViewById(R.id.hudHearts)
        hudCoins = findViewById(R.id.hudCoins)
        hudHint = findViewById(R.id.hudHint)

        gameView.listener = this
        gameView.sound = sound
        gameView.shakeEnabled = save.shakeEnabled

        findViewById<TextView>(R.id.btnPause).setOnClickListener {
            if (gameView.isPlaying()) showPause()
        }

        overlayPrimary.setOnClickListener { onPrimary() }
        overlaySecondary.setOnClickListener { onSecondary() }
        overlayTertiary.setOnClickListener { onTertiary() }

        currentLevel = intent.getIntExtra(EXTRA_LEVEL, save.highestLevel).coerceAtLeast(1)
        startLevel(currentLevel)
    }

    private fun startLevel(level: Int) {
        currentLevel = level
        hideOverlay()
        gameView.startLevel(level)
        hudLevel.text = "Lv $level"
        hudCoins.text = "🪙 ${save.coins}"
        updateHearts(3)
        hudHint.text = getString(R.string.hint_play)
    }

    private fun updateHearts(n: Int) {
        val max = 3
        val sb = StringBuilder()
        for (i in 0 until max) {
            if (i > 0) sb.append(' ')
            sb.append(if (i < n) "❤️" else "🖤")
        }
        hudHearts.text = sb.toString()
        // pulse
        hudHearts.animate().cancel()
        hudHearts.scaleX = 1.15f
        hudHearts.scaleY = 1.15f
        hudHearts.animate().scaleX(1f).scaleY(1f).setDuration(180).start()
    }

    override fun onHeartsChanged(hearts: Int) {
        runOnUiThread { updateHearts(hearts) }
    }

    override fun onArrowRemoved(remaining: Int) {
        runOnUiThread {
            if (remaining > 0) {
                hudHint.text = "${gameView.getShapeName()} · $remaining left"
            }
        }
    }

    override fun onWin(stars: Int, coins: Int, xp: Int, perfect: Boolean, shapeName: String) {
        runOnUiThread {
            val result = save.completeLevel(currentLevel, gameView.getHearts(), gameView.getRemoved())
            save.addCoins(coins)
            save.addXp(xp)
            sound.playCoin()

            overlayMode = OverlayMode.WIN
            overlayTitle.text = getString(R.string.level_complete)
            overlaySubtitle.text = if (perfect) "$shapeName · Perfect!" else shapeName
            overlayStars.visibility = View.VISIBLE
            overlayStars.text = "⭐".repeat(result.first) + "☆".repeat(3 - result.first)
            overlayReward.visibility = View.VISIBLE
            overlayReward.text = "🪙 +$coins  ·  ✨ +$xp XP"
            overlayPrimary.text = getString(R.string.next_level)
            overlayPrimary.setBackgroundResource(R.drawable.bg_btn_success)
            overlayPrimary.setTextColor(0xFF042F1A.toInt())
            overlaySecondary.text = getString(R.string.home)
            overlayTertiary.visibility = View.GONE
            hudCoins.text = "🪙 ${save.coins}"
            showOverlay()
        }
    }

    override fun onLose(shapeName: String) {
        runOnUiThread {
            save.failLevel()
            overlayMode = OverlayMode.LOSE
            overlayTitle.text = getString(R.string.game_over)
            overlaySubtitle.text = "Level $currentLevel · $shapeName"
            overlayStars.visibility = View.GONE
            overlayReward.visibility = View.GONE
            overlayPrimary.text = getString(R.string.retry)
            overlayPrimary.setBackgroundResource(R.drawable.bg_btn_danger)
            overlayPrimary.setTextColor(0xFFFFFFFF.toInt())
            overlaySecondary.text = getString(R.string.home)
            overlayTertiary.visibility = View.GONE
            showOverlay()
        }
    }

    private fun showPause() {
        gameView.pauseGame()
        overlayMode = OverlayMode.PAUSE
        overlayTitle.text = getString(R.string.paused)
        overlaySubtitle.text = "Take a breath. The arrows can wait."
        overlayStars.visibility = View.GONE
        overlayReward.visibility = View.GONE
        overlayPrimary.text = getString(R.string.resume)
        overlayPrimary.setBackgroundResource(R.drawable.bg_btn_primary)
        overlayPrimary.setTextColor(0xFFFFFFFF.toInt())
        overlaySecondary.text = getString(R.string.home)
        overlayTertiary.visibility = View.VISIBLE
        overlayTertiary.text = getString(R.string.retry)
        showOverlay()
    }

    private fun showOverlay() {
        overlay.alpha = 0f
        overlay.visibility = View.VISIBLE
        overlay.animate().alpha(1f).setDuration(220).start()
    }

    private fun hideOverlay() {
        overlayMode = OverlayMode.NONE
        overlay.visibility = View.GONE
    }

    private fun onPrimary() {
        when (overlayMode) {
            OverlayMode.WIN -> startLevel(currentLevel + 1)
            OverlayMode.LOSE -> startLevel(currentLevel)
            OverlayMode.PAUSE -> {
                hideOverlay()
                gameView.resumeGame()
            }
            else -> {}
        }
    }

    private fun onSecondary() {
        finish()
    }

    private fun onTertiary() {
        if (overlayMode == OverlayMode.PAUSE) startLevel(currentLevel)
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (overlayMode == OverlayMode.PAUSE) {
            hideOverlay()
            gameView.resumeGame()
        } else if (gameView.isPlaying()) {
            showPause()
        } else {
            super.onBackPressed()
        }
    }

    override fun onDestroy() {
        sound.release()
        super.onDestroy()
    }
}
