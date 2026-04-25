package com.terratrustar.ar

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.DashPathEffect
import android.graphics.Paint
import android.graphics.Path
import android.graphics.PointF
import android.graphics.RectF
import android.util.AttributeSet
import android.view.View

class MeasurementOverlayView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
) : View(context, attrs) {

    data class State(
        val reticleLocked: Boolean = false,
        val topCircle: List<PointF> = emptyList(),
        val bottomCircle: List<PointF> = emptyList(),
        val cylinderSides: List<Pair<PointF, PointF>> = emptyList(),
        val baseMarker: PointF? = null,
        val topMarker: PointF? = null,
        val heightLine: Pair<PointF, PointF>? = null,
        val heightLabel: String? = null,
        val showMotionGuide: Boolean = false,
        val motionGuideProgress: Float = 0f,
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
