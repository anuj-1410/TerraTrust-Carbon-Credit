package com.terratrustar.ar

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.DashPathEffect
import android.graphics.Paint
import android.graphics.Path
import android.graphics.PointF
import android.graphics.RectF
import android.os.SystemClock
import android.util.AttributeSet
import android.view.View

class MeasurementOverlayView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
) : View(context, attrs) {

    data class TapFeedback(
        val point: PointF,
        val isSuccess: Boolean,
        val label: String? = null,
        val createdAtMs: Long = SystemClock.elapsedRealtime(),
    )

    data class State(
        val reticleLocked: Boolean = false,
        val topCircle: List<PointF> = emptyList(),
        val bottomCircle: List<PointF> = emptyList(),
        val cylinderSides: List<Pair<PointF, PointF>> = emptyList(),
        val baseMarker: PointF? = null,
        val topMarker: PointF? = null,
        val ghostTopMarker: PointF? = null,
        val heightLine: Pair<PointF, PointF>? = null,
        val heightLabel: String? = null,
        val showMotionGuide: Boolean = false,
        val motionGuideProgress: Float = 0f,
        val heightStep: HeightMeasurementStep? = null,
        val stageBadge: String? = null,
        val activeAimPoint: PointF? = null,
        val tapFeedbacks: List<TapFeedback> = emptyList(),
    )

    @Volatile
    private var state = State()

    private val reticlePaint =
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.WHITE
            style = Paint.Style.STROKE
            strokeWidth = 5f
        }

    private val lockPaint =
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.parseColor("#4ADE80")
            style = Paint.Style.STROKE
            strokeWidth = 6f
        }

    private val cylinderPaint =
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.parseColor("#4ADE80")
            style = Paint.Style.STROKE
            strokeWidth = 4f
            pathEffect = DashPathEffect(floatArrayOf(18f, 10f), 0f)
        }

    private val markerPaint =
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.parseColor("#2DD4BF")
            style = Paint.Style.FILL
        }

    private val outlinePaint =
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.WHITE
            style = Paint.Style.STROKE
            strokeWidth = 3f
        }

    private val heightLinePaint =
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.parseColor("#38BDF8")
            style = Paint.Style.STROKE
            strokeWidth = 5f
        }

    private val ghostMarkerPaint =
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.parseColor("#7DD3FC")
            style = Paint.Style.STROKE
            strokeWidth = 4f
            pathEffect = DashPathEffect(floatArrayOf(14f, 8f), 0f)
        }

    private val aimPointPaint =
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.parseColor("#FDE68A")
            style = Paint.Style.STROKE
            strokeWidth = 4f
        }

    private val labelTextPaint =
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.WHITE
            textSize = 34f
            textAlign = Paint.Align.CENTER
        }

    private val labelBackgroundPaint =
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.parseColor("#AA000000")
            style = Paint.Style.FILL
        }

    private val motionGuidePaint =
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.WHITE
            style = Paint.Style.STROKE
            strokeWidth = 5f
            alpha = 220
        }

    private val motionGuideFillPaint =
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.parseColor("#4ADE80")
            style = Paint.Style.STROKE
            strokeWidth = 7f
            alpha = 220
        }

    private val badgeBackgroundPaint =
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.parseColor("#CC111827")
            style = Paint.Style.FILL
        }

    private val badgeTextPaint =
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.WHITE
            textSize = 28f
            textAlign = Paint.Align.CENTER
        }

    private val stepActivePaint =
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.parseColor("#1F4ADE80")
            style = Paint.Style.FILL
        }

    private val stepCompletedPaint =
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.parseColor("#264ADE80")
            style = Paint.Style.FILL
        }

    private val stepInactivePaint =
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.parseColor("#B31F2937")
            style = Paint.Style.FILL
        }

    private val stepTextPaint =
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.WHITE
            textSize = 24f
            textAlign = Paint.Align.CENTER
        }

    private val successFeedbackPaint =
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.parseColor("#4ADE80")
            style = Paint.Style.STROKE
            strokeWidth = 6f
        }

    private val errorFeedbackPaint =
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.parseColor("#F87171")
            style = Paint.Style.STROKE
            strokeWidth = 6f
        }

    fun render(nextState: State) {
        state = nextState
        postInvalidateOnAnimation()
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)

        drawReticle(canvas)
        drawCylinder(canvas)
        drawHeightAnchors(canvas)
        drawMotionGuide(canvas)
        drawAimPoint(canvas)
        drawTapFeedbacks(canvas)
        drawStageBadge(canvas)
        drawHeightStepGuide(canvas)
        drawHeightLabel(canvas)
    }

    private fun drawReticle(canvas: Canvas) {
        val centerX = width / 2f
        val centerY = height / 2f
        val radius = width.coerceAtMost(height) * 0.045f
        val crossHalf = radius * 1.8f

        canvas.drawLine(centerX - crossHalf, centerY, centerX + crossHalf, centerY, reticlePaint)
        canvas.drawLine(centerX, centerY - crossHalf, centerX, centerY + crossHalf, reticlePaint)
        canvas.drawCircle(centerX, centerY, radius, reticlePaint)

        if (state.reticleLocked) {
            canvas.drawCircle(centerX, centerY, radius + 12f, lockPaint)
        }
    }

    private fun drawCylinder(canvas: Canvas) {
        drawPolyline(canvas, state.topCircle, closed = true)
        drawPolyline(canvas, state.bottomCircle, closed = true)
        state.cylinderSides.forEach { (start, end) ->
            canvas.drawLine(start.x, start.y, end.x, end.y, cylinderPaint)
        }
    }

    private fun drawPolyline(
        canvas: Canvas,
        points: List<PointF>,
        closed: Boolean,
    ) {
        if (points.size < 2) {
            return
        }

        val path = Path().apply {
            moveTo(points.first().x, points.first().y)
            points.drop(1).forEach { point ->
                lineTo(point.x, point.y)
            }
            if (closed) {
                close()
            }
        }
        canvas.drawPath(path, cylinderPaint)
    }

    private fun drawHeightAnchors(canvas: Canvas) {
        state.baseMarker?.let { marker ->
            canvas.drawCircle(marker.x, marker.y, 14f, markerPaint)
            canvas.drawCircle(marker.x, marker.y, 14f, outlinePaint)
        }
        state.ghostTopMarker?.let { marker ->
            canvas.drawCircle(marker.x, marker.y, 18f, ghostMarkerPaint)
        }
        state.topMarker?.let { marker ->
            canvas.drawCircle(marker.x, marker.y, 12f, lockPaint)
            canvas.drawCircle(marker.x, marker.y, 12f, outlinePaint)
        }
        state.heightLine?.let { (start, end) ->
            canvas.drawLine(start.x, start.y, end.x, end.y, heightLinePaint)
        }
    }

    private fun drawMotionGuide(canvas: Canvas) {
        if (!state.showMotionGuide) {
            return
        }

        val centerX = width / 2f
        val centerY = height * 0.74f
        val guideHalfWidth = width * 0.17f
        val progress = state.motionGuideProgress.coerceIn(0f, 1f)

        canvas.drawLine(centerX - guideHalfWidth, centerY, centerX + guideHalfWidth, centerY, motionGuidePaint)
        canvas.drawLine(
            centerX - guideHalfWidth,
            centerY,
            centerX - guideHalfWidth + 22f,
            centerY - 16f,
            motionGuidePaint,
        )
        canvas.drawLine(
            centerX - guideHalfWidth,
            centerY,
            centerX - guideHalfWidth + 22f,
            centerY + 16f,
            motionGuidePaint,
        )
        canvas.drawLine(
            centerX + guideHalfWidth,
            centerY,
            centerX + guideHalfWidth - 22f,
            centerY - 16f,
            motionGuidePaint,
        )
        canvas.drawLine(
            centerX + guideHalfWidth,
            centerY,
            centerX + guideHalfWidth - 22f,
            centerY + 16f,
            motionGuidePaint,
        )
        canvas.drawLine(
            centerX - guideHalfWidth,
            centerY,
            centerX - guideHalfWidth + (guideHalfWidth * 2f * progress),
            centerY,
            motionGuideFillPaint,
        )
    }

    private fun drawAimPoint(canvas: Canvas) {
        val aimPoint = state.activeAimPoint ?: return
        canvas.drawCircle(aimPoint.x, aimPoint.y, 18f, aimPointPaint)
        canvas.drawLine(aimPoint.x - 22f, aimPoint.y, aimPoint.x + 22f, aimPoint.y, aimPointPaint)
        canvas.drawLine(aimPoint.x, aimPoint.y - 22f, aimPoint.x, aimPoint.y + 22f, aimPointPaint)
    }

    private fun drawTapFeedbacks(canvas: Canvas) {
        val now = SystemClock.elapsedRealtime()
        state.tapFeedbacks.forEach { feedback ->
            val age = (now - feedback.createdAtMs).coerceAtLeast(0L)
            if (age > 520L) {
                return@forEach
            }

            val progress = age / 520f
            val paint = if (feedback.isSuccess) successFeedbackPaint else errorFeedbackPaint
            paint.alpha = ((1f - progress) * 255f).toInt().coerceIn(50, 255)
            val radius = 24f + (progress * 44f)
            canvas.drawCircle(feedback.point.x, feedback.point.y, radius, paint)

            feedback.label?.let { label ->
                val textY = feedback.point.y + radius + 30f
                val textWidth = badgeTextPaint.measureText(label)
                val rect =
                    RectF(
                        feedback.point.x - textWidth / 2f - 14f,
                        textY - 28f,
                        feedback.point.x + textWidth / 2f + 14f,
                        textY + 10f,
                    )
                badgeBackgroundPaint.alpha = ((1f - progress) * 220f).toInt().coerceIn(40, 220)
                canvas.drawRoundRect(rect, 16f, 16f, badgeBackgroundPaint)
                badgeTextPaint.alpha = paint.alpha
                canvas.drawText(label, feedback.point.x, textY, badgeTextPaint)
                badgeTextPaint.alpha = 255
                badgeBackgroundPaint.alpha = 255
            }
        }
    }

    private fun drawStageBadge(canvas: Canvas) {
        val badge = state.stageBadge ?: return
        val centerX = width / 2f
        val top = height * 0.16f
        val textWidth = badgeTextPaint.measureText(badge)
        val rect =
            RectF(
                centerX - textWidth / 2f - 20f,
                top - 28f,
                centerX + textWidth / 2f + 20f,
                top + 20f,
            )
        canvas.drawRoundRect(rect, 20f, 20f, badgeBackgroundPaint)
        canvas.drawText(badge, centerX, top + 6f, badgeTextPaint)
    }

    private fun drawHeightStepGuide(canvas: Canvas) {
        if (state.heightStep == null) {
            return
        }

        val baseCompleted = state.baseMarker != null
        val topCompleted = state.topMarker != null
        val firstStepRect = RectF(width * 0.16f, height * 0.80f, width * 0.44f, height * 0.86f)
        val secondStepRect = RectF(width * 0.56f, height * 0.80f, width * 0.84f, height * 0.86f)

        canvas.drawRoundRect(firstStepRect, 22f, 22f, when {
            baseCompleted -> stepCompletedPaint
            else -> stepActivePaint
        })
        canvas.drawRoundRect(secondStepRect, 22f, 22f, when {
            topCompleted -> stepCompletedPaint
            baseCompleted -> stepActivePaint
            else -> stepInactivePaint
        })

        canvas.drawText("1 Mark base", firstStepRect.centerX(), firstStepRect.centerY() + 8f, stepTextPaint)
        canvas.drawText("2 Mark top", secondStepRect.centerX(), secondStepRect.centerY() + 8f, stepTextPaint)
    }

    private fun drawHeightLabel(canvas: Canvas) {
        val label = state.heightLabel ?: return
        val line = state.heightLine ?: return
        val centerX = (line.first.x + line.second.x) / 2f
        val labelY = minOf(line.first.y, line.second.y) - 42f
        val textWidth = labelTextPaint.measureText(label)
        val rect = RectF(
            centerX - textWidth / 2f - 16f,
            labelY - 38f,
            centerX + textWidth / 2f + 16f,
            labelY + 12f,
        )
        canvas.drawRoundRect(rect, 14f, 14f, labelBackgroundPaint)
        canvas.drawText(label, centerX, labelY, labelTextPaint)
    }
}
