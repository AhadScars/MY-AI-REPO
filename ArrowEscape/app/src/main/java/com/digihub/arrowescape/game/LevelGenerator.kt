package com.digihub.arrowescape.game

import com.digihub.arrowescape.data.Dir
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.floor
import kotlin.math.hypot
import kotlin.math.pow

data class Cell(val x: Int, val y: Int)
data class ArrowData(val x: Int, val y: Int, val dir: Dir, val id: String)
data class LevelData(
    val level: Int,
    val shapeId: String,
    val shapeName: String,
    val arrows: List<ArrowData>
)

private fun key(x: Int, y: Int) = "$x,$y"

private class Rng(seed: Int) {
    private var s = seed
    fun next(): Float {
        s = s * 1664525 + 1013904223
        return ((s ushr 8) and 0xFFFFFF) / 16777216f
    }
    fun int(bound: Int) = if (bound <= 0) 0 else floor(next() * bound).toInt().coerceIn(0, bound - 1)
}

object LevelGenerator {

    fun generate(level: Int): LevelData {
        var offset = 0
        while (offset <= 14) {
            val data = generateOnce(level, offset)
            if (isSolvable(data.arrows)) return data
            offset++
        }
        return trivial(level)
    }

    private fun generateOnce(level: Int, offset: Int): LevelData {
        val rng = Rng(level * 7919 + 104729 + offset * 99991)
        val shape = ShapeGenerator.forLevel(level + if (offset == 0) 0 else offset * 17)
        val cells = shape.cells
        val remaining = LinkedHashMap<String, Cell>()
        cells.forEach { remaining[key(it.x, it.y)] = it }
        val assign = HashMap<String, Dir>()

        var guard = 0
        while (remaining.isNotEmpty() && guard++ < cells.size * 25) {
            val candidates = ArrayList<Triple<String, Cell, Dir>>()
            for ((k, pos) in remaining) {
                for (dir in Dir.all) {
                    if (isPathClear(pos.x, pos.y, dir, remaining.keys)) {
                        candidates.add(Triple(k, pos, dir))
                    }
                }
            }
            if (candidates.isEmpty()) {
                val forced = forceAssign(remaining, rng) ?: break
                assign[forced.first] = forced.second
                remaining.remove(forced.first)
                continue
            }
            val pick = candidates[rng.int(candidates.size)]
            assign[pick.first] = pick.third
            remaining.remove(pick.first)
        }
        for ((k, _) in remaining) {
            assign[k] = Dir.all[rng.int(4)]
        }

        val arrows = cells.map {
            val id = key(it.x, it.y)
            ArrowData(it.x, it.y, assign[id] ?: Dir.UP, id)
        }
        return LevelData(level, shape.id, shape.name, arrows)
    }

    fun isPathClear(x: Int, y: Int, dir: Dir, occupied: Set<String>): Boolean {
        var cx = x + dir.dx
        var cy = y + dir.dy
        repeat(48) {
            if (key(cx, cy) in occupied) return false
            cx += dir.dx
            cy += dir.dy
        }
        return true
    }

    fun isSolvable(arrows: List<ArrowData>): Boolean {
        val rem = arrows.associateBy { it.id }.toMutableMap()
        repeat(arrows.size + 5) {
            if (rem.isEmpty()) return true
            val keys = rem.keys.toList()
            var found: String? = null
            for (id in keys) {
                val a = rem[id]!!
                if (isPathClear(a.x, a.y, a.dir, rem.keys)) {
                    found = id
                    break
                }
            }
            if (found == null) return false
            rem.remove(found)
        }
        return rem.isEmpty()
    }

    private fun forceAssign(remaining: Map<String, Cell>, rng: Rng): Pair<String, Dir>? {
        var best: Pair<String, Dir>? = null
        var bestScore = -1
        for ((k, pos) in remaining) {
            for (dir in Dir.all) {
                var score = 0
                var cx = pos.x + dir.dx
                var cy = pos.y + dir.dy
                var blocked = false
                repeat(16) {
                    if (key(cx, cy) in remaining) {
                        blocked = true
                        return@repeat
                    }
                    score++
                    cx += dir.dx
                    cy += dir.dy
                }
                if (!blocked && score > bestScore) {
                    bestScore = score
                    best = k to dir
                }
            }
        }
        if (best != null) return best
        val first = remaining.entries.firstOrNull() ?: return null
        return first.key to Dir.all[rng.int(4)]
    }

