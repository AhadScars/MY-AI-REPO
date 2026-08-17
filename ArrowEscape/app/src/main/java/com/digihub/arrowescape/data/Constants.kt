package com.digihub.arrowescape.data

import android.graphics.Color

enum class Dir(val dx: Int, val dy: Int) {
    UP(0, 1),
    DOWN(0, -1),
    LEFT(-1, 0),
    RIGHT(1, 0);

    companion object {
        val all = entries
    }
}

data class Theme(
    val id: String,
    val name: String,
    val unlockLevel: Int,
    val bgTop: Int,
    val bgBottom: Int,
    val accent: Int,
    val block: Int,
    val glow: Int
)

object Themes {
    val all = listOf(
        Theme("forest", "Forest", 1, Color.parseColor("#0F2418"), Color.parseColor("#1A3D28"), Color.parseColor("#6BCF7F"), Color.parseColor("#2D6B45"), Color.parseColor("#8DFFB0")),
        Theme("beach", "Beach", 5, Color.parseColor("#0E2A38"), Color.parseColor("#1A4A5C"), Color.parseColor("#5EC8E8"), Color.parseColor("#3D8A9E"), Color.parseColor("#9AE8FF")),
        Theme("space", "Space", 10, Color.parseColor("#080814"), Color.parseColor("#12122A"), Color.parseColor("#9B7BFF"), Color.parseColor("#3D2D7A"), Color.parseColor("#C4B0FF")),
        Theme("desert", "Desert", 15, Color.parseColor("#2A1E12"), Color.parseColor("#3D2E1A"), Color.parseColor("#F0C27A"), Color.parseColor("#A67C3D"), Color.parseColor("#FFD89A")),
        Theme("ice", "Ice World", 20, Color.parseColor("#0E1E2E"), Color.parseColor("#1A3548"), Color.parseColor("#7EC8E3"), Color.parseColor("#4A8A9E"), Color.parseColor("#B8E8FF")),
        Theme("candy", "Candy Land", 25, Color.parseColor("#2A1230"), Color.parseColor("#3D1A48"), Color.parseColor("#FF6BCB"), Color.parseColor("#B84A90"), Color.parseColor("#FFB0E0")),
        Theme("cyber", "Cyber City", 30, Color.parseColor("#060A14"), Color.parseColor("#0C1830"), Color.parseColor("#00F0FF"), Color.parseColor("#1A4A5C"), Color.parseColor("#7AFFFF")),
        Theme("volcano", "Volcano", 40, Color.parseColor("#1A0806"), Color.parseColor("#2E100C"), Color.parseColor("#FF5A1F"), Color.parseColor("#8A3020"), Color.parseColor("#FF9A60")),
    )

    fun get(id: String) = all.find { it.id == id } ?: all[0]

    fun forLevel(level: Int): Theme {
        return all.filter { level >= it.unlockLevel }.maxByOrNull { it.unlockLevel } ?: all[0]
    }
}

object GameConstants {
    const val CELL = 72f
    const val MAX_HEARTS = 3
    const val TOTAL_LEVELS = 200

    fun coinsForLevel(level: Int, heartsLeft: Int, perfect: Boolean): Int {
        val base = 10 + level / 5 * 2
        return base + heartsLeft * 5 + if (perfect) 15 else 0
    }

    fun xpForLevel(level: Int, perfect: Boolean): Int {
        return 20 + level / 3 + if (perfect) 10 else 0
    }
}
