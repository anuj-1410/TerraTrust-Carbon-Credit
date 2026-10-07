package com.terratrustar.ar

import kotlin.math.*
import kotlin.random.Random

/** Fits an upright trunk in a nearby anchor's coordinate frame (metres). */
object TrunkMeasurementEngine {
    data class WorldPoint(val x: Float, val y: Float, val z: Float, val confidence: Float = 1f)
    data class PreviewFit(
        val centerX: Float, val centerZ: Float, val centerY: Float, val radiusM: Float,
        val yMin: Float, val yMax: Float, val inlierCount: Int, val pointCount: Int,
        val residualCm: Float, val confidence: Float,
    )
    data class CylinderFit(
        val diameterCm: Float, val confidence: Float, val tierUsed: Int,
        val pointCount: Int, val rawPointCount: Int, val filteredPointCount: Int,
        val inlierCount: Int, val residualCm: Float, val scanDistanceM: Float,
        val scanDurationMs: Long, val fitMethod: String,
        val centerX: Float, val centerZ: Float, val centerY: Float, val radiusM: Float,
        val yMin: Float, val yMax: Float,
        val radiusUncertaintyCm: Float,
    )

    enum class Rejection(val guidance: String) {
        POINTS("Need more bark detail. Move closer (about 1 m), keep the trunk centered, and scan slowly."),
        MOTION("Step sideways about 25 cm while aiming at the same trunk. Rotating the phone in place is not enough."),
        CURVE("Reveal both sides of the trunk by moving slowly around it, keeping the same chest-height section centered."),
        COVERAGE("Keep a taller section of the upright trunk visible around chest height; avoid branches and the ground."),
        OUTLIERS("Center only this trunk. Avoid leaves, nearby trunks, and background surfaces in the reticle."),
        NOISY("The surface fit is too noisy. Move closer, use even light, and scan more slowly."),
    }
    data class Assessment(
        val fit: CylinderFit?, val rejection: Rejection?,
        val preview: PreviewFit? = null, val diagnostic: String? = null,
    )
    private data class Circle(val x: Double, val z: Double, val r: Double)
    private data class Geometry(
        val circle: Circle, val points: List<WorldPoint>, val inliers: List<WorldPoint>,
        val residualCm: Float, val arc: Float, val yMin: Float, val yMax: Float,
        val uncertaintyM: Float,
    )

    /** A repeated feature or depth pixel cannot manufacture evidence by being appended again. */
    fun uniquePoints(points: List<WorldPoint>, voxelM: Float = 0.005f): List<WorldPoint> {
        val cells = LinkedHashMap<Triple<Int, Int, Int>, WorldPoint>()
        points.forEach { p ->
            if (p.x.isFinite() && p.y.isFinite() && p.z.isFinite() && p.confidence.isFinite() && p.confidence > 0f) {
                val key = Triple(floor(p.x / voxelM).toInt(), floor(p.y / voxelM).toInt(), floor(p.z / voxelM).toInt())
                if ((cells[key]?.confidence ?: -1f) <= p.confidence) cells[key] = p
            }
        }
        return cells.values.toList()
    }

    fun previewFit(points: List<WorldPoint>, tierUsed: Int): PreviewFit? {
        // Preview is provisional. Completion applies the additional quality and stability gates.
        val clean = uniquePoints(points)
        if (clean.size < if (tierUsed == 1) 80 else 30) return null
        val g = geometry(clean, tierUsed) ?: return null
        return preview(g)
    }

    private fun preview(g: Geometry): PreviewFit? {
        if (g.inliers.size < 24 || g.arc < 0.45f || g.yMax - g.yMin < 0.18f) return null
        return PreviewFit(
            g.circle.x.toFloat(), g.circle.z.toFloat(), percentile(g.inliers.map { it.y }, 0.5f),
            g.circle.r.toFloat(), g.yMin, g.yMax, g.inliers.size, g.points.size,
            g.residualCm, (g.inliers.size.toFloat() / g.points.size).coerceAtMost(0.98f),
        )
    }