    private fun trivial(level: Int) = LevelData(
        level, "square", "Square",
        listOf(
            ArrowData(0, 0, Dir.LEFT, "0,0"),
            ArrowData(1, 0, Dir.RIGHT, "1,0"),
            ArrowData(0, 1, Dir.LEFT, "0,1"),
            ArrowData(1, 1, Dir.RIGHT, "1,1"),
        )
    )
}

data class ShapeInfo(val id: String, val name: String, val cells: List<Cell>)

object ShapeGenerator {
    fun forLevel(level: Int): ShapeInfo {
        val rng = Rng(level * 9973 + 42)
        val simple = listOf("square", "rectangle", "block", "slab", "triangle", "diamond", "cross", "circle")
        val medium = listOf("heart", "star", "letter_a", "letter_h", "pawn", "sword", "shield", "car", "gift")
        val complex = listOf("rook", "knight", "king", "queen", "house", "tree", "rocket", "airplane", "castle", "flower", "snowflake", "spiral", "cat", "abstract")

        val pool = when {
            level <= 5 -> simple
            level <= 15 -> if (rng.next() < 0.55f) simple else medium
            level <= 40 -> {
                val r = rng.next()
                when {
                    r < 0.25f -> simple
                    r < 0.65f -> medium
                    else -> complex
                }
            }
            else -> {
                val r = rng.next()
                when {
                    r < 0.15f -> simple
                    r < 0.45f -> medium
                    else -> complex
                }
            }
        }
        val id = pool[rng.int(pool.size)]
        var cells = center(build(id, level, rng))
        val max = when {
            level <= 5 -> 14
            level <= 15 -> 24
            else -> 40
        }
        if (cells.size > max) cells = center(rect(if (level <= 5) 3 else 4, if (level <= 5) 2 else 3))
        if (cells.size < 4) cells = center(rect(2, 2))
        return ShapeInfo(id, nameOf(id), cells)
    }

    private fun nameOf(id: String) = id.replace('_', ' ').replaceFirstChar { it.uppercase() }

    private fun center(cells: List<Cell>): List<Cell> {
        if (cells.isEmpty()) return cells
        val cx = (cells.minOf { it.x } + cells.maxOf { it.x }) / 2
        val cy = (cells.minOf { it.y } + cells.maxOf { it.y }) / 2
        return cells.map { Cell(it.x - cx, it.y - cy) }.distinctBy { key(it.x, it.y) }
    }

    private fun rect(w: Int, h: Int): List<Cell> {
        val list = ArrayList<Cell>()
        for (x in 0 until w) for (y in 0 until h) list.add(Cell(x, y))
        return list
    }

