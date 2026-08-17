package com.digihub.arrowescape.game

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RadialGradient
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface
import android.util.AttributeSet
import android.view.MotionEvent
import android.view.ScaleGestureDetector
import android.view.View
import com.digihub.arrowescape.data.Dir
import com.digihub.arrowescape.data.GameConstants
import com.digihub.arrowescape.data.Theme
import com.digihub.arrowescape.data.Themes
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin
import kotlin.random.Random

class GameView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : View(context, attrs) {

    interface Listener {
        fun onHeartsChanged(hearts: Int)
        fun onWin(stars: Int, coins: Int, xp: Int, perfect: Boolean, shapeName: String)
        fun onLose(shapeName: String)
        fun onArrowRemoved(remaining: Int)
    }

    var listener: Listener? = null
    var sound: SoundManager? = null
    var shakeEnabled = true

    private var theme: Theme = Themes.all[0]
    private var levelData: LevelData? = null
    private val arrows = LinkedHashMap<String, ArrowSprite>()
    private val occupied = HashSet<String>()
    private val anims = ArrayList<Anim>()
    private val particles = ArrayList<Particle>()
    private val stars = ArrayList<StarDot>()

    private var hearts = GameConstants.MAX_HEARTS
    private var removedCount = 0
    private var state = State.IDLE
    private var levelNumber = 1

    // View transform
    private var scale = 1f
    private var offsetX = 0f
    private var offsetY = 0f
    private var minScale = 0.4f
    private var maxScale = 2.4f

    private var lastX = 0f
    private var lastY = 0f
    private var downX = 0f
    private var downY = 0f
    private var downTime = 0L
    private var dragging = false
    private var didDrag = false
    private var hoverId: String? = null
    private var shakeTime = 0f
    private var rainbowHue = 0f
    private var lastFrameNs = 0L