    fun fitVerticalCylinder(
        points: List<WorldPoint>, tierUsed: Int, rawPointCount: Int = points.size,
        scanDistanceM: Float = 0f, scanDurationMs: Long = 0L,
    ): CylinderFit? = assess(points, tierUsed, rawPointCount, scanDistanceM, scanDurationMs).fit

    fun assess(
        points: List<WorldPoint>, tierUsed: Int, rawPointCount: Int = points.size,
        scanDistanceM: Float = 0f, scanDurationMs: Long = 0L,
    ): Assessment {
        val clean = uniquePoints(points)
        val minimum = if (tierUsed == 1) 100 else 50
        if (clean.size < if (tierUsed == 1) 80 else 30) return Assessment(null, Rejection.POINTS)
        val g = geometry(clean, tierUsed) ?: return Assessment(null, Rejection.CURVE)
        val preview = preview(g)
        val diagnostic = "inliers=${g.inliers.size}/${clean.size} residual_cm=${g.residualCm} arc_rad=${g.arc} radius_sigma_cm=${g.uncertaintyM * 100f}"
        fun reject(reason: Rejection) = Assessment(null, reason, preview, diagnostic)
        if (clean.size < minimum) return reject(Rejection.POINTS)
        if (tierUsed == 2 && scanDistanceM < 0.18f) return reject(Rejection.MOTION)
        val ratio = g.inliers.size.toFloat() / clean.size
        if (g.inliers.size < minimum || ratio < 0.70f) return reject(Rejection.OUTLIERS)
        if (g.yMax - g.yMin < 0.28f) return reject(Rejection.COVERAGE)
        val diameter = (g.circle.r * 200).toFloat()
        if (diameter !in 5f..200f || g.arc < 0.65f ||
            g.uncertaintyM > max(0.0125f, g.circle.r.toFloat() * 0.05f)) {
            return reject(Rejection.CURVE)
        }
        if (g.residualCm > max(0.8f, diameter * 0.05f)) return reject(Rejection.NOISY)
        // A leaned stem or branch can resemble a thick vertical cylinder in X/Z.
        // Check that the upper/lower bands agree on its axis and radius.
        val middleY = percentile(g.inliers.map { it.y }, 0.5f)
        val lower = g.inliers.filter { it.y < middleY }
        val upper = g.inliers.filter { it.y >= middleY }
        if (lower.size >= 20 && upper.size >= 20) {
            val a = refine(g.circle, lower)
            val b = refine(g.circle, upper)
            if (hypot(a.x - b.x, a.z - b.z) > max(0.03, g.circle.r * 0.15) ||
                abs(a.r - b.r) > max(0.02, g.circle.r * 0.12)) return reject(Rejection.COVERAGE)
        }
        return Assessment(CylinderFit(
            diameter, ratio.coerceAtMost(0.98f), tierUsed, clean.size, rawPointCount, clean.size,
            g.inliers.size, g.residualCm, scanDistanceM, scanDurationMs,
            "anchor_local_robust_circle", g.circle.x.toFloat(), g.circle.z.toFloat(),
            percentile(g.inliers.map { it.y }, 0.5f), g.circle.r.toFloat(), g.yMin, g.yMax,
            g.uncertaintyM * 100f,
        ), null, preview, diagnostic)
    }

