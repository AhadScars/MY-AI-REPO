package com.digihub.arrowescape

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import com.digihub.arrowescape.data.SaveData
import com.google.android.material.dialog.MaterialAlertDialogBuilder

class MainActivity : AppCompatActivity() {

    private lateinit var save: SaveData

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        save = SaveData(this)

        findViewById<TextView>(R.id.btnPlay).setOnClickListener {
            startLevel(save.highestLevel.coerceAtLeast(1))
        }
        findViewById<TextView>(R.id.btnLevels).setOnClickListener { showLevelSelect() }
        findViewById<TextView>(R.id.btnStats).setOnClickListener { showStats() }
        findViewById<TextView>(R.id.btnSettings).setOnClickListener { showSettings() }

        // Press animation
        listOf(R.id.btnPlay, R.id.btnLevels, R.id.btnStats, R.id.btnSettings).forEach { id ->
            findViewById<View>(id).setOnTouchListener { v, e ->
                when (e.action) {
                    android.view.MotionEvent.ACTION_DOWN -> v.animate().scaleX(0.97f).scaleY(0.97f).setDuration(80).start()
                    android.view.MotionEvent.ACTION_UP, android.view.MotionEvent.ACTION_CANCEL ->
                        v.animate().scaleX(1f).scaleY(1f).setDuration(80).start()
                }
                false
            }
        }
    }

    override fun onResume() {
        super.onResume()
        refreshStats()
    }

    private fun refreshStats() {
        findViewById<TextView>(R.id.statCoins).text = save.coins.toString()
        findViewById<TextView>(R.id.statLevel).text = save.highestLevel.toString()
        findViewById<TextView>(R.id.statXp).text = save.xp.toString()
    }

    private fun startLevel(level: Int) {
        startActivity(Intent(this, GameActivity::class.java).putExtra(GameActivity.EXTRA_LEVEL, level))
    }

    private fun showLevelSelect() {
        val maxShow = minOf(200, maxOf(save.highestLevel + 8, 24))
        val labels = Array(maxShow) { i ->
            val lv = i + 1
            val locked = !save.isLevelUnlocked(lv)
            val stars = save.getStars(lv)
            val starStr = if (stars > 0) " " + "★".repeat(stars) else ""
            if (locked) "🔒  Level $lv" else "Level $lv$starStr"
        }
        MaterialAlertDialogBuilder(this)
            .setTitle("Level Select")
            .setItems(labels) { _, which ->
                val level = which + 1
                if (save.isLevelUnlocked(level)) startLevel(level)
            }
            .setNegativeButton("Back", null)
            .show()
    }

    private fun showStats() {
        val msg = """
            Levels completed: ${save.levelsCompleted}
            Highest level: ${save.highestLevel}
            Arrows removed: ${save.arrowsRemoved}
            Perfect levels: ${save.perfectLevels}
            Hearts lost: ${save.heartsLost}
            Current streak: ${save.currentStreak}
            Longest streak: ${save.longestStreak}
            Coins earned: ${save.coinsEarnedTotal}
            XP: ${save.xp}
        """.trimIndent()
        MaterialAlertDialogBuilder(this)
            .setTitle("Statistics")
            .setMessage(msg)
            .setPositiveButton("OK", null)
            .show()
    }

    private fun showSettings() {
        val items = arrayOf("Sound Effects", "Screen Shake")
        val checked = booleanArrayOf(save.soundEnabled, save.shakeEnabled)
        MaterialAlertDialogBuilder(this)
            .setTitle("Settings")
            .setMultiChoiceItems(items, checked) { _, which, isChecked ->
                when (which) {
                    0 -> save.soundEnabled = isChecked
                    1 -> save.shakeEnabled = isChecked
                }
            }
            .setPositiveButton("Done", null)
            .show()
    }
}