    private fun build(id: String, level: Int, rng: Rng): List<Cell> = when (id) {
        "square" -> rect(if (level < 4) 2 else 3, if (level < 4) 2 else 3)
        "rectangle" -> rect(if (level < 6) 3 else 5, 2)
        "block" -> rect(if (level < 8) 3 else 4, if (level < 8) 3 else 4)
        "slab" -> rect(if (level < 6) 4 else 5, 2)
        "triangle" -> triangle(if (level < 8) 3 else 4)
        "diamond" -> diamond(if (level < 10) 2 else 3)
        "cross" -> cross()
        "circle" -> circle(if (level < 10) 2 else 3)
        "heart" -> heart(if (level < 12) 3 else 4)
        "star" -> star()
        "letter_a" -> pattern(listOf("01110", "10001", "10001", "11111", "10001", "10001", "10001"))
        "letter_h" -> pattern(listOf("10001", "10001", "10001", "11111", "10001", "10001", "10001"))
        "pawn" -> listOf(
            Cell(0, 0), Cell(1, 0), Cell(2, 0), Cell(3, 0), Cell(4, 0),
            Cell(1, 1), Cell(2, 1), Cell(3, 1), Cell(2, 2), Cell(2, 3),
            Cell(1, 4), Cell(2, 4), Cell(3, 4), Cell(2, 5)
        )
        "rook" -> listOf(
            Cell(0, 0), Cell(1, 0), Cell(2, 0), Cell(3, 0), Cell(4, 0),
            Cell(1, 1), Cell(2, 1), Cell(3, 1), Cell(1, 2), Cell(2, 2), Cell(3, 2),
            Cell(0, 3), Cell(1, 3), Cell(2, 3), Cell(3, 3), Cell(4, 3),
            Cell(0, 4), Cell(2, 4), Cell(4, 4)
        )
        "knight" -> listOf(
            Cell(0, 0), Cell(1, 0), Cell(2, 0), Cell(3, 0),
            Cell(1, 1), Cell(2, 1), Cell(1, 2), Cell(2, 2),
            Cell(1, 3), Cell(2, 3), Cell(3, 3), Cell(2, 4), Cell(3, 4), Cell(2, 5), Cell(3, 5)
        )
        "king" -> listOf(
            Cell(0, 0), Cell(1, 0), Cell(2, 0), Cell(3, 0), Cell(4, 0),
            Cell(1, 1), Cell(2, 1), Cell(3, 1), Cell(1, 2), Cell(2, 2), Cell(3, 2),
            Cell(2, 3), Cell(2, 4), Cell(1, 4), Cell(3, 4), Cell(2, 5)
        )
        "queen" -> listOf(
            Cell(0, 0), Cell(1, 0), Cell(2, 0), Cell(3, 0), Cell(4, 0),
            Cell(1, 1), Cell(2, 1), Cell(3, 1), Cell(1, 2), Cell(2, 2), Cell(3, 2),
            Cell(0, 3), Cell(2, 3), Cell(4, 3), Cell(2, 4)
        )
        "sword" -> listOf(
            Cell(1, 0), Cell(1, 1), Cell(0, 2), Cell(1, 2), Cell(2, 2),
            Cell(1, 3), Cell(1, 4), Cell(1, 5), Cell(1, 6), Cell(1, 7)
        )
        "shield" -> (0 until 5).flatMap { y ->
            val inset = if (y >= 3) y - 2 else 0
            (inset until 5 - inset).map { x -> Cell(x, y) }
        }
        "car" -> listOf(
            Cell(0, 0), Cell(1, 0), Cell(2, 0), Cell(3, 0), Cell(4, 0), Cell(5, 0),
            Cell(1, 1), Cell(2, 1), Cell(3, 1), Cell(4, 1)
        )
        "gift" -> rect(4, 3) + listOf(Cell(1, 3), Cell(2, 3))
        "house" -> rect(5, 3) + listOf(
            Cell(0, 3), Cell(1, 3), Cell(2, 3), Cell(3, 3), Cell(4, 3),
            Cell(1, 4), Cell(2, 4), Cell(3, 4), Cell(2, 5)
        )
        "tree" -> listOf(Cell(2, 0), Cell(2, 1)) +
            (2..4).flatMap { y -> (4 - y..y).map { x -> Cell(x, y) } } + Cell(2, 5)
        "rocket" -> listOf(
            Cell(0, 0), Cell(2, 0), Cell(0, 1), Cell(1, 1), Cell(2, 1),
            Cell(1, 2), Cell(1, 3), Cell(1, 4), Cell(1, 5), Cell(1, 6)
        )
        "airplane" -> (0 until 7).map { Cell(it, 1) } + (0 until 5).map { Cell(3, it) } +
            listOf(Cell(0, 2), Cell(1, 2))
        "castle" -> rect(7, 3) + (0 until 5).flatMap { y -> listOf(Cell(0, y), Cell(6, y)) } +
            listOf(Cell(0, 5), Cell(6, 5))
        "flower" -> {
            val petals = listOf(0 to 2, 0 to -2, 2 to 0, -2 to 0, 1 to 1, 1 to -1, -1 to 1, -1 to -1)
            val list = ArrayList<Cell>()
            for ((px, py) in petals) {
                for (x in -1..1) for (y in -1..1)
                    if (x * x + y * y <= 1) list.add(Cell(3 + px + x, 3 + py + y))
            }
            list.add(Cell(3, 3))
            list.addAll(listOf(Cell(3, 0), Cell(3, 1), Cell(3, 2)))
            list
        }
        "snowflake" -> {
            val c = 4
            val list = ArrayList<Cell>()
            for (i in -4..4) {
                list.add(Cell(c + i, c)); list.add(Cell(c, c + i))
                list.add(Cell(c + i, c + i)); list.add(Cell(c + i, c - i))
            }
            list
        }
        "spiral" -> {
            var x = 0; var y = 0; var dx = 1; var dy = 0
            var leg = 1; var passed = 0; var legCount = 0
            val list = ArrayList<Cell>()
            repeat(25) {
                list.add(Cell(x + 5, y + 5))
                x += dx; y += dy; passed++
                if (passed == leg) {
                    passed = 0
                    val ndx = -dy; val ndy = dx
                    dx = ndx; dy = ndy
                    legCount++
                    if (legCount == 2) { legCount = 0; leg++ }
                }
            }
            list
        }
        "cat" -> listOf(
            Cell(0, 0), Cell(1, 0), Cell(2, 0), Cell(0, 1), Cell(1, 1), Cell(2, 1),
            Cell(3, 1), Cell(3, 2), Cell(4, 2), Cell(3, 3), Cell(4, 3),
            Cell(-1, 1), Cell(-1, 2)
        )
        "abstract" -> {
            var x = 0; var y = 0
            val list = ArrayList<Cell>()
            list.add(Cell(0, 0))
            repeat(10 + rng.int(14)) {
                if (rng.next() < 0.5f) x += if (rng.next() < 0.5f) -1 else 1
                else y += if (rng.next() < 0.5f) -1 else 1
                x = x.coerceIn(-4, 4); y = y.coerceIn(0, 6)
                list.add(Cell(x, y))
            }
            list
        }
        else -> rect(3, 3)
    }

