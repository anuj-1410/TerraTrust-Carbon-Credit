package com.terratrustar.ar

import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.sqrt
import kotlin.random.Random

object TrunkMeasurementEngine {

    data class WorldPoint(
        val x: Float,
        val y: Float,
        val z: Float,
        val confidence: Float = 1f,
    )

    data class PreviewFit(
        val centerX: Float,
        val centerZ: Float,
        val centerY: Float,
        val radiusM: Float,
        val yMin: Float,
        val yMax: Float,
        val inlierCount: Int,
        val pointCount: Int,
        val residualCm: Float,
        val confidence: Float,
    )

    data class CylinderFit(
        val diameterCm: Float,
        val confidence: Float,
        val tierUsed: Int,
        val pointCount: Int,
        val rawPointCount: Int,
        val filteredPointCount: Int,
        val inlierCount: Int,
        val residualCm: Float,
        val scanDistanceM: Float,
        val scanDurationMs: Long,
        val fitMethod: String,
        val centerX: Float,
        val centerZ: Float,
        val centerY: Float,
        val radiusM: Float,
        val yMin: Float,
        val yMax: Float,
    )

    private data class CircleCandidate(
        val centerX: Float,
        val centerZ: Float,
        val radiusM: Float,
    )

    private data class FitConfig(
        val minPoints: Int,
        val residualThresholdM: Float,
        val minInlierRatio: Float,
        val minVerticalCoverageM: Float,
        val minConfidence: Float,
        val minScanDistanceM: Float,
    )

    private data class FitComputation(
        val candidate: CircleCandidate,
        val filteredPoints: List<WorldPoint>,
        val inliers: List<WorldPoint>,
        val residualCm: Float,
        val verticalCoverageM: Float,
        val arcCoverageRad: Float,
        val confidence: Float,
    )

    private const val MAX_RANSAC_ITERATIONS = 160

    fun previewFit(
        points: List<WorldPoint>,
        tierUsed: Int,
        scanDistanceM: Float = 0f,
    ): PreviewFit? {
        val fit = computeFit(
            points = points,
            tierUsed = tierUsed,
            scanDistanceM = scanDistanceM,
            config = FitConfig(
                minPoints = if (tierUsed == 1) 100 else 45,
                residualThresholdM = 0.065f,
                minInlierRatio = 0.28f,
                minVerticalCoverageM = 0.18f,
                minConfidence = 0.48f,
                minScanDistanceM = 0f,
            ),
        ) ?: return null

        return PreviewFit(
            centerX = fit.candidate.centerX,
            centerZ = fit.candidate.centerZ,
            centerY = percentile(fit.inliers.map { it.y }, 0.5f),
            radiusM = fit.candidate.radiusM,
            yMin = percentile(fit.inliers.map { it.y }, 0.1f),
            yMax = percentile(fit.inliers.map { it.y }, 0.9f),
            inlierCount = fit.inliers.size,
            pointCount = fit.filteredPoints.size,
            residualCm = fit.residualCm,
            confidence = fit.confidence,
        )
    }

    fun fitVerticalCylinder(
        points: List<WorldPoint>,
        tierUsed: Int,
        rawPointCount: Int = points.size,
        scanDistanceM: Float = 0f,
        scanDurationMs: Long = 0L,
    ): CylinderFit? {
        val fit = computeFit(
            points = points,
            tierUsed = tierUsed,
            scanDistanceM = scanDistanceM,
            config = FitConfig(
                minPoints = if (tierUsed == 1) 180 else 70,
                residualThresholdM = 0.05f,
                minInlierRatio = 0.42f,
                minVerticalCoverageM = 0.28f,
                minConfidence = 0.70f,
                minScanDistanceM = if (tierUsed == 2) 0.18f else 0f,
            ),
        ) ?: return null

        val diameterCm = fit.candidate.radiusM * 200f
        if (diameterCm < 5f || diameterCm > 200f) {
            return null
        }

        return CylinderFit(
            diameterCm = diameterCm,
            confidence = fit.confidence,
            tierUsed = tierUsed,
            pointCount = fit.filteredPoints.size,
            rawPointCount = rawPointCount,
            filteredPointCount = fit.filteredPoints.size,
            inlierCount = fit.inliers.size,
            residualCm = fit.residualCm,
            scanDistanceM = scanDistanceM,
            scanDurationMs = scanDurationMs,
            fitMethod = "gravity_aligned_ransac_circle",
            centerX = fit.candidate.centerX,
            centerZ = fit.candidate.centerZ,
            centerY = percentile(fit.inliers.map { it.y }, 0.5f),
            radiusM = fit.candidate.radiusM,
            yMin = percentile(fit.inliers.map { it.y }, 0.1f),
            yMax = percentile(fit.inliers.map { it.y }, 0.9f),
        )
    }