    private fun geometry(points: List<WorldPoint>, tier: Int): Geometry? {
        // Bound fitting work. Spread samples throughout the cloud, not just the last frame.
        val sample = if (points.size <= 1600) points else List(1600) { points[it * points.size / 1600] }
        val threshold = if (tier == 1) 0.020 else 0.025
        val random = Random(sample.size * 73 + 17)
        val seeds = mutableListOf<Pair<Circle, Double>>()
        repeat(256) {
            val c = throughThree(sample[random.nextInt(sample.size)], sample[random.nextInt(sample.size)], sample[random.nextInt(sample.size)]) ?: return@repeat
            if (c.r !in 0.025..1.0) return@repeat
            // Truncated squared error penalizes broad but poorly fitting candidates.
            val score = sample.sumOf { min(residual(c, it).pow(2), threshold.pow(2)) }
            seeds.add(c to score)
        }
        var best: Circle? = null
        var bestScore = Double.POSITIVE_INFINITY
        seeds.sortedBy { it.second }.take(12).forEach { (seed, _) ->
            var c = seed
            repeat(3) {
                val inliers = sample.filter { abs(residual(c, it)) <= threshold }
                if (inliers.size >= 12) c = refine(c, inliers)
            }
            if (c.r in 0.025..1.0) {
                val score = sample.sumOf { min(residual(c, it).pow(2), threshold.pow(2)) }
                if (score < bestScore) { best = c; bestScore = score }
            }
        }
        val c = best ?: return null
        // A size-aware window keeps small trunks from accepting a thick planar patch.
        val inlierWindow = min(threshold, max(0.008, c.r * 0.10))
        val inliers = points.filter { abs(residual(c, it)) <= inlierWindow }
        if (inliers.size < 12) return null
        val final = refine(c, inliers)
        val finalInliers = points.filter { abs(residual(final, it)) <= inlierWindow }
        if (finalInliers.size < 12) return null
        return Geometry(final, points, finalInliers,
            (finalInliers.map { abs(residual(final, it)) }.average() * 100).toFloat(),
            arcCoverage(final, finalInliers), percentile(finalInliers.map { it.y }, 0.1f),
            percentile(finalInliers.map { it.y }, 0.9f), uncertainty(final, finalInliers))
    }

    private fun throughThree(a: WorldPoint, b: WorldPoint, c: WorldPoint): Circle? {
        // Translate before squaring to avoid cancellation at large world coordinates.
        val bx = (b.x - a.x).toDouble(); val bz = (b.z - a.z).toDouble()
        val cx = (c.x - a.x).toDouble(); val cz = (c.z - a.z).toDouble()
        val d = 2 * (bx * cz - bz * cx)
        if (abs(d) < 1e-7) return null
        val b2 = bx * bx + bz * bz; val c2 = cx * cx + cz * cz
        val x = (b2 * cz - c2 * bz) / d; val z = (bx * c2 - cx * b2) / d
        return Circle(x + a.x, z + a.z, hypot(x, z))
    }

    /** Damped geometric least squares with Huber weights; jointly solves centre AND radius. */
    private fun refine(seed: Circle, points: List<WorldPoint>): Circle {
        var c = seed
        var damping = 1e-4
        repeat(30) {
            val h = Array(3) { DoubleArray(3) }; val g = DoubleArray(3)
            points.forEach { p ->
                val dx = c.x - p.x; val dz = c.z - p.z; val d = hypot(dx, dz).coerceAtLeast(1e-9)
                val e = d - c.r
                val j = doubleArrayOf(dx / d, dz / d, -1.0)
                val w = p.confidence.toDouble() * min(1.0, 0.008 / max(abs(e), 1e-9))
                for (i in 0..2) {
                    g[i] += w * j[i] * e
                    for (k in 0..2) h[i][k] += w * j[i] * j[k]
                }
            }
            for (i in 0..2) h[i][i] += damping * max(h[i][i], 1.0)
            val delta = solve(h, DoubleArray(3) { -g[it] }) ?: return c
            val next = Circle(c.x + delta[0], c.z + delta[1], c.r + delta[2])
            if (next.r in 0.025..1.0 && loss(next, points) < loss(c, points)) {
                c = next; damping = max(1e-9, damping * 0.3)
                if (delta.sumOf { it * it } < 1e-14) return c
            } else damping = min(1e6, damping * 10)
        }
        return c
    }

