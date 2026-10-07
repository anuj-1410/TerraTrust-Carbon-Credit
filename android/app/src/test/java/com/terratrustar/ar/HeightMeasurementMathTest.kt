package com.terratrustar.ar

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class HeightMeasurementMathTest {
    @Test
    fun `top must be above the marked base`() {
        assertNull(HeightMeasurementMath.heightAboveBase(0.5f, 1.0f))
        assertNull(HeightMeasurementMath.heightAboveBase(1.3f, 1.0f))
        assertEquals(7.0f, HeightMeasurementMath.heightAboveBase(8.0f, 1.0f)!!, 0.001f)
    }
}
