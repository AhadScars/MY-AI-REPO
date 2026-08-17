package com.digihub.arrowescape.data

import android.content.Context
import android.content.SharedPreferences

class SaveData(context: Context) {
    private val prefs: SharedPreferences =
        context.getSharedPreferences("arrow_escape_save", Context.MODE_PRIVATE)

    var coins: Int
        get() = prefs.getInt("coins", 0)
        set(v) = prefs.edit().putInt("coins", v).apply()

    var xp: Int
        get() = prefs.getInt("xp", 0)
        set(v) = prefs.edit().putInt("xp", v).apply()

    var highestLevel: Int
        get() = prefs.getInt("highestLevel", 1)
        set(v) = prefs.edit().putInt("highestLevel", v).apply()

    var levelsCompleted: Int
        get() = prefs.getInt("levelsCompleted", 0)
        set(v) = prefs.edit().putInt("levelsCompleted", v).apply()

    var perfectLevels: Int
        get() = prefs.getInt("perfectLevels", 0)
        set(v) = prefs.edit().putInt("perfectLevels", v).apply()

    var arrowsRemoved: Int
        get() = prefs.getInt("arrowsRemoved", 0)
        set(v) = prefs.edit().putInt("arrowsRemoved", v).apply()

    var heartsLost: Int
        get() = prefs.getInt("heartsLost", 0)
        set(v) = prefs.edit().putInt("heartsLost", v).apply()

    var currentStreak: Int
        get() = prefs.getInt("currentStreak", 0)
        set(v) = prefs.edit().putInt("currentStreak", v).apply()

    var longestStreak: Int
        get() = prefs.getInt("longestStreak", 0)
        set(v) = prefs.edit().putInt("longestStreak", v).apply()

    var coinsEarnedTotal: Int
        get() = prefs.getInt("coinsEarnedTotal", 0)
        set(v) = prefs.edit().putInt("coinsEarnedTotal", v).apply()

    var soundEnabled: Boolean
        get() = prefs.getBoolean("sound", true)
        set(v) = prefs.edit().putBoolean("sound", v).apply()

    var musicEnabled: Boolean
        get() = prefs.getBoolean("music", true)
        set(v) = prefs.edit().putBoolean("music", v).apply()

    var shakeEnabled: Boolean
        get() = prefs.getBoolean("shake", true)
        set(v) = prefs.edit().putBoolean("shake", v).apply()

    fun isLevelUnlocked(level: Int) = level <= highestLevel

    fun getStars(level: Int) = prefs.getInt("stars_$level", 0)

    fun completeLevel(level: Int, heartsLeft: Int, arrows: Int): Pair<Int, Boolean> {
        val perfect = heartsLeft >= 3
        val stars = when {
            perfect -> 3
            heartsLeft == 2 -> 2
            else -> 1
        }
        levelsCompleted++
        arrowsRemoved += arrows
        heartsLost += (3 - heartsLeft.coerceAtMost(3)).coerceAtLeast(0)
        currentStreak++
        if (currentStreak > longestStreak) longestStreak = currentStreak
        if (level + 1 > highestLevel) highestLevel = level + 1
        if (perfect) perfectLevels++
        if (stars > getStars(level)) {
            prefs.edit().putInt("stars_$level", stars).apply()
        }
        return stars to perfect
    }

    fun failLevel() {
        currentStreak = 0
    }

    fun addCoins(n: Int) {
        coins += n
        if (n > 0) coinsEarnedTotal += n
    }

    fun addXp(n: Int) {
        xp += n
    }
}
