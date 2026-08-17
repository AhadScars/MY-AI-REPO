package com.digihub.sweetpop

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.RadialGradient
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface
import android.os.SystemClock
import android.util.AttributeSet
import android.view.MotionEvent
import android.view.View
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.sin
import kotlin.math.sqrt
import kotlin.random.Random

/**
 * Custom match-3 board with springy physics:
 * - Gravity falls with ease-out bounce
 * - Match pop scale + particle bursts
 * - Smooth swap lerp
 * - Soft selection pulse
 */
class GameView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : View(context, attrs) {

    interface Listener {
        fun onScoreChanged(score: Int, target: Int, moves: Int)
        fun onLevelEnded(won: Boolean, score: Int)
        fun onCombo(combo: Int)
    }

    var listener: Listener? = null
    var sound: SoundManager? = null

    private var engine: MatchEngine? = null
    private var rows = 8
    private var cols = 8

    // Layout
    private var cellSize = 0f
    private var boardLeft = 0f
    private var boardTop = 0f
    private var boardRadius = 28f
    private val boardPad = 12f

    // Visual candy state keyed by cell id
    private data class CandyVisual(
        var type: CandyType,
        var row: Int,
        var col: Int,
        var x: Float,
        var y: Float,
        var vx: Float = 0f,
        var vy: Float = 0f,
        var scale: Float = 1f,
        var alpha: Float = 1f,
        var targetX: Float = 0f,
        var targetY: Float = 0f,
        var popping: Boolean = false,
        var popT: Float = 0f,
        var spawnT: Float = 1f,
        var id: Long
    )

    private val visuals = mutableMapOf<Long, CandyVisual>()
    private val particles = mutableListOf<Particle>()

    private data class Particle(
        var x: Float,
        var y: Float,
        var vx: Float,
        var vy: Float,
        var life: Float,
        var maxLife: Float,
        var color: Int,
        var size: Float
    )

    private var selected: GridPos? = null
    private var touchDown: GridPos? = null
    private var touchStartX = 0f
    private var touchStartY = 0f
    private var inputLocked = false
    private var gameOver = false

    private var lastFrame = 0L
    private var pulsePhase = 0f
    private var cascadeRunning = false

