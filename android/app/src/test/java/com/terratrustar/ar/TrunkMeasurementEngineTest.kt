package com.terratrustar.ar

import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.assertEquals
import org.junit.Test
import kotlin.math.cos
import kotlin.math.sin
import kotlin.random.Random

class TrunkMeasurementEngineTest {

    @Test
    fun `fits different trunk sizes within the synthetic noise tolerance`() {
        for (diameter in listOf(10f, 20f, 60f, 120f)) {
            val random = Random(diameter.toInt())
            val points = buildList {
                repeat(20) { row ->
                    repeat(24) { col ->
                        val angle = -1.1 + col * 0.1
                        val r = diameter / 200f + (random.nextFloat() - 0.5f) * 0.008f
                        add(TrunkMeasurementEngine.WorldPoint(cos(angle).toFloat() * r, row * 0.035f,
                            -1.6f + sin(angle).toFloat() * r))
                    }
                }
            }
            val fit = TrunkMeasurementEngine.fitVerticalCylinder(points, 1)
            assertNotNull("Diameter $diameter", fit)
            assertEquals(diameter, requireNotNull(fit).diameterCm, kotlin.math.max(1.5f, diameter * 0.05f))
        }
    }

    @Test
    fun `repeated SLAM features cannot satisfy the point minimum`() {
        val repeated = List(100) { syntheticTrunkPoints().take(12) }.flatten()
        val result = TrunkMeasurementEngine.assess(repeated, 2, scanDistanceM = 0.3f)
        assertNull(result.fit)
        assertEquals(TrunkMeasurementEngine.Rejection.POINTS, result.rejection)
    }

    @Test
    fun `fits sparse independent SLAM features accurately`() {
        val points = syntheticTrunkPoints().filterIndexed { index, _ -> index % 4 == 0 }
        val assessment = TrunkMeasurementEngine.assess(points, 2, scanDistanceM = 0.28f)
        val fit = assessment.fit
        assertNotNull("Rejected sparse SLAM scan: ${assessment.rejection}; ${assessment.diagnostic}", fit)
        assertEquals(36f, requireNotNull(fit).diameterCm, 2.0f)
    }

    @Test
    fun `robust fitting handles a partial arc with background outliers`() {
        val points = syntheticTrunkPoints().toMutableList()
        val random = Random(17)
        repeat(65) {
            points.add(TrunkMeasurementEngine.WorldPoint(random.nextFloat() - 0.5f, 0.4f + random.nextFloat() * 0.75f, -2.3f + random.nextFloat() * 0.4f))
        }
        val fit = TrunkMeasurementEngine.fitVerticalCylinder(points, 2, scanDistanceM = 0.25f)
        assertNotNull(fit)
        assertEquals(36f, requireNotNull(fit).diameterCm, 2.0f)
        assertTrue(fit.confidence >= 0.7f)
    }

    @Test
    fun `translation does not change the measured diameter`() {
        val translated = syntheticTrunkPoints().map { it.copy(x = it.x + 110f, z = it.z - 87f) }
        val fit = TrunkMeasurementEngine.fitVerticalCylinder(translated, 1)
        assertNotNull(fit)
        assertEquals(36f, requireNotNull(fit).diameterCm, 2.0f)
    }

    @Test
    fun `rejects a wall with full height coverage`() {
        val random = Random(5)
        val points = List(500) {
            TrunkMeasurementEngine.WorldPoint((random.nextFloat() - 0.5f) * 0.5f, random.nextFloat() * 0.8f,
                -1.4f + (random.nextFloat() - 0.5f) * 0.004f)
        }
        assertNull(TrunkMeasurementEngine.fitVerticalCylinder(points, 1))
    }

    @Test
    fun `rejects non finite points without corrupting an otherwise sound fit`() {
        val points = syntheticTrunkPoints() + TrunkMeasurementEngine.WorldPoint(Float.NaN, 0f, Float.POSITIVE_INFINITY)
        assertNotNull(TrunkMeasurementEngine.fitVerticalCylinder(points, 1))
    }

    @Test
    fun `rejects a strongly leaning stem rather than inflating its diameter`() {
        val leaning = syntheticTrunkPoints().map { it.copy(x = it.x + (it.y - 0.7f) * 0.35f) }
        assertNull(TrunkMeasurementEngine.fitVerticalCylinder(leaning, 1))
    }

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

    @Test
    fun `rejects a narrow surface arc whose diameter is ambiguous`() {
        val points = buildList {
            repeat(30) { row ->
                repeat(20) { column ->
                    val angle = -0.12 + column * 0.012
                    add(
                        TrunkMeasurementEngine.WorldPoint(
                            x = cos(angle).toFloat() * 0.18f,
                            y = 0.4f + row * 0.025f,
                            z = -1.6f + sin(angle).toFloat() * 0.18f,
                        ),
                    )
                }
            }
        }

        assertNull(
            TrunkMeasurementEngine.fitVerticalCylinder(
                points = points,
                tierUsed = 1,
                scanDurationMs = 5000L,
            ),
        )
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
