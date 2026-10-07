package com.terratrustar.ar

import kotlin.math.*

/** Pure geometry shared with tests; display right is supplied by ARCore, not sensor X. */
object DiameterScanQuality {
    fun lateralOffset(delta: FloatArray, displayRight: FloatArray): Float {
        val length = hypot(displayRight[0], displayRight[2])
        if (length < 0.001f) return 0f
        return (delta[0] * displayRight[0] + delta[2] * displayRight[2]) / length
    }

    fun consistent(a: TrunkMeasurementEngine.CylinderFit, b: TrunkMeasurementEngine.CylinderFit): Boolean {
        val toleranceCm = max(1.5f, b.diameterCm * 0.05f)
        return abs(a.diameterCm - b.diameterCm) <= toleranceCm &&
            hypot(a.centerX - b.centerX, a.centerZ - b.centerZ) <= max(0.015f, b.radiusM * 0.08f)
    }
}
