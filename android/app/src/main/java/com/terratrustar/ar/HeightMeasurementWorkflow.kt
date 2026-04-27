package com.terratrustar.ar

enum class HeightMeasurementStep {
    STEP_1_BASE_TARGET,
    STEP_1_BASE_LOCKED,
    STEP_2_TOP_PREVIEW,
    STEP_2_TOP_CONFIRMED,
    STEP_ERROR_RETRY,
}

enum class HeightBaseHitKind {
    DEPTH_POINT,
    HORIZONTAL_PLANE,
    OTHER_PLANE,
    FEATURE_POINT,
}

object HeightMeasurementWorkflow {

    fun selectBestBaseHitKind(kinds: List<HeightBaseHitKind>): HeightBaseHitKind? {
        return kinds.minByOrNull(::priorityForBaseHit)
    }

    fun nextStepForBaseCapture(success: Boolean): HeightMeasurementStep {
        return if (success) {
            HeightMeasurementStep.STEP_1_BASE_LOCKED
        } else {
            HeightMeasurementStep.STEP_ERROR_RETRY
        }
    }

    fun nextStepForTopAttempt(success: Boolean): HeightMeasurementStep {
        return if (success) {
            HeightMeasurementStep.STEP_2_TOP_CONFIRMED
        } else {
            HeightMeasurementStep.STEP_ERROR_RETRY
        }
    }

    fun stepAfterRetry(baseLocked: Boolean): HeightMeasurementStep {
        return if (baseLocked) {
            HeightMeasurementStep.STEP_2_TOP_PREVIEW
        } else {
            HeightMeasurementStep.STEP_1_BASE_TARGET
        }
    }

    private fun priorityForBaseHit(kind: HeightBaseHitKind): Int {
        return when (kind) {
            HeightBaseHitKind.DEPTH_POINT -> 0
            HeightBaseHitKind.HORIZONTAL_PLANE -> 1
            HeightBaseHitKind.OTHER_PLANE -> 2
            HeightBaseHitKind.FEATURE_POINT -> 3
        }
    }
}