    private val cell = GameConstants.CELL
    private val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val strokePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeCap = Paint.Cap.ROUND
        strokeJoin = Paint.Join.ROUND
    }
    private val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE
        textAlign = Paint.Align.CENTER
        typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
    }
    private val shadowPaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val rect = RectF()
    private val path = Path()

    private val scaleDetector = ScaleGestureDetector(context,
        object : ScaleGestureDetector.SimpleOnScaleGestureListener() {
            override fun onScale(detector: ScaleGestureDetector): Boolean {
                zoomAt(detector.focusX, detector.focusY, detector.scaleFactor)
                didDrag = true
                return true
            }
        })

    enum class State { IDLE, PLAYING, ANIMATING, WON, LOST, PAUSED }

    private val frameRunnable = object : Runnable {
        override fun run() {
            val now = System.nanoTime()
            val dt = if (lastFrameNs == 0L) 0.016f
            else min(((now - lastFrameNs) / 1_000_000_000f), 0.05f)
            lastFrameNs = now
            update(dt)
            invalidate()
            postOnAnimation(this)
        }
    }

    init {
        repeat(55) {
            stars.add(
                StarDot(
                    Random.nextFloat(),
                    Random.nextFloat(),
                    Random.nextFloat() * 2.2f + 0.5f,
                    Random.nextFloat() * 0.45f + 0.12f,
                    Random.nextFloat() * 0.4f + 0.1f
                )
            )
        }
        post(frameRunnable)
    }

    fun startLevel(level: Int) {
        levelNumber = level
        levelData = LevelGenerator.generate(level)
        theme = Themes.forLevel(level)
        hearts = GameConstants.MAX_HEARTS
        removedCount = 0
        arrows.clear()
        occupied.clear()
        anims.clear()
        particles.clear()
        state = State.PLAYING

        for (a in levelData!!.arrows) {
            occupied.add(a.id)
            arrows[a.id] = ArrowSprite(
                id = a.id,
                gx = a.x,
                gy = a.y,
                dir = a.dir,
                px = a.x * cell,
                py = -a.y * cell
            )
        }
        fitView()
        listener?.onHeartsChanged(hearts)
        listener?.onArrowRemoved(arrows.size)
    }

    fun pauseGame() {
        if (state == State.PLAYING) state = State.PAUSED
    }

    fun resumeGame() {
        if (state == State.PAUSED) state = State.PLAYING
    }

    fun isPlaying() = state == State.PLAYING || state == State.ANIMATING

    private fun fitView() {
        if (width == 0 || height == 0 || arrows.isEmpty()) {
            offsetX = width / 2f
            offsetY = height / 2f
            scale = 1f
            return
        }
        var minX = Float.MAX_VALUE
        var maxX = -Float.MAX_VALUE
        var minY = Float.MAX_VALUE
        var maxY = -Float.MAX_VALUE
        for (a in arrows.values) {
            minX = min(minX, a.px); maxX = max(maxX, a.px)
            minY = min(minY, a.py); maxY = max(maxY, a.py)
        }
        val bw = maxX - minX + cell * 2.2f
        val bh = maxY - minY + cell * 2.2f
        val pad = 120f
        val sx = (width - pad * 2) / bw
        val sy = (height - pad * 2) / bh
        scale = min(max(min(sx, sy), minScale), 1.4f)
        val cx = (minX + maxX) / 2f
        val cy = (minY + maxY) / 2f
        offsetX = width / 2f - cx * scale
        offsetY = height / 2f - cy * scale + 20f
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        super.onSizeChanged(w, h, oldw, oldh)
        if (arrows.isNotEmpty()) fitView()
        else {
            offsetX = w / 2f
            offsetY = h / 2f
        }
    }

    @SuppressLint("ClickableViewAccessibility")
    override fun onTouchEvent(event: MotionEvent): Boolean {
        scaleDetector.onTouchEvent(event)
        if (scaleDetector.isInProgress) return true

        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                downX = event.x; downY = event.y
                lastX = event.x; lastY = event.y
                downTime = System.currentTimeMillis()
                dragging = true
                didDrag = false
                parent?.requestDisallowInterceptTouchEvent(true)
            }
            MotionEvent.ACTION_MOVE -> {
                if (dragging && event.pointerCount == 1) {
                    val dx = event.x - lastX
                    val dy = event.y - lastY
                    if (hypot(dx, dy) > 3f) didDrag = true
                    offsetX += dx
                    offsetY += dy
                    lastX = event.x
                    lastY = event.y
                    if (state == State.PLAYING) hoverId = hitTest(event.x, event.y)
                }
            }
            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                if (state == State.PLAYING && !didDrag &&
                    System.currentTimeMillis() - downTime < 450 &&
                    hypot(event.x - downX, event.y - downY) < 18f
                ) {
                    hitTest(event.x, event.y)?.let { attemptRemove(it) }
                }
                dragging = false
                parent?.requestDisallowInterceptTouchEvent(false)
            }
        }
        return true
    }

    private fun zoomAt(fx: Float, fy: Float, factor: Float) {
        val beforeX = (fx - offsetX) / scale
        val beforeY = (fy - offsetY) / scale
        scale = (scale * factor).coerceIn(minScale, maxScale)
        val afterX = (fx - offsetX) / scale
        val afterY = (fy - offsetY) / scale
        offsetX += (afterX - beforeX) * scale
        offsetY += (afterY - beforeY) * scale
    }

    private fun screenToWorld(sx: Float, sy: Float): FloatArray =
        floatArrayOf((sx - offsetX) / scale, (sy - offsetY) / scale)

    private fun hitTest(sx: Float, sy: Float): String? {
        val w = screenToWorld(sx, sy)
        val half = cell * 0.44f
        var best: String? = null
        var bestD = Float.MAX_VALUE
        for (a in arrows.values) {
            if (a.removing) continue
            val dx = w[0] - a.px
            val dy = w[1] - a.py
            if (kotlin.math.abs(dx) <= half && kotlin.math.abs(dy) <= half) {
                val d = dx * dx + dy * dy
                if (d < bestD) {
                    bestD = d
                    best = a.id
                }
            }
        }
        return best
    }

    private fun attemptRemove(id: String) {
        if (state != State.PLAYING) return
        val arrow = arrows[id] ?: return
        if (arrow.removing) return
        sound?.playTap()
        val clear = LevelGenerator.isPathClear(arrow.gx, arrow.gy, arrow.dir, occupied)
        if (clear) startFly(arrow) else startCrash(arrow)
    }

    private fun startFly(a: ArrowSprite) {
        state = State.ANIMATING
        sound?.playLaunch()
        a.removing = true
        occupied.remove(a.id)
        removedCount++
        anims.add(
            Anim.Fly(
                id = a.id,
                t = 0f,
                duration = 0.48f,
                vx = a.dir.dx.toFloat(),
                vy = -a.dir.dy.toFloat()
            )
        )
        burst(a.px, a.py, theme.accent, 14)
    }

    private fun startCrash(a: ArrowSprite) {
        state = State.ANIMATING
        sound?.playCrash()
        var steps = 0.7f
        var x = a.gx + a.dir.dx
        var y = a.gy + a.dir.dy
        for (i in 0 until 24) {
            if ("$x,$y" in occupied) {
                steps = i + 0.55f
                break
            }
            x += a.dir.dx
            y += a.dir.dy
        }
        anims.add(
            Anim.Crash(
                id = a.id,
                t = 0f,
                duration = 0.34f,
                vx = a.dir.dx.toFloat(),
                vy = -a.dir.dy.toFloat(),
                dist = steps * cell,
                ox = a.px,
                oy = a.py
            )
        )
        if (shakeEnabled) shakeTime = 0.3f
    }

    private fun finishFly(id: String) {
        arrows[id]?.let {
            burst(it.px, it.py, theme.glow, 12)
            arrows.remove(id)
        }
        sound?.playSuccess()
        listener?.onArrowRemoved(arrows.size)
        if (arrows.isEmpty()) onWin() else state = State.PLAYING
    }

    private fun finishCrash(id: String) {
        arrows[id]?.let {
            it.px = it.gx * cell
            it.py = -it.gy * cell
            burst(it.px, it.py, Color.parseColor("#FF6B7A"), 12)
        }
        hearts--
        sound?.playHeart()
        listener?.onHeartsChanged(hearts)
        if (hearts <= 0) onLose() else state = State.PLAYING
    }

    private fun onWin() {
        state = State.WON
        sound?.playWin()
        confetti()
        val perfect = hearts >= 3
        val starsCount = if (perfect) 3 else if (hearts == 2) 2 else 1
        val coins = GameConstants.coinsForLevel(levelNumber, hearts.coerceAtMost(3), perfect)
        val xp = GameConstants.xpForLevel(levelNumber, perfect)
        listener?.onWin(starsCount, coins, xp, perfect, levelData?.shapeName ?: "")
    }

    private fun onLose() {
        state = State.LOST
        sound?.playLose()
        for (a in arrows.values) {
            anims.add(Anim.Shake(a.id, 0f, 0.7f, a.px, a.py))
        }
        listener?.onLose(levelData?.shapeName ?: "")
    }

    private fun confetti() {
        val colors = intArrayOf(
            Color.parseColor("#FF6BCB"), Color.parseColor("#6C8CFF"),
            Color.parseColor("#FFD56A"), Color.parseColor("#4ADE80"),
            Color.parseColor("#FF7A5C"), Color.WHITE
        )
        repeat(55) {
            burst(
                (Random.nextFloat() - 0.5f) * cell * 5,
                (Random.nextFloat() - 0.5f) * cell * 4,
                colors[it % colors.size],
                3
            )
        }
    }

    private fun burst(x: Float, y: Float, color: Int, count: Int) {
        repeat(count) {
            val ang = Random.nextFloat() * Math.PI.toFloat() * 2
            val sp = Random.nextFloat() * 220f + 50f
            particles.add(
                Particle(
                    x, y,
                    cos(ang) * sp, sin(ang) * sp - 50f,
                    0.5f + Random.nextFloat() * 0.3f, 0f,
                    Random.nextFloat() * 5f + 2f, color
                )
            )
        }
    }

    private fun update(dt: Float) {
        rainbowHue = (rainbowHue + dt * 0.2f) % 1f

        val it = anims.iterator()
        while (it.hasNext()) {
            val an = it.next()
            an.t += dt
            val p = min(1f, an.t / an.duration)
            val arrow = arrows[an.id]
            when (an) {
                is Anim.Fly -> if (arrow != null) {
                    val ease = 1f - (1f - p) * (1f - p) * (1f - p)
                    arrow.px = arrow.gx * cell + an.vx * ease * cell * 7f
                    arrow.py = -arrow.gy * cell + an.vy * ease * cell * 7f
                    arrow.scale = 1f - ease * 0.35f
                    arrow.alpha = 1f - ease * 0.15f
                    if (Random.nextFloat() < 0.4f) burst(arrow.px, arrow.py, theme.glow, 1)
                    if (p >= 1f) {
                        it.remove()
                        finishFly(an.id)
                    }
                } else it.remove()
                is Anim.Crash -> if (arrow != null) {
                    val go = if (p < 0.55f) p / 0.55f else 1f - (p - 0.55f) / 0.45f
                    val ease = sin(go * Math.PI.toFloat() * 0.5f)
                    arrow.px = an.ox + an.vx * ease * an.dist * 0.9f
                    arrow.py = an.oy + an.vy * ease * an.dist * 0.9f
                    if (p >= 1f) {
                        it.remove()
                        finishCrash(an.id)
                    }
                } else it.remove()
                is Anim.Shake -> if (arrow != null) {
                    arrow.px = an.ox + sin(an.t * 40f) * 5f
                    arrow.py = an.oy + cos(an.t * 36f) * 5f
                    if (p >= 1f) {
                        arrow.px = an.ox
                        arrow.py = an.oy
                        it.remove()
                    }
                } else it.remove()
            }
        }

        val pit = particles.iterator()
        while (pit.hasNext()) {
            val p = pit.next()
            p.age += dt
            p.vy += 320f * dt
            p.x += p.vx * dt
            p.y += p.vy * dt
            if (p.age >= p.life) pit.remove()
        }

        if (shakeTime > 0) shakeTime -= dt

        if (state == State.IDLE) {
            val tIdle = System.currentTimeMillis() * 0.0004f
            offsetX = width / 2f + sin(tIdle) * 10f
            offsetY = height / 2f + cos(tIdle * 0.75f) * 8f
        }
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val w = width.toFloat()
        val h = height.toFloat()

        // Background gradient
        fillPaint.shader = LinearGradient(
            0f, 0f, w, h, theme.bgTop, theme.bgBottom, Shader.TileMode.CLAMP
        )
        canvas.drawRect(0f, 0f, w, h, fillPaint)
        fillPaint.shader = null

        // Ambient stars
        val t = System.currentTimeMillis() * 0.001f
        for (s in stars) {
            fillPaint.color = theme.glow
            fillPaint.alpha = ((s.a * (0.65f + 0.35f * sin(t * s.sp + s.x * 12f))) * 255).toInt().coerceIn(0, 255)
            canvas.drawCircle(s.x * w, s.y * h, s.r, fillPaint)
        }
        fillPaint.alpha = 255

        // Vignette
        fillPaint.shader = RadialGradient(
            w / 2f, h / 2f, max(w, h) * 0.72f,
            intArrayOf(Color.TRANSPARENT, Color.argb(90, 0, 0, 0)),
            floatArrayOf(0.45f, 1f),
            Shader.TileMode.CLAMP
        )
        canvas.drawRect(0f, 0f, w, h, fillPaint)
        fillPaint.shader = null

        var sx = 0f
        var sy = 0f
        if (shakeTime > 0) {
            val s = shakeTime * 20f
            sx = (Random.nextFloat() - 0.5f) * s
            sy = (Random.nextFloat() - 0.5f) * s
        }

        canvas.save()
        canvas.translate(offsetX + sx, offsetY + sy)
        canvas.scale(scale, scale)

        // Soft board shadow
        if (arrows.isNotEmpty()) {
            var minX = Float.MAX_VALUE
            var maxX = -Float.MAX_VALUE
            var maxY = -Float.MAX_VALUE
            for (a in arrows.values) {
                minX = min(minX, a.px); maxX = max(maxX, a.px)
                maxY = max(maxY, a.py)
            }
            fillPaint.color = Color.argb(50, 0, 0, 0)
            rect.set(minX - cell * 0.55f, maxY + cell * 0.5f, maxX + cell * 0.55f, maxY + cell * 0.85f)
            canvas.drawRoundRect(rect, 24f, 24f, fillPaint)
        }

        val sorted = arrows.values.sortedWith(compareBy({ it.py }, { it.px }))
        for (a in sorted) drawArrow(canvas, a)

        for (p in particles) {
            val life = 1f - p.age / p.life
            fillPaint.color = p.color
            fillPaint.alpha = (life * 255).toInt().coerceIn(0, 255)
            canvas.drawCircle(p.x, p.y, p.r * life, fillPaint)
        }
        fillPaint.alpha = 255

        canvas.restore()

        if (state == State.IDLE) {
            textPaint.textSize = 36f
            textPaint.color = Color.argb(100, 255, 255, 255)
            canvas.drawText("Tap Play to start", w / 2f, h - 80f, textPaint)
        }
    }

    private fun drawArrow(canvas: Canvas, a: ArrowSprite) {
        val size = cell * 0.88f * a.scale
        val half = size / 2f
        val hover = hoverId == a.id && state == State.PLAYING

        canvas.save()
        canvas.translate(a.px, a.py)

        // Drop shadow
        fillPaint.color = Color.argb((60 * a.alpha).toInt(), 0, 0, 0)
        rect.set(-half + 3f, -half + 6f, half + 3f, half + 6f)
        canvas.drawRoundRect(rect, 14f, 14f, fillPaint)

        // Body gradient
        var base = Color.parseColor("#6C8CFF")
        // Theme-tinted blocks with per-arrow variation
        base = blend(theme.block, theme.accent, 0.35f + (a.gx + a.gy).and(3) * 0.08f)

        val light = lighten(base, 0.22f)
        fillPaint.shader = LinearGradient(
            -half, -half, half, half, light, base, Shader.TileMode.CLAMP
        )
        fillPaint.alpha = (a.alpha * 255).toInt()
        rect.set(-half, -half, half, half)
        canvas.drawRoundRect(rect, 14f, 14f, fillPaint)
        fillPaint.shader = null

        // Gloss highlight
        fillPaint.shader = LinearGradient(
            0f, -half, 0f, 0f,
            Color.argb((90 * a.alpha).toInt(), 255, 255, 255),
            Color.TRANSPARENT,
            Shader.TileMode.CLAMP
        )
        rect.set(-half + 4f, -half + 4f, half - 4f, -half + size * 0.42f)
        canvas.drawRoundRect(rect, 12f, 12f, fillPaint)
        fillPaint.shader = null
        fillPaint.alpha = 255

        // Border
        strokePaint.color = if (hover) Color.WHITE else Color.argb(55, 255, 255, 255)
        strokePaint.strokeWidth = if (hover) 4f else 2f
        rect.set(-half, -half, half, half)
        canvas.drawRoundRect(rect, 14f, 14f, strokePaint)

        if (hover) {
            strokePaint.color = theme.accent
            strokePaint.strokeWidth = 3f
            strokePaint.setShadowLayer(16f, 0f, 0f, theme.accent)
            rect.set(-half - 3f, -half - 3f, half + 3f, half + 3f)
            canvas.drawRoundRect(rect, 16f, 16f, strokePaint)
            strokePaint.clearShadowLayer()
        }

        // Arrow glyph
        drawGlyph(canvas, a.dir, size * 0.55f, Color.WHITE, a.alpha)

        canvas.restore()
    }

    private fun drawGlyph(canvas: Canvas, dir: Dir, size: Float, color: Int, alpha: Float) {
        val angle = when (dir) {
            Dir.UP -> -90f
            Dir.DOWN -> 90f
            Dir.LEFT -> 180f
            Dir.RIGHT -> 0f
        }
        canvas.save()
        canvas.rotate(angle)

        strokePaint.color = color
        strokePaint.alpha = (alpha * 255).toInt()
        strokePaint.strokeWidth = size * 0.18f
        canvas.drawLine(-size * 0.32f, 0f, size * 0.15f, 0f, strokePaint)

        fillPaint.color = color
        fillPaint.alpha = (alpha * 255).toInt()
        path.reset()
        path.moveTo(size * 0.05f, -size * 0.28f)
        path.lineTo(size * 0.42f, 0f)
        path.lineTo(size * 0.05f, size * 0.28f)
        path.close()
        canvas.drawPath(path, fillPaint)

        fillPaint.alpha = 255
        strokePaint.alpha = 255
        canvas.restore()
    }

    private fun lighten(color: Int, amount: Float): Int {
        val r = Color.red(color)
        val g = Color.green(color)
        val b = Color.blue(color)
        return Color.rgb(
            min(255, (r + (255 - r) * amount).toInt()),
            min(255, (g + (255 - g) * amount).toInt()),
            min(255, (b + (255 - b) * amount).toInt())
        )
    }

    private fun blend(c1: Int, c2: Int, t: Float): Int {
        val tt = t.coerceIn(0f, 1f)
        return Color.rgb(
            (Color.red(c1) * (1 - tt) + Color.red(c2) * tt).toInt(),
            (Color.green(c1) * (1 - tt) + Color.green(c2) * tt).toInt(),
            (Color.blue(c1) * (1 - tt) + Color.blue(c2) * tt).toInt()
        )
    }

    fun getShapeName() = levelData?.shapeName ?: ""
    fun getHearts() = hearts
    fun getRemoved() = removedCount
    fun getLevel() = levelNumber

    private data class ArrowSprite(
        val id: String,
        val gx: Int,
        val gy: Int,
        val dir: Dir,
        var px: Float,
        var py: Float,
        var scale: Float = 1f,
        var alpha: Float = 1f,
        var removing: Boolean = false
    )

    private data class Particle(
        var x: Float, var y: Float,
        var vx: Float, var vy: Float,
        val life: Float, var age: Float,
        val r: Float, val color: Int
    )

    private data class StarDot(
        val x: Float, val y: Float, val r: Float, val a: Float, val sp: Float
    )

    private sealed class Anim(val id: String, var t: Float, val duration: Float) {
        class Fly(id: String, t: Float, duration: Float, val vx: Float, val vy: Float) :
            Anim(id, t, duration)
        class Crash(
            id: String, t: Float, duration: Float,
            val vx: Float, val vy: Float, val dist: Float,
            val ox: Float, val oy: Float
        ) : Anim(id, t, duration)
        class Shake(id: String, t: Float, duration: Float, val ox: Float, val oy: Float) :
            Anim(id, t, duration)
    }
}