    private fun pattern(rows: List<String>): List<Cell> {
        val list = ArrayList<Cell>()
        val h = rows.size
        for (y in 0 until h) {
            val row = rows[h - 1 - y]
            for (x in row.indices) if (row[x] == '1') list.add(Cell(x, y))
        }
        return list
    }

    private fun triangle(size: Int): List<Cell> {
        val list = ArrayList<Cell>()
        for (y in 0 until size) {
            for (x in size - 1 - y..size - 1 + y) list.add(Cell(x, y))
        }
        return list
    }

    private fun diamond(r: Int): List<Cell> {
        val list = ArrayList<Cell>()
        for (x in -r..r) for (y in -r..r)
            if (abs(x) + abs(y) <= r) list.add(Cell(x + r, y + r))
        return list
    }

    private fun cross(): List<Cell> {
        val list = ArrayList<Cell>()
        val n = 5
        val mid = 2
        for (i in 0 until n) {
            list.add(Cell(mid, i)); list.add(Cell(i, mid))
        }
        return list
    }

    private fun circle(r: Int): List<Cell> {
        val list = ArrayList<Cell>()
        for (x in -r..r) for (y in -r..r)
            if (hypot(x.toDouble(), y.toDouble()) <= r + 0.2) list.add(Cell(x + r, y + r))
        return list
    }

    private fun heart(size: Int): List<Cell> {
        val list = ArrayList<Cell>()
        for (x in -size..size) for (y in -size..size + 1) {
            val nx = x.toDouble() / size
            val ny = (y - 0.3) / size
            val v = (nx * nx + ny * ny - 1).pow(3) - nx * nx * ny * ny * ny
            if (v <= 0.05) list.add(Cell(x + size, y + size))
        }
        return list
    }

    private fun star(): List<Cell> {
        val rOuter = 4.0; val rInner = 1.7; val arms = 5
        val list = ArrayList<Cell>()
        for (x in -4..4) for (y in -4..4) {
            val ang = atan2(y.toDouble(), x.toDouble())
            val r = hypot(x.toDouble(), y.toDouble())
            val sector = abs(((ang + Math.PI) % (Math.PI * 2 / arms)) - Math.PI / arms)
            val limit = rInner + (rOuter - rInner) * (1 - sector / (Math.PI / arms))
            if (r <= limit + 0.35) list.add(Cell(x + 4, y + 4))
        }
        return list
    }
}
