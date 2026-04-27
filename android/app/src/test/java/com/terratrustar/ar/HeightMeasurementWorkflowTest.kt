package com.terratrustar.ar

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class HeightMeasurementWorkflowTest {

    @Test
    fun `prefers depth point over plane and feature point for base capture`() {
        val best =
            HeightMeasurementWorkflow.selectBestBaseHitKind(
                listOf(
                    HeightBaseHitKind.FEATURE_POINT,
                    HeightBaseHitKind.HORIZONTAL_PLANE,
                    HeightBaseHitKind.DEPTH_POINT,
                ),
            )

        assertEquals(HeightBaseHitKind.DEPTH_POINT, best)
    }

    @Test
    fun `returns null when no base hit candidates exist`() {
        val best = HeightMeasurementWorkflow.selectBestBaseHitKind(emptyList())

        assertNull(best)
    }

    @Test
    fun `uses error retry step after invalid top attempt and returns to preview after retry`() {
        val errorStep = HeightMeasurementWorkflow.nextStepForTopAttempt(success = false)
        val retryStep = HeightMeasurementWorkflow.stepAfterRetry(baseLocked = true)

        assertEquals(HeightMeasurementStep.STEP_ERROR_RETRY, errorStep)
        assertEquals(HeightMeasurementStep.STEP_2_TOP_PREVIEW, retryStep)
    }

    @Test
    fun `estimates a valid height from a plausible aim ray`() {
        val estimate =
            HeightMeasurementMath.estimateHeightFromRay(
                baseWorldPoint = floatArrayOf(0f, 0f, 0f),
                rayOrigin = floatArrayOf(1f, 1.5f, 2f),
                rayDirection = floatArrayOf(-0.35f, 0.7f, -0.62f),
            )

        requireNotNull(estimate)
        assertTrue(estimate.heightMetres in 1.0f..40f)
        assertTrue(estimate.missDistanceMetres <= estimate.allowedMissDistanceMetres)
    }

    @Test
    fun `rejects a ray that misses the tree vertical line by too much`() {
        val estimate =
            HeightMeasurementMath.estimateHeightFromRay(
                baseWorldPoint = floatArrayOf(0f, 0f, 0f),
                rayOrigin = floatArrayOf(4f, 1.5f, 2f),
                rayDirection = floatArrayOf(0.8f, 0.15f, 0.58f),
            )

        assertNull(estimate)
    }
}