    // Paints
    private val boardPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#99140A28")
    }
    private val boardStroke = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = 2.5f
        color = Color.parseColor("#55FFB6E0")
    }
    private val cellPaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val candyPaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val glossPaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val shadowPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#55000000")
    }
    private val selectPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = 5f
        color = Color.parseColor("#FFFFD56B")
    }
    private val particlePaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE
        textAlign = Paint.Align.CENTER
        typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
    }

    private val candyColors = intArrayOf(
        Color.parseColor("#FFFF4D6D"), // red
        Color.parseColor("#FFFF9F43"), // orange
        Color.parseColor("#FFFFD93D"), // yellow
        Color.parseColor("#FF6BCB77"), // green
        Color.parseColor("#FF4D96FF"), // blue
        Color.parseColor("#FFB388FF")  // purple
    )
    private val candyColorsDark = intArrayOf(
        Color.parseColor("#FFC2185B"),
        Color.parseColor("#FFE65100"),
        Color.parseColor("#FFF9A825"),
        Color.parseColor("#FF2E7D32"),
        Color.parseColor("#FF1565C0"),
        Color.parseColor("#FF6A1B9A")
    )

    private val boardRect = RectF()
    private val tmpRect = RectF()
    private val rng = Random(System.nanoTime())

    fun startLevel(level: Int) {
        val cfg = LevelConfig.forLevel(level)
        engine = MatchEngine(cfg).also {
            it.fillWithoutMatches()
            rows = it.rows
            cols = it.cols
        }
        selected = null
        touchDown = null
        inputLocked = false
        gameOver = false
        cascadeRunning = false
        particles.clear()
        rebuildVisuals(animateSpawn = true)
        notifyHud()
        lastFrame = 0L
        invalidate()
    }

    private fun rebuildVisuals(animateSpawn: Boolean) {
        visuals.clear()
        val e = engine ?: return
        ensureLayout()
        for (r in 0 until rows) {
            for (c in 0 until cols) {
                val cell = e.board[r][c] ?: continue
                val (x, y) = cellCenter(r, c)
                visuals[cell.id] = CandyVisual(
                    type = cell.type!!,
                    row = r,
                    col = c,
                    x = x,
                    y = if (animateSpawn) y - cellSize * (rows - r + 2) else y,
                    targetX = x,
                    targetY = y,
                    scale = if (animateSpawn) 0.4f else 1f,
                    spawnT = if (animateSpawn) 0f else 1f,
                    id = cell.id,
                    vy = if (animateSpawn) 40f else 0f
                )
            }
        }
        if (animateSpawn) {
            inputLocked = true
            postDelayed({
                // unlock after initial drop settles
            }, 50)
        }
    }

    private fun ensureLayout() {
        if (width == 0 || height == 0) return
        val pad = boardPad * 2
        val size = min(width - pad, height - pad)
        cellSize = size / cols.toFloat()
        val boardW = cellSize * cols
        val boardH = cellSize * rows
        boardLeft = (width - boardW) / 2f
        boardTop = (height - boardH) / 2f
        boardRect.set(boardLeft - 8f, boardTop - 8f, boardLeft + boardW + 8f, boardTop + boardH + 8f)
    }

    private fun cellCenter(row: Int, col: Int): Pair<Float, Float> {
        val x = boardLeft + col * cellSize + cellSize / 2f
        val y = boardTop + row * cellSize + cellSize / 2f
        return x to y
    }

    private fun posAt(x: Float, y: Float): GridPos? {
        if (cellSize <= 0f) return null
        val c = ((x - boardLeft) / cellSize).toInt()
        val r = ((y - boardTop) / cellSize).toInt()
        if (r !in 0 until rows || c !in 0 until cols) return null
        return GridPos(r, c)
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        super.onSizeChanged(w, h, oldw, oldh)
        ensureLayout()
        // re-target positions
        visuals.values.forEach { v ->
            val (x, y) = cellCenter(v.row, v.col)
            v.targetX = x
            v.targetY = y
            if (!cascadeRunning && abs(v.vy) < 1f && abs(v.vx) < 1f) {
                v.x = x
                v.y = y
            }
        }
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        ensureLayout()
        val now = SystemClock.uptimeMillis()
        val dt = if (lastFrame == 0L) 0.016f else ((now - lastFrame) / 1000f).coerceIn(0.001f, 0.05f)
        lastFrame = now
        pulsePhase += dt

        updatePhysics(dt)

        // Board background
        canvas.drawRoundRect(boardRect, boardRadius, boardRadius, boardPaint)
        canvas.drawRoundRect(boardRect, boardRadius, boardRadius, boardStroke)

        // Cell checkers
        for (r in 0 until rows) {
            for (c in 0 until cols) {
                val left = boardLeft + c * cellSize
                val top = boardTop + r * cellSize
                tmpRect.set(left + 3f, top + 3f, left + cellSize - 3f, top + cellSize - 3f)
                cellPaint.color = if ((r + c) % 2 == 0) Color.parseColor("#22FFFFFF") else Color.parseColor("#11000000")
                canvas.drawRoundRect(tmpRect, 12f, 12f, cellPaint)
            }
        }

        // Selection ring
        selected?.let { sel ->
            val (sx, sy) = cellCenter(sel.row, sel.col)
            val pulse = 1f + 0.06f * sin(pulsePhase * 6f)
            val rad = (cellSize * 0.42f) * pulse
            selectPaint.alpha = (180 + 60 * sin(pulsePhase * 6f)).toInt().coerceIn(100, 255)
            canvas.drawCircle(sx, sy, rad, selectPaint)
        }

        // Candies (draw higher y first for depth)
        val sorted = visuals.values.sortedBy { it.y }
        for (v in sorted) {
            drawCandy(canvas, v)
        }

        // Particles
        for (p in particles) {
            val a = (p.life / p.maxLife).coerceIn(0f, 1f)
            particlePaint.color = p.color
            particlePaint.alpha = (a * 255).toInt()
            canvas.drawCircle(p.x, p.y, p.size * a, particlePaint)
        }

        // Floating combo text handled via particles-ish scale on pops

        invalidate()
    }

    private fun drawCandy(canvas: Canvas, v: CandyVisual) {
        if (v.alpha <= 0.01f) return
        val idx = v.type.colorIndex
        val baseR = cellSize * 0.36f * v.scale
        if (baseR < 1f) return

        // Drop shadow
        shadowPaint.alpha = (90 * v.alpha).toInt()
        canvas.drawCircle(v.x + 2f, v.y + cellSize * 0.06f, baseR * 0.92f, shadowPaint)

        // Body gradient
        val shader = RadialGradient(
            v.x - baseR * 0.28f,
            v.y - baseR * 0.32f,
            baseR * 1.35f,
            intArrayOf(lighten(candyColors[idx], 0.35f), candyColors[idx], candyColorsDark[idx]),
            floatArrayOf(0f, 0.45f, 1f),
            Shader.TileMode.CLAMP
        )
        candyPaint.shader = shader
        candyPaint.alpha = (255 * v.alpha).toInt()
        canvas.drawCircle(v.x, v.y, baseR, candyPaint)
        candyPaint.shader = null

        // Gloss highlight
        glossPaint.shader = RadialGradient(
            v.x - baseR * 0.25f,
            v.y - baseR * 0.3f,
            baseR * 0.55f,
            Color.argb((140 * v.alpha).toInt(), 255, 255, 255),
            Color.TRANSPARENT,
            Shader.TileMode.CLAMP
        )
        canvas.drawCircle(v.x - baseR * 0.15f, v.y - baseR * 0.2f, baseR * 0.42f, glossPaint)
        glossPaint.shader = null

        // Soft rim
        candyPaint.style = Paint.Style.STROKE
        candyPaint.strokeWidth = 2f
        candyPaint.color = Color.argb((60 * v.alpha).toInt(), 255, 255, 255)
        canvas.drawCircle(v.x, v.y, baseR, candyPaint)
        candyPaint.style = Paint.Style.FILL
    }

    private fun lighten(color: Int, amount: Float): Int {
        val a = Color.alpha(color)
        val r = (Color.red(color) + (255 - Color.red(color)) * amount).toInt().coerceIn(0, 255)
        val g = (Color.green(color) + (255 - Color.green(color)) * amount).toInt().coerceIn(0, 255)
        val b = (Color.blue(color) + (255 - Color.blue(color)) * amount).toInt().coerceIn(0, 255)
        return Color.argb(a, r, g, b)
    }

    private fun updatePhysics(dt: Float) {
        var anyMoving = false

        // Particles
        val pit = particles.iterator()
        while (pit.hasNext()) {
            val p = pit.next()
            p.life -= dt
            if (p.life <= 0f) {
                pit.remove()
                continue
            }
            p.vy += 900f * dt
            p.x += p.vx * dt
            p.y += p.vy * dt
            p.vx *= 0.98f
        }

        val spring = 18f
        val damping = 0.78f
        val popRemove = mutableListOf<Long>()

        for (v in visuals.values) {
            // Spawn intro
            if (v.spawnT < 1f) {
                v.spawnT = (v.spawnT + dt * 2.2f).coerceAtMost(1f)
                v.scale = 0.4f + 0.6f * easeOutBack(v.spawnT)
            }

            if (v.popping) {
                v.popT += dt * 3.2f
                v.scale = 1f + v.popT * 0.55f
                v.alpha = 1f - v.popT
                if (v.popT >= 1f) popRemove += v.id
                anyMoving = true
                continue
            }

            // Spring toward target (realistic soft body settle + bounce)
            val dx = v.targetX - v.x
            val dy = v.targetY - v.y
            v.vx += dx * spring * dt
            v.vy += dy * spring * dt
            // Extra gravity pull when far above target (fall feel)
            if (dy > cellSize * 0.15f) {
                v.vy += 1400f * dt
            }
            v.vx *= damping
            v.vy *= (if (dy > 0) 0.92f else damping)
            v.x += v.vx * dt
            v.y += v.vy * dt

            // Settle snap
            if (abs(dx) < 0.6f && abs(dy) < 0.6f && abs(v.vx) < 8f && abs(v.vy) < 8f) {
                v.x = v.targetX
                v.y = v.targetY
                v.vx = 0f
                v.vy = 0f
            } else {
                anyMoving = true
                // Bounce when crossing target from above
                if (v.y > v.targetY && v.vy > 40f && abs(dx) < cellSize * 0.3f) {
                    v.y = v.targetY
                    v.vy = -v.vy * 0.35f
                    v.scale = 1f + min(0.18f, abs(v.vy) / 800f)
                }
            }

            // Scale settle
            if (!v.popping && v.spawnT >= 1f) {
                v.scale += (1f - v.scale) * min(1f, dt * 10f)
            }
        }

        popRemove.forEach { visuals.remove(it) }

        // When cascade wait for settle then continue
        if (cascadeRunning && !anyMoving && popRemove.isEmpty()) {
            continueCascade()
        } else if (!cascadeRunning && !anyMoving && !gameOver) {
            // Initial drop finished
            if (inputLocked && particles.isEmpty()) {
                inputLocked = false
            }
        }
    }

    private fun easeOutBack(t: Float): Float {
        val c1 = 1.70158f
        val c3 = c1 + 1f
        val u = t - 1f
        return 1f + c3 * u * u * u + c1 * u * u
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        if (inputLocked || gameOver || engine == null) return true
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                touchStartX = event.x
                touchStartY = event.y
                touchDown = posAt(event.x, event.y)
                return true
            }
            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                val down = touchDown
                touchDown = null
                if (down == null) return true
                val dx = event.x - touchStartX
                val dy = event.y - touchStartY
                val dist = sqrt(dx * dx + dy * dy)
                if (dist > cellSize * 0.28f) {
                    // Swipe swap
                    val dir = if (abs(dx) > abs(dy)) {
                        if (dx > 0) GridPos(down.row, down.col + 1) else GridPos(down.row, down.col - 1)
                    } else {
                        if (dy > 0) GridPos(down.row + 1, down.col) else GridPos(down.row - 1, down.col)
                    }
                    if (dir.row in 0 until rows && dir.col in 0 until cols) {
                        attemptSwap(down, dir)
                    }
                } else {
                    // Tap select / swap
                    val sel = selected
                    if (sel == null) {
                        selected = down
                        sound?.playSelect()
                    } else if (sel == down) {
                        selected = null
                    } else if (isAdj(sel, down)) {
                        attemptSwap(sel, down)
                        selected = null
                    } else {
                        selected = down
                        sound?.playSelect()
                    }
                }
                invalidate()
                return true
            }
        }
        return super.onTouchEvent(event)
    }

    private fun isAdj(a: GridPos, b: GridPos) =
        abs(a.row - b.row) + abs(a.col - b.col) == 1

    private fun attemptSwap(a: GridPos, b: GridPos) {
        val e = engine ?: return
        // animate swap first visually
        val cellA = e.board[a.row][a.col] ?: return
        val cellB = e.board[b.row][b.col] ?: return
        val va = visuals[cellA.id] ?: return
        val vb = visuals[cellB.id] ?: return

        // Optimistic visual swap targets
        val (ax, ay) = cellCenter(b.row, b.col)
        val (bx, by) = cellCenter(a.row, a.col)
        va.targetX = ax; va.targetY = ay; va.row = b.row; va.col = b.col
        vb.targetX = bx; vb.targetY = by; vb.row = a.row; vb.col = a.col

        val ok = e.trySwap(a, b)
        if (!ok) {
            // revert visual
            val (rax, ray) = cellCenter(a.row, a.col)
            val (rbx, rby) = cellCenter(b.row, b.col)
            va.targetX = rax; va.targetY = ray; va.row = a.row; va.col = a.col
            vb.targetX = rbx; vb.targetY = rby; vb.row = b.row; vb.col = b.col
            // shake
            va.vx = if (a.col < b.col) -120f else 120f
            sound?.playInvalid()
            selected = null
            notifyHud()
            return
        }

        sound?.playSwap()
        selected = null
        notifyHud()
        inputLocked = true
        cascadeRunning = true
        // wait for swap settle then resolve matches
        postDelayed({ beginResolve() }, 180)
    }

    private fun beginResolve() {
        val e = engine ?: return
        val matches = e.findMatches()
        if (matches.isEmpty()) {
            finishTurn()
            return
        }
        val cleared = e.clearMatches(matches)
        sound?.playPop(e.combo)
        listener?.onCombo(e.combo)
        notifyHud()

        // Pop visuals + particles
        for (pos in cleared) {
            // find visual at this logical cell — after clear board is null, find by row/col
            val vis = visuals.values.firstOrNull { it.row == pos.row && it.col == pos.col && !it.popping }
            if (vis != null) {
                vis.popping = true
                vis.popT = 0f
                burst(vis.x, vis.y, candyColors[vis.type.colorIndex])
            }
        }
        // After pops animate, gravity will run in continueCascade
    }

    private fun continueCascade() {
        val e = engine ?: return
        // If there are still popping, wait
        if (visuals.values.any { it.popping }) return

        // Remove any orphaned (should already be removed)
        // Gravity
        val falls = e.applyGravity()
        if (falls.isNotEmpty()) {
            sound?.playFall()
            for (f in falls) {
                val v = visuals[f.cell.id] ?: continue
                v.row = f.toRow
                v.col = f.col
                val (tx, ty) = cellCenter(f.toRow, f.col)
                v.targetX = tx
                v.targetY = ty
                v.vy = 80f
            }
            // wait settle
            return
        }

        // Refill empties
        val spawns = e.refill()
        if (spawns.isNotEmpty()) {
            for (s in spawns) {
                val (tx, ty) = cellCenter(s.row, s.col)
                val startY = boardTop - cellSize * (2 + (rows - s.row))
                visuals[s.cell.id] = CandyVisual(
                    type = s.cell.type!!,
                    row = s.row,
                    col = s.col,
                    x = tx,
                    y = startY,
                    targetX = tx,
                    targetY = ty,
                    scale = 0.7f,
                    spawnT = 0.5f,
                    id = s.cell.id,
                    vy = 200f
                )
            }
            sound?.playFall()
            return
        }

        // Check new matches
        val matches = e.findMatches()
        if (matches.isNotEmpty()) {
            beginResolve()
        } else {
            finishTurn()
        }
    }

    private fun finishTurn() {
        cascadeRunning = false
        inputLocked = false
        notifyHud()
        val e = engine ?: return
        if (e.isWon) {
            gameOver = true
            sound?.playWin()
            listener?.onLevelEnded(true, e.score)
        } else if (e.isLost) {
            gameOver = true
            sound?.playLose()
            listener?.onLevelEnded(false, e.score)
        }
    }

    private fun burst(x: Float, y: Float, color: Int) {
        val n = 10 + rng.nextInt(6)
        for (i in 0 until n) {
            val ang = rng.nextFloat() * (Math.PI * 2).toFloat()
            val spd = 180f + rng.nextFloat() * 320f
            particles += Particle(
                x = x,
                y = y,
                vx = cos(ang) * spd,
                vy = sin(ang) * spd - 80f,
                life = 0.35f + rng.nextFloat() * 0.35f,
                maxLife = 0.7f,
                color = color,
                size = 4f + rng.nextFloat() * 7f
            )
        }
    }

    private fun notifyHud() {
        val e = engine ?: return
        listener?.onScoreChanged(e.score, e.targetScore, e.movesLeft)
    }
}