    private fun computeFit(
        points: List<WorldPoint>,
        tierUsed: Int,
        scanDistanceM: Float,
        config: FitConfig,
    ): FitComputation? {
        if (points.size < config.minPoints) {
            return null
        }
        if (tierUsed == 2 && scanDistanceM < config.minScanDistanceM) {
            return null
        }

        val filteredPoints = prefilter(points)
        if (filteredPoints.size < config.minPoints) {
            return null
        }

        val best = ransacCircle(filteredPoints, config.residualThresholdM) ?: return null
        val inlierRatio = best.inliers.size.toFloat() / filteredPoints.size.toFloat()
        if (inlierRatio < config.minInlierRatio) {
            return null
        }
        if (best.verticalCoverageM < config.minVerticalCoverageM) {
            return null
        }
        if (best.residualCm > config.residualThresholdM * 100f) {
            return null
        }
        if (best.confidence < config.minConfidence) {
            return null
        }

        return best
    }

    private fun prefilter(points: List<WorldPoint>): List<WorldPoint> {
        if (points.isEmpty()) {
            return emptyList()
        }

        val medianY = percentile(points.map { it.y }, 0.5f)
        val medianX = percentile(points.map { it.x }, 0.5f)
        val medianZ = percentile(points.map { it.z }, 0.5f)
        val nearMedian = points.filter { abs(it.y - medianY) <= 1.2f }
        if (nearMedian.isEmpty()) {
            return points
        }

        val compact = nearMedian.filter {
            abs(it.x - medianX) <= 0.8f &&
                abs(it.z - medianZ) <= 0.8f
        }

        return if (compact.size >= 24) compact else nearMedian
    }

    private fun ransacCircle(
        points: List<WorldPoint>,
        residualThresholdM: Float,
    ): FitComputation? {
        if (points.size < 3) {
            return null
        }

        val random = Random(points.size * 73 + 17)
        var bestCandidate: CircleCandidate? = null
        var bestInliers: List<WorldPoint> = emptyList()
        var bestResidualCm = Float.MAX_VALUE

        repeat(MAX_RANSAC_ITERATIONS) {
            val p1 = points[random.nextInt(points.size)]
            val p2 = points[random.nextInt(points.size)]
            val p3 = points[random.nextInt(points.size)]
            val candidate = circleFromThreePoints(p1, p2, p3) ?: return@repeat
            if (candidate.radiusM < 0.025f || candidate.radiusM > 1.0f) {
                return@repeat
            }

            val inliers = points.filter { point ->
                val distance = distanceXZ(point.x, point.z, candidate.centerX, candidate.centerZ)
                abs(distance - candidate.radiusM) <= residualThresholdM
            }
            if (inliers.size < bestInliers.size) {
                return@repeat
            }

            val residualCm = averageResidualCm(candidate, inliers)
            if (
                inliers.size > bestInliers.size ||
                (inliers.size == bestInliers.size && residualCm < bestResidualCm)
            ) {
                bestCandidate = candidate
                bestInliers = inliers
                bestResidualCm = residualCm
            }
        }

        val candidate = bestCandidate ?: return null
        if (bestInliers.size < 3) {
            return null
        }

        val refinedCandidate = refineCircle(candidate, bestInliers)
        val refinedInliers = points.filter { point ->
            val distance = distanceXZ(point.x, point.z, refinedCandidate.centerX, refinedCandidate.centerZ)
            abs(distance - refinedCandidate.radiusM) <= residualThresholdM
        }
        val residualCm = averageResidualCm(refinedCandidate, refinedInliers)
        val verticalCoverageM =
            percentile(refinedInliers.map { it.y }, 0.9f) -
                percentile(refinedInliers.map { it.y }, 0.1f)
        val arcCoverageRad = arcCoverage(refinedCandidate, refinedInliers)
        val confidence = scoreFit(
            filteredPointCount = points.size,
            inlierCount = refinedInliers.size,
            residualCm = residualCm,
            verticalCoverageM = verticalCoverageM,
            arcCoverageRad = arcCoverageRad,
        )

        return FitComputation(
            candidate = refinedCandidate,
            filteredPoints = points,
            inliers = refinedInliers,
            residualCm = residualCm,
            verticalCoverageM = verticalCoverageM,
            arcCoverageRad = arcCoverageRad,
            confidence = confidence,
        )
    }

