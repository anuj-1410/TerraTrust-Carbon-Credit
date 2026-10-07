package com.terratrustar.ar

import org.junit.Assert.assertEquals
import org.junit.Test

class DiameterScanQualityTest {
    @Test
    fun `portrait display right registers a sideways step`() {
        // A portrait phone's sensor X can be vertical; display X is horizontal.
        val offset = DiameterScanQuality.lateralOffset(floatArrayOf(0.25f, 0.02f, 0f), floatArrayOf(1f, 0f, 0f))
        assertEquals(0.25f, offset, 0.001f)
    }

    @Test
    fun `tilting or lifting the phone does not count as lateral motion`() {
        assertEquals(0f, DiameterScanQuality.lateralOffset(floatArrayOf(0f, 0.30f, 0f), floatArrayOf(0.9f, 0.4f, 0f)), 0.001f)
    }

    @Test
    fun `display right is normalized in the ground plane`() {
        assertEquals(0.22f, DiameterScanQuality.lateralOffset(floatArrayOf(0f, 0f, 0.22f), floatArrayOf(0f, 0.6f, 0.8f)), 0.001f)
    }
}
