package com.terratrustar.ar

import kotlin.math.sqrt

data class HeightRayEstimate(
    val heightMetres: Float,
    val topWorldPoint: FloatArray,
    val missDistanceMetres: Float,
    val allowedMissDistanceMetres: Float,
)

object HeightMeasurementMath {

    fun estimateHeightFromRay(
        baseWorldPoint: FloatArray,
        rayOrigin: FloatArray,
        rayDirection: FloatArray,
    ): HeightRayEstimate? {
        val wx = rayOrigin[0] - baseWorldPoint[0]
        val wy = rayOrigin[1] - baseWorldPoint[1]
        val wz = rayOrigin[2] - baseWorldPoint[2]
        val rayDotUp = rayDirection[1]
        val rayDotOffset =
            rayDirection[0] * wx +
                rayDirection[1] * wy +
                rayDirection[2] * wz
        val denominator = 1f - rayDotUp * rayDotUp
        if (denominator < 0.0005f) {
            return null
        }

        val rayDistance = ((rayDotUp * wy) - rayDotOffset) / denominator
        if (rayDistance <= 0f) {
            return null
        }

        val heightMetres = wy + rayDotUp * rayDistance
        if (heightMetres < 0.5f || heightMetres > 80f) {
            return null
        }

        val closestRayPoint =
            floatArrayOf(
                rayOrigin[0] + rayDirection[0] * rayDistance,
                rayOrigin[1] + rayDirection[1] * rayDistance,
                rayOrigin[2] + rayDirection[2] * rayDistance,
            )
        val closestVerticalPoint =
            floatArrayOf(
                baseWorldPoint[0],
                baseWorldPoint[1] + heightMetres,
                baseWorldPoint[2],
            )
        val missDistance = distance(closestRayPoint, closestVerticalPoint)
        val phoneBaseDistance = sqrt(wx * wx + wz * wz)
        val allowedMiss = (phoneBaseDistance * 0.35f + 0.45f).coerceIn(0.75f, 2.5f)
        if (missDistance > allowedMiss) {
            return null
        }

        return HeightRayEstimate(
            heightMetres = heightMetres,
            topWorldPoint =
                floatArrayOf(
                    baseWorldPoint[0],
                    baseWorldPoint[1] + heightMetres,
                    baseWorldPoint[2],
                ),
            missDistanceMetres = missDistance,
            allowedMissDistanceMetres = allowedMiss,
        )
    }

    private fun distance(first: FloatArray, second: FloatArray): Float {
        val dx = first[0] - second[0]
        val dy = first[1] - second[1]
        val dz = first[2] - second[2]
        return sqrt(dx * dx + dy * dy + dz * dz)
    }
}