    private fun circleFromThreePoints(
        p1: WorldPoint,
        p2: WorldPoint,
        p3: WorldPoint,
    ): CircleCandidate? {
        val x1 = p1.x.toDouble()
        val z1 = p1.z.toDouble()
        val x2 = p2.x.toDouble()
        val z2 = p2.z.toDouble()
        val x3 = p3.x.toDouble()
        val z3 = p3.z.toDouble()

        val determinant =
            2.0 * (x1 * (z2 - z3) + x2 * (z3 - z1) + x3 * (z1 - z2))
        if (abs(determinant) < 1e-6) {
            return null
        }

        val x1Sq = x1 * x1 + z1 * z1
        val x2Sq = x2 * x2 + z2 * z2
        val x3Sq = x3 * x3 + z3 * z3

        val centerX =
            (
                x1Sq * (z2 - z3) +
                    x2Sq * (z3 - z1) +
                    x3Sq * (z1 - z2)
                ) / determinant
        val centerZ =
            (
                x1Sq * (x3 - x2) +
                    x2Sq * (x1 - x3) +
                    x3Sq * (x2 - x1)
                ) / determinant
        val radius = sqrt((centerX - x1).pow(2) + (centerZ - z1).pow(2))
        if (!radius.isFinite()) {
            return null
        }

        return CircleCandidate(
            centerX = centerX.toFloat(),
            centerZ = centerZ.toFloat(),
            radiusM = radius.toFloat(),
        )
    }

    private fun refineCircle(
        seed: CircleCandidate,
        inliers: List<WorldPoint>,
    ): CircleCandidate {
        if (inliers.isEmpty()) {
            return seed
        }

        var centerX = seed.centerX
        var centerZ = seed.centerZ
        repeat(8) {
            val distances = inliers.map { distanceXZ(it.x, it.z, centerX, centerZ) }
            val radius = distances.average().toFloat().coerceAtLeast(0.001f)
            var gradientX = 0f
            var gradientZ = 0f
            inliers.forEachIndexed { index, point ->
                val dx = centerX - point.x
                val dz = centerZ - point.z
                val distance = distances[index].coerceAtLeast(0.001f)
                val residual = distance - radius
                gradientX += (residual * dx) / distance
                gradientZ += (residual * dz) / distance
            }
            centerX -= gradientX / inliers.size.toFloat() * 0.25f
            centerZ -= gradientZ / inliers.size.toFloat() * 0.25f
        }

        val radius =
            inliers.map { distanceXZ(it.x, it.z, centerX, centerZ) }.average().toFloat()
        return CircleCandidate(centerX = centerX, centerZ = centerZ, radiusM = radius)
    }

    private fun averageResidualCm(
        candidate: CircleCandidate,
        points: List<WorldPoint>,
    ): Float {
        if (points.isEmpty()) {
            return Float.MAX_VALUE
        }

        val residualMetres =
            points.map { point ->
                abs(distanceXZ(point.x, point.z, candidate.centerX, candidate.centerZ) - candidate.radiusM)
            }.average().toFloat()
        return residualMetres * 100f
    }

    private fun arcCoverage(
        candidate: CircleCandidate,
        points: List<WorldPoint>,
    ): Float {
        if (points.size < 3) {
            return 0f
        }

        val angles = points.map { atan2((it.z - candidate.centerZ), (it.x - candidate.centerX)) }
            .sorted()
        var largestGap = 0f
        for (index in 0 until angles.lastIndex) {
            largestGap = max(largestGap, angles[index + 1] - angles[index])
        }
        largestGap = max(largestGap, (angles.first() + (2 * PI).toFloat()) - angles.last())
        return ((2 * PI).toFloat() - largestGap).coerceAtLeast(0f)
    }

    private fun scoreFit(
        filteredPointCount: Int,
        inlierCount: Int,
        residualCm: Float,
        verticalCoverageM: Float,
        arcCoverageRad: Float,
    ): Float {
        val inlierRatio = inlierCount.toFloat() / filteredPointCount.toFloat()
        val inlierScore = inlierRatio.coerceIn(0f, 1f)
        val countScore = (inlierCount / 260f).coerceIn(0f, 1f)
        val residualScore = (1f - residualCm / 6.5f).coerceIn(0f, 1f)
        val verticalScore = (verticalCoverageM / 0.7f).coerceIn(0f, 1f)
        val arcScore = (arcCoverageRad / 1.4f).coerceIn(0f, 1f)
        return (
            0.22f +
                inlierScore * 0.30f +
                residualScore * 0.20f +
                verticalScore * 0.14f +
                countScore * 0.09f +
                arcScore * 0.05f
            ).coerceIn(0f, 0.98f)
    }

    private fun percentile(values: List<Float>, ratio: Float): Float {
        if (values.isEmpty()) {
            return 0f
        }

        val sorted = values.sorted()
        val index = (ratio.coerceIn(0f, 1f) * (sorted.size - 1)).toInt()
        return sorted[index]
    }

    private fun distanceXZ(
        x: Float,
        z: Float,
        centerX: Float,
        centerZ: Float,
    ): Float {
        val dx = x - centerX
        val dz = z - centerZ
        return sqrt(dx * dx + dz * dz)
    }
}
