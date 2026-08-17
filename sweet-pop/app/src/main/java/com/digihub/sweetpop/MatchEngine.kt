package com.digihub.sweetpop

import kotlin.random.Random

enum class CandyType(val colorIndex: Int) {
    RED(0), ORANGE(1), YELLOW(2), GREEN(3), BLUE(4), PURPLE(5);

    companion object {
        fun random(rng: Random = Random.Default): CandyType =
            entries[rng.nextInt(entries.size)]
    }
}

data class Cell(var type: CandyType?, var id: Long = nextId()) {
    companion object {
        private var seq = 1L
        fun nextId(): Long = seq++
    }
}

data class GridPos(val row: Int, val col: Int)

data class MatchGroup(val cells: List<GridPos>, val type: CandyType)

data class LevelConfig(
    val level: Int,
    val rows: Int = 8,
    val cols: Int = 8,
    val moves: Int,
    val targetScore: Int
) {
    companion object {
        fun forLevel(level: Int): LevelConfig {
            val lv = level.coerceAtLeast(1)
            return LevelConfig(
                level = lv,
                moves = (28 - (lv - 1) * 1).coerceIn(14, 28),
                targetScore = 800 + (lv - 1) * 350 + (lv - 1) * (lv - 1) * 40
            )
        }
    }
}

/**
 * Pure match-3 rules: board generation, matching, gravity, refill.
 * No Android dependencies — easy to reason about and test.
 */
class MatchEngine(
    val config: LevelConfig,
    private val rng: Random = Random.Default
) {
    val rows = config.rows
    val cols = config.cols
    val board: Array<Array<Cell?>> = Array(rows) { Array(cols) { null } }

    var score: Int = 0
        private set
    var movesLeft: Int = config.moves
        private set
    var combo: Int = 0
        private set

    val targetScore: Int get() = config.targetScore
    val isWon: Boolean get() = score >= targetScore
    val isLost: Boolean get() = movesLeft <= 0 && !isWon

    fun fillWithoutMatches() {
        for (r in 0 until rows) {
            for (c in 0 until cols) {
                board[r][c] = Cell(randomSafeType(r, c))
            }
        }
        // Safety: clear any residual matches
        var guard = 0
        while (findMatches().isNotEmpty() && guard++ < 40) {
            findMatches().flatMap { it.cells }.forEach { (r, c) ->
                board[r][c] = Cell(randomSafeType(r, c))
            }
        }
    }

    fun trySwap(a: GridPos, b: GridPos): Boolean {
        if (!isAdjacent(a, b)) return false
        if (board[a.row][a.col] == null || board[b.row][b.col] == null) return false
        swap(a, b)
        val matches = findMatches()
        if (matches.isEmpty()) {
            swap(a, b) // revert
            return false
        }
        movesLeft = (movesLeft - 1).coerceAtLeast(0)
        combo = 0
        return true
    }

    fun findMatches(): List<MatchGroup> {
        val visited = Array(rows) { BooleanArray(cols) }
        val groups = mutableListOf<MatchGroup>()

        // Horizontal
        for (r in 0 until rows) {
            var c = 0
            while (c < cols) {
                val t = board[r][c]?.type
                if (t == null) { c++; continue }
                var end = c + 1
                while (end < cols && board[r][end]?.type == t) end++
                if (end - c >= 3) {
                    val cells = (c until end).map { GridPos(r, it) }
                    cells.forEach { visited[it.row][it.col] = true }
                    groups += MatchGroup(cells, t)
                }
                c = end
            }
        }
        // Vertical
        for (c in 0 until cols) {
            var r = 0
            while (r < rows) {
                val t = board[r][c]?.type
                if (t == null) { r++; continue }
                var end = r + 1
                while (end < rows && board[end][c]?.type == t) end++
                if (end - r >= 3) {
                    val cells = (r until end).map { GridPos(it, c) }
                    // merge with existing if overlapping
                    val newCells = cells.filter { !visited[it.row][it.col] }
                    cells.forEach { visited[it.row][it.col] = true }
                    if (cells.isNotEmpty()) {
                        groups += MatchGroup(cells, t)
                    }
                }
                r = end
            }
        }
        return groups
    }

    /** Clear matches, award score. Returns cleared positions. */
    fun clearMatches(matches: List<MatchGroup>): List<GridPos> {
        if (matches.isEmpty()) return emptyList()
        combo++
        val cleared = linkedSetOf<GridPos>()
        matches.forEach { g ->
            val base = when {
                g.cells.size >= 5 -> 120
                g.cells.size == 4 -> 80
                else -> 50
            }
            score += base * g.cells.size * combo
            cleared.addAll(g.cells)
        }
        cleared.forEach { (r, c) -> board[r][c] = null }
        return cleared.toList()
    }

    /**
     * Apply gravity. Returns list of falls: (fromRow, col, toRow, cell).
     */
    data class Fall(val fromRow: Int, val col: Int, val toRow: Int, val cell: Cell)

    fun applyGravity(): List<Fall> {
        val falls = mutableListOf<Fall>()
        for (c in 0 until cols) {
            var write = rows - 1
            for (r in rows - 1 downTo 0) {
                val cell = board[r][c]
                if (cell != null) {
                    if (r != write) {
                        board[write][c] = cell
                        board[r][c] = null
                        falls += Fall(r, c, write, cell)
                    }
                    write--
                }
            }
        }
        return falls
    }

    data class Spawn(val row: Int, val col: Int, val cell: Cell)

    /** Fill empty cells from top. */
    fun refill(): List<Spawn> {
        val spawns = mutableListOf<Spawn>()
        for (c in 0 until cols) {
            for (r in 0 until rows) {
                if (board[r][c] == null) {
                    val cell = Cell(CandyType.random(rng))
                    board[r][c] = cell
                    spawns += Spawn(r, c, cell)
                }
            }
        }
        return spawns
    }

    private fun swap(a: GridPos, b: GridPos) {
        val tmp = board[a.row][a.col]
        board[a.row][a.col] = board[b.row][b.col]
        board[b.row][b.col] = tmp
    }

    private fun isAdjacent(a: GridPos, b: GridPos): Boolean {
        val dr = kotlin.math.abs(a.row - b.row)
        val dc = kotlin.math.abs(a.col - b.col)
        return (dr + dc) == 1
    }

    private fun randomSafeType(r: Int, c: Int): CandyType {
        var guard = 0
        while (true) {
            val t = CandyType.random(rng)
            val left1 = if (c >= 1) board[r][c - 1]?.type else null
            val left2 = if (c >= 2) board[r][c - 2]?.type else null
            val up1 = if (r >= 1) board[r - 1][c]?.type else null
            val up2 = if (r >= 2) board[r - 2][c]?.type else null
            val hMatch = left1 == t && left2 == t
            val vMatch = up1 == t && up2 == t
            if (!hMatch && !vMatch) return t
            if (++guard > 20) return t
        }
    }
}