    private fun loss(c: Circle, points: List<WorldPoint>): Double = points.sumOf {
        val e = abs(residual(c, it))
        it.confidence * if (e <= 0.008) e * e / 2 else 0.008 * (e - 0.004)
    }
    private fun residual(c: Circle, p: WorldPoint) = hypot(c.x - p.x, c.z - p.z) - c.r

    private fun solve(a: Array<DoubleArray>, b: DoubleArray): DoubleArray? {
        val m = Array(3) { i -> DoubleArray(4) { j -> if (j == 3) b[i] else a[i][j] } }
        for (i in 0..2) {
            val pivot = (i..2).maxByOrNull { abs(m[it][i]) } ?: return null
            if (abs(m[pivot][i]) < 1e-10) return null
            val row = m[i]; m[i] = m[pivot]; m[pivot] = row
            val v = m[i][i]
            for (k in i..3) m[i][k] /= v
            for (j in 0..2) if (j != i) {
                val f = m[j][i]
                for (k in i..3) m[j][k] -= f * m[i][k]
            }
        }
        return DoubleArray(3) { m[it][3] }
    }

    private fun arcCoverage(c: Circle, points: List<WorldPoint>): Float {
        val angles = points.map { atan2(it.z - c.z, it.x - c.x) }.sorted()
        // Remove the outer 5% at each end of the occupied arc so a single outlier
        // cannot turn an almost flat patch into apparently adequate curvature.
        var gap = -1.0; var start = 0
        for (i in angles.indices) {
            val next = if (i == angles.lastIndex) angles.first() + 2 * PI else angles[i + 1]
            if (next - angles[i] > gap) { gap = next - angles[i]; start = (i + 1) % angles.size }
        }
        val unwrapped = angles.indices.map { k ->
            val index = (start + k) % angles.size
            angles[index] + if (index < start) 2 * PI else 0.0
        }
        return (unwrapped[(unwrapped.lastIndex * 0.95).toInt()] - unwrapped[(unwrapped.lastIndex * 0.05).toInt()]).toFloat()
    }

    private fun uncertainty(c: Circle, points: List<WorldPoint>): Float {
        // Angular bins avoid pretending that many vertical samples on the same
        // generatrix provide many independent observations of curvature.
        val bins = points.groupBy { floor(atan2(it.z - c.z, it.x - c.x) / 0.08).toInt() }
        // Centre X/Z and radius are three unknowns. Four independent angular
        // groups provide an overdetermined system; conditioning below decides
        // whether their particular distribution is sufficient.
        if (bins.size < 4) return Float.POSITIVE_INFINITY
        val h = Array(3) { DoubleArray(3) }
        bins.values.forEach { group ->
            val x = group.map { it.x.toDouble() }.average(); val z = group.map { it.z.toDouble() }.average()
            val d = hypot(c.x - x, c.z - z).coerceAtLeast(1e-9)
            val j = doubleArrayOf((c.x - x) / d, (c.z - z) / d, -1.0)
            for (i in 0..2) for (k in 0..2) h[i][k] += j[i] * j[k]
        }
        val covarianceColumn = solve(h, doubleArrayOf(0.0, 0.0, 1.0)) ?: return Float.POSITIVE_INFINITY
        // Use the error of each angular group's mean, since its Jacobian also
        // represents the mean. Mixing individual point variance with grouped
        // Jacobians overstates uncertainty for sparse, well-spread features.
        // Retain a 2 mm floor rather than claiming zero sensor error.
        val variance = max(0.000004, bins.values.map { group ->
            group.map { residual(c, it) }.average().pow(2)
        }.average())
        return sqrt(max(0.0, covarianceColumn[2] * variance)).toFloat()
    }

    private fun percentile(values: List<Float>, ratio: Float): Float {
        if (values.isEmpty()) return 0f
        val sorted = values.sorted()
        return sorted[(ratio * (sorted.size - 1)).toInt()]
    }
}
