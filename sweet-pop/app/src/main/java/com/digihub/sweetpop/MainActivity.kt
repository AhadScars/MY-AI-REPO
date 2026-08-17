package com.digihub.sweetpop

import android.os.Bundle
import android.view.View
import android.view.animation.DecelerateInterpolator
import android.widget.ProgressBar
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat

class MainActivity : AppCompatActivity(), GameView.Listener {

    private lateinit var menuScreen: View
    private lateinit var gameScreen: View
    private lateinit var resultOverlay: View
    private lateinit var gameView: GameView
    private lateinit var tvLevel: TextView
    private lateinit var tvTarget: TextView
    private lateinit var tvScore: TextView
    private lateinit var tvMoves: TextView
    private lateinit var progressScore: ProgressBar
    private lateinit var tvMenuLevel: TextView
    private lateinit var tvBestScore: TextView
    private lateinit var btnPlay: TextView
    private lateinit var btnSound: TextView
    private lateinit var btnMenu: TextView
    private lateinit var tvResultEmoji: TextView
    private lateinit var tvResultTitle: TextView
    private lateinit var tvResultScore: TextView
    private lateinit var btnResultPrimary: TextView
    private lateinit var btnResultSecondary: TextView

    private val sound = SoundManager()
    private var currentLevel = 1
    private var bestScore = 0
    private var lastWon = false
    private var soundOn = true

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, true)
        setContentView(R.layout.activity_main)

        val prefs = getSharedPreferences("sweetpop", MODE_PRIVATE)
        currentLevel = prefs.getInt("level", 1).coerceAtLeast(1)
        bestScore = prefs.getInt("best", 0)
        soundOn = prefs.getBoolean("sound", true)
        sound.enabled = soundOn

        bindViews()
        wireClicks()
        refreshMenu()
        showMenu()

        WindowInsetsControllerCompat(window, window.decorView).apply {
            isAppearanceLightStatusBars = false
        }
    }

    private fun bindViews() {
        menuScreen = findViewById(R.id.menuScreen)
        gameScreen = findViewById(R.id.gameScreen)
        resultOverlay = findViewById(R.id.resultOverlay)
        gameView = findViewById(R.id.gameView)
        tvLevel = findViewById(R.id.tvLevel)
        tvTarget = findViewById(R.id.tvTarget)
        tvScore = findViewById(R.id.tvScore)
        tvMoves = findViewById(R.id.tvMoves)
        progressScore = findViewById(R.id.progressScore)
        tvMenuLevel = findViewById(R.id.tvMenuLevel)
        tvBestScore = findViewById(R.id.tvBestScore)
        btnPlay = findViewById(R.id.btnPlay)
        btnSound = findViewById(R.id.btnSound)
        btnMenu = findViewById(R.id.btnMenu)
        tvResultEmoji = findViewById(R.id.tvResultEmoji)
        tvResultTitle = findViewById(R.id.tvResultTitle)
        tvResultScore = findViewById(R.id.tvResultScore)
        btnResultPrimary = findViewById(R.id.btnResultPrimary)
        btnResultSecondary = findViewById(R.id.btnResultSecondary)

        gameView.listener = this
        gameView.sound = sound
        updateSoundLabel()
    }

    private fun wireClicks() {
        btnPlay.setOnClickListener {
            sound.playButton()
            startGame(currentLevel)
        }
        btnMenu.setOnClickListener {
            sound.playButton()
            showMenu()
        }
        btnSound.setOnClickListener {
            soundOn = !soundOn
            sound.enabled = soundOn
            getSharedPreferences("sweetpop", MODE_PRIVATE)
                .edit().putBoolean("sound", soundOn).apply()
            updateSoundLabel()
            if (soundOn) sound.playButton()
        }
        btnResultPrimary.setOnClickListener {
            sound.playButton()
            resultOverlay.visibility = View.GONE
            if (lastWon) {
                currentLevel += 1
                persistProgress()
                startGame(currentLevel)
            } else {
                startGame(currentLevel)
            }
        }
        btnResultSecondary.setOnClickListener {
            sound.playButton()
            resultOverlay.visibility = View.GONE
            showMenu()
        }
    }

    private fun updateSoundLabel() {
        (btnSound as TextView).text = if (soundOn) getString(R.string.sound_on) else getString(R.string.sound_off)
    }

    private fun refreshMenu() {
        tvMenuLevel.text = getString(R.string.level_fmt, currentLevel)
        tvBestScore.text = "Best score: $bestScore"
    }

    private fun showMenu() {
        resultOverlay.visibility = View.GONE
        gameScreen.visibility = View.GONE
        menuScreen.visibility = View.VISIBLE
        refreshMenu()
        menuScreen.alpha = 0f
        menuScreen.animate().alpha(1f).setDuration(280).setInterpolator(DecelerateInterpolator()).start()
    }

    private fun startGame(level: Int) {
        currentLevel = level
        menuScreen.visibility = View.GONE
        resultOverlay.visibility = View.GONE
        gameScreen.visibility = View.VISIBLE
        gameScreen.alpha = 0f
        gameScreen.animate().alpha(1f).setDuration(250).start()

        val cfg = LevelConfig.forLevel(level)
        tvLevel.text = getString(R.string.level_fmt, level)
        tvTarget.text = "Target ${cfg.targetScore}"
        tvScore.text = "0"
        tvMoves.text = cfg.moves.toString()
        progressScore.progress = 0
        progressScore.max = 100

        gameView.post { gameView.startLevel(level) }
    }

    override fun onScoreChanged(score: Int, target: Int, moves: Int) {
        runOnUiThread {
            tvScore.text = score.toString()
            tvMoves.text = moves.toString()
            val pct = if (target <= 0) 0 else ((score * 100f) / target).toInt().coerceIn(0, 100)
            progressScore.progress = pct
            if (score > bestScore) {
                bestScore = score
                persistProgress()
            }
        }
    }

    override fun onLevelEnded(won: Boolean, score: Int) {
        runOnUiThread {
            lastWon = won
            if (score > bestScore) {
                bestScore = score
            }
            if (won) {
                // unlock next level
                val next = currentLevel + 1
                val prefs = getSharedPreferences("sweetpop", MODE_PRIVATE)
                val saved = prefs.getInt("level", 1)
                if (next > saved) {
                    currentLevel = next
                }
                // keep currentLevel as completed level until primary click advances
            }
            persistProgress()

            tvResultEmoji.text = if (won) "🎉" else "💫"
            tvResultTitle.text = if (won) getString(R.string.win_title) else getString(R.string.lose_title)
            tvResultScore.text = "Score: $score"
            (btnResultPrimary as TextView).text =
                if (won) getString(R.string.next_level) else getString(R.string.retry)

            resultOverlay.visibility = View.VISIBLE
            resultOverlay.alpha = 0f
            resultOverlay.animate().alpha(1f).setDuration(280).start()
        }
    }

    override fun onCombo(combo: Int) {
        // HUD already updates via score; could add toast later
    }

    private fun persistProgress() {
        getSharedPreferences("sweetpop", MODE_PRIVATE).edit()
            .putInt("level", currentLevel)
            .putInt("best", bestScore)
            .putBoolean("sound", soundOn)
            .apply()
    }

    override fun onPause() {
        super.onPause()
        persistProgress()
    }
}
