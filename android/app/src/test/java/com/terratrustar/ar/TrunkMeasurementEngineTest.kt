package com.terratrustar.ar

import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.cos
import kotlin.math.sin
import kotlin.random.Random

class TrunkMeasurementEngineTest {

    @Test
    fun `fits a gravity aligned cylinder from a noisy trunk arc`() {
        val points = syntheticTrunkPoints()

        val fit =
            TrunkMeasurementEngine.fitVerticalCylinder(
                points = points,
                tierUsed = 2,
                rawPointCount = points.size,
                scanDistanceM = 0.24f,
                scanDurationMs = 5200L,
            )

        assertNotNull(fit)
        requireNotNull(fit)
        assertTrue(fit.diameterCm in 32f..40f)
        assertTrue(fit.confidence >= 0.70f)
        assertTrue(fit.residualCm <= 5.0f)
        assertTrue(fit.inlierCount >= 70)
    }

    @Test
    fun `rejects captures without enough tier two motion`() {
        val points = syntheticTrunkPoints()

        val fit =
            TrunkMeasurementEngine.fitVerticalCylinder(
                points = points,
                tierUsed = 2,
                rawPointCount = points.size,
                scanDistanceM = 0.08f,
                scanDurationMs = 5200L,
            )

        assertNull(fit)
    }

    @Test
    fun `rejects a small flat object that lacks trunk height coverage`() {
        val random = Random(9)
        val points =
            buildList {
                repeat(220) {
                    val x = (random.nextFloat() - 0.5f) * 0.05f
                    val y = random.nextFloat() * 0.08f
                    val z = -0.70f + (random.nextFloat() - 0.5f) * 0.01f
                    add(TrunkMeasurementEngine.WorldPoint(x = x, y = y, z = z, confidence = 0.95f))
                }
            }

        val fit =
            TrunkMeasurementEngine.fitVerticalCylinder(
                points = points,
                tierUsed = 2,
                rawPointCount = points.size,
                scanDistanceM = 0.25f,
                scanDurationMs = 5100L,
            )

        assertNull(fit)
    }

    private fun syntheticTrunkPoints(): List<TrunkMeasurementEngine.WorldPoint> {
        val random = Random(42)
        val centerX = 0.0f
        val centerZ = -1.60f
        val radius = 0.18f
        val points = mutableListOf<TrunkMeasurementEngine.WorldPoint>()

        repeat(26) { yIndex ->
            val y = 0.40f + yIndex * 0.03f
            repeat(16) { angleIndex ->
                val angle = -0.75 + angleIndex * 0.10
                val radialNoise = (random.nextFloat() - 0.5f) * 0.012f
                val worldX = centerX + cos(angle).toFloat() * (radius + radialNoise)
                val worldZ = centerZ + sin(angle).toFloat() * (radius + radialNoise)
                val worldY = y + (random.nextFloat() - 0.5f) * 0.015f
                points.add(
                    TrunkMeasurementEngine.WorldPoint(
                        x = worldX,
                        y = worldY,
                        z = worldZ,
                        confidence = 0.92f,
                    ),
                )
            }
        }

        return points
    }
}
