package com.digihub.smartcalc

import android.os.Bundle
import android.view.View
import android.widget.Button
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import com.digihub.smartcalc.databinding.ActivityMainBinding
import com.google.android.material.snackbar.Snackbar
import java.math.BigDecimal
import java.math.MathContext
import java.math.RoundingMode
import kotlin.math.pow
import kotlin.math.sqrt

/**
 * Light smart calculator — fixed digit replace + correct math chaining.
 * Examples: 2 + 3 = 5,  2 + 3 × 4 = 14,  10 − 3 = 7
 */
class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding

    private var display = "0"
    /** Pending left side ending with an operator, e.g. "2 + 3 ×" */
    private var pending = ""
    /** After operator or equals, next digit replaces display (does not append) */
    private var fresh = true
    private var memory = BigDecimal.ZERO
    private val history = ArrayList<String>()
    private val mc = MathContext(16, RoundingMode.HALF_UP)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)
        wire()
        paint()
    }

    private fun wire() {
        mapOf(
            R.id.btn0 to "0", R.id.btn1 to "1", R.id.btn2 to "2", R.id.btn3 to "3",
            R.id.btn4 to "4", R.id.btn5 to "5", R.id.btn6 to "6", R.id.btn7 to "7",
            R.id.btn8 to "8", R.id.btn9 to "9"
        ).forEach { (id, d) ->
            findViewById<Button>(id).setOnClickListener { onDigit(d) }
        }
        binding.btnDot.setOnClickListener { onDot() }
        binding.btnClear.setOnClickListener { onClear() }
        binding.btnBack.setOnClickListener { onBack() }
        binding.btnEquals.setOnClickListener { onEquals() }
        binding.btnPlus.setOnClickListener { onOp("+") }
        binding.btnMinus.setOnClickListener { onOp("-") }
        binding.btnMul.setOnClickListener { onOp("×") }
        binding.btnDiv.setOnClickListener { onOp("÷") }
        binding.btnPercent.setOnClickListener { onPercent() }
        binding.btnPlusMinus.setOnClickListener { onSign() }
        binding.btnSqrt.setOnClickListener { onUnary("√") }
        binding.btnSquare.setOnClickListener { onUnary("x²") }
        binding.btnReciprocal.setOnClickListener { onUnary("1/x") }
        binding.btnMc.setOnClickListener {
            memory = BigDecimal.ZERO
            snack("Memory cleared")
            paint()
        }
        binding.btnMr.setOnClickListener {
            display = fmt(memory)
            fresh = true
            paint()
        }
        binding.btnMplus.setOnClickListener {
            runCatching {
                memory = memory.add(toNum(display), mc)
                snack("M+ ${fmt(memory)}")
            }
            paint()
        }
        binding.btnMminus.setOnClickListener {
            runCatching {
                memory = memory.subtract(toNum(display), mc)
                snack("M- ${fmt(memory)}")
            }
            paint()
        }
        binding.btnHistory.setOnClickListener { showHistory() }
    }

    private fun onDigit(d: String) {
        if (display == "Error" || fresh) {
            display = d
            fresh = false
        } else if (display == "0") {
            display = d
        } else if (display == "-0") {
            display = "-$d"
        } else if (display.length < 16) {
            display += d
        }
        paint()
    }

    private fun onDot() {
        if (display == "Error" || fresh) {
            display = "0."
            fresh = false
        } else if (!display.contains('.')) {
            display += "."
        }
        paint()
    }

    private fun onOp(op: String) {
        if (display == "Error") return

        if (fresh && pendingEndsWithOp()) {
            // User hit + then × without typing → only change operator
            pending = dropLastOp(pending) + " $op"
            paint()
            return
        }

        // pending is empty OR is a finished result string: start from display
        pending = if (!pendingEndsWithOp()) {
            "$display $op"
        } else {
            // pending like "2 +" and user typed next number in display
            "${pending.trim()} $display $op"
        }
        fresh = true
        paint()
    }

    private fun onEquals() {
        if (display == "Error") return
        try {
            val full = if (pendingEndsWithOp()) {
                "${pending.trim()} $display"
            } else if (pending.isNotEmpty() && fresh) {
                // already evaluated once; keep same
                pending
            } else if (pending.isEmpty()) {
                display
            } else {
                "${pending.trim()} $display"
            }.trim()

            if (full.isEmpty()) return

            val result = eval(full)
            val out = fmt(result)
            history.add(0, "$full = $out")
            if (history.size > 30) history.removeAt(history.lastIndex)

            pending = full
            display = out
            fresh = true
        } catch (_: Exception) {
            display = "Error"
            pending = ""
            fresh = true
        }
        paint()
    }

    private fun onPercent() {
        if (display == "Error") return
        try {
            val n = toNum(display)
            val value = if (pendingEndsWithOp()) {
                val op = pending.trim().substringAfterLast(' ')
                val leftBits = dropLastOp(pending).trim().split(Regex("\\s+"))
                val base = leftBits.lastOrNull()
                if (base != null && (op == "+" || op == "-")) {
                    toNum(base).multiply(n, mc).divide(BigDecimal(100), mc)
                } else {
                    n.divide(BigDecimal(100), mc)
                }
            } else {
                n.divide(BigDecimal(100), mc)
            }
            display = fmt(value)
            fresh = true
        } catch (_: Exception) {
            display = "Error"
            fresh = true
        }
        paint()
    }

    private fun onSign() {
        if (display == "Error" || display == "0" || display == "0.") return
        display = if (display.startsWith("-")) display.drop(1) else "-$display"
        fresh = false
        paint()
    }

    private fun onUnary(kind: String) {
        if (display == "Error") return
        try {
            val raw = display
            val v = toNum(display).toDouble()
            val r = when (kind) {
                "√" -> {
                    require(v >= 0)
                    sqrt(v)
                }
                "x²" -> v.pow(2.0)
                "1/x" -> {
                    require(v != 0.0)
                    1.0 / v
                }
                else -> v
            }
            require(!r.isNaN() && !r.isInfinite())
            val out = fmt(BigDecimal.valueOf(r).round(mc))
            history.add(0, "$kind($raw) = $out")
            display = out
            fresh = true
        } catch (_: Exception) {
            display = "Error"
            fresh = true
        }
        paint()
    }

    private fun onClear() {
        display = "0"
        pending = ""
        fresh = true
        paint()
    }

    private fun onBack() {
        if (fresh || display == "Error") {
            display = "0"
            fresh = true
            paint()
            return
        }
        display = when {
            display.length <= 1 -> "0"
            display.length == 2 && display.startsWith("-") -> "0"
            else -> display.dropLast(1)
        }
        if (display == "-" || display.isEmpty()) display = "0"
        paint()
    }

    private fun pendingEndsWithOp(): Boolean {
        val t = pending.trim()
        if (t.isEmpty()) return false
        val last = t.substringAfterLast(' ')
        return last in setOf("+", "-", "×", "÷", "−", "*", "/")
    }

    private fun dropLastOp(s: String): String {
        var t = s.trim()
        if (t.isEmpty()) return ""
        val last = t.substringAfterLast(' ', missingDelimiterValue = t)
        if (last in setOf("+", "-", "×", "÷", "−", "*", "/")) {
            t = if (' ' in t) t.substringBeforeLast(' ').trim() else ""
        }
        return t
    }

    private fun toNum(s: String): BigDecimal =
        BigDecimal(s.trim().replace(',', '.').replace('−', '-'))

    /** ×÷ before +− */
    private fun eval(raw: String): BigDecimal {
        val tokens = raw.trim()
            .replace('−', '-')
            .split(Regex("\\s+"))
            .filter { it.isNotEmpty() }

        require(tokens.isNotEmpty())
        if (tokens.size == 1) return toNum(tokens[0])

        val stack = ArrayList<String>()
        var i = 0
        while (i < tokens.size) {
            val t = tokens[i]
            if (t == "×" || t == "*" || t == "÷" || t == "/") {
                require(stack.isNotEmpty() && i + 1 < tokens.size)
                val left = toNum(stack.removeAt(stack.lastIndex))
                val right = toNum(tokens[i + 1])
                val r = if (t == "×" || t == "*") {
                    left.multiply(right, mc)
                } else {
                    require(right.compareTo(BigDecimal.ZERO) != 0)
                    left.divide(right, mc)
                }
                stack.add(r.toPlainString())
                i += 2
            } else {
                stack.add(t)
                i++
            }
        }

        var acc = toNum(stack[0])
        var j = 1
        while (j < stack.size) {
            val op = stack[j]
            val right = toNum(stack[j + 1])
            acc = when (op) {
                "+" -> acc.add(right, mc)
                "-", "−" -> acc.subtract(right, mc)
                else -> throw IllegalArgumentException("op $op")
            }
            j += 2
        }
        return acc
    }

    private fun fmt(v: BigDecimal): String {
        val s = try {
            val z = v.stripTrailingZeros()
            if (z.scale() < 0) z.setScale(0).toPlainString() else z.toPlainString()
        } catch (_: Exception) {
            v.toPlainString()
        }
        return if (s == "-0") "0" else s
    }

    private fun snack(msg: String) {
        Snackbar.make(binding.root, msg, Snackbar.LENGTH_SHORT).show()
    }

    private fun showHistory() {
        val msg = if (history.isEmpty()) "No calculations yet"
        else history.take(12).joinToString("\n")
        AlertDialog.Builder(this)
            .setTitle("History")
            .setMessage(msg)
            .setPositiveButton("OK", null)
            .setNeutralButton("Clear") { _, _ ->
                history.clear()
                snack("History cleared")
            }
            .show()
    }

    private fun paint() {
        val top = when {
            pending.isEmpty() -> ""
            pendingEndsWithOp() && !fresh -> "${pending.trim()} $display"
            else -> pending
        }
        binding.tvExpression.text = top.ifEmpty { " " }
        binding.tvDisplay.text = display
        binding.tvMemory.visibility =
            if (memory.compareTo(BigDecimal.ZERO) != 0) View.VISIBLE else View.GONE
        binding.tvMemory.text = "M: ${fmt(memory)}"
    }
}
