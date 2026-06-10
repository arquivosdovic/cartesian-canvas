/**
 * renderer.js
 * Handles all Canvas 2D drawing of the cartesian plane.
 * The key fix for long labels: axis labels are drawn OUTSIDE the plot area,
 * with wrapping and dynamic padding to ensure they are fully visible.
 */

import { state } from './store.js';

const IMAGE_CACHE = new Map();

const AVATAR_RADIUS = 18;
const MAX_SCORE = 10;

/**
 * Preload or retrieve cached Image object for an element.
 */
function getImage(element) {
  if (!element.photo) return null;
  if (!IMAGE_CACHE.has(element.id)) {
    const img = new Image();
    img.src = element.photo;
    img.onload = () => requestRedraw();
    IMAGE_CACHE.set(element.id, img);
  }
  return IMAGE_CACHE.get(element.id);
}

export function evictImageCache(id) {
  IMAGE_CACHE.delete(id);
}

let redrawScheduled = false;
let canvasEl = null;

export function init(canvas) {
  canvasEl = canvas;
}

export function requestRedraw() {
  if (!redrawScheduled) {
    redrawScheduled = true;
    requestAnimationFrame(() => {
      redrawScheduled = false;
      draw(canvasEl);
    });
  }
}

/**
 * Measure the width of a label at the given font settings.
 */
function measureLabel(ctx, text, font) {
  ctx.save();
  ctx.font = font;
  const w = ctx.measureText(text).width;
  ctx.restore();
  return w;
}

/**
 * Draw text that wraps within maxWidth, returning the total height used.
 */
function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let currentY = y;
  for (let i = 0; i < words.length; i++) {
    const testLine = line ? line + ' ' + words[i] : words[i];
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && line !== '') {
      ctx.fillText(line, x, currentY);
      line = words[i];
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, currentY);
  return currentY - y + lineHeight;
}

/**
 * Compute the position of an element in canvas coordinates.
 * x = (right - left) / MAX_SCORE  mapped to [cx-rW, cx+rW]
 * y = (top - bottom) / MAX_SCORE  mapped to [cy+rH, cy-rH]  (canvas Y flipped)
 */
function calcCanvasPos(scores, cx, cy, rW, rH) {
  const nx = (scores.right - scores.left) / MAX_SCORE;
  const ny = (scores.top - scores.bottom) / MAX_SCORE;
  return {
    x: cx + nx * rW,
    y: cy - ny * rH,
  };
}

/**
 * Detect dark mode via CSS variable or media query.
 */
function isDarkMode() {
  const bg = getComputedStyle(document.documentElement)
    .getPropertyValue('--color-bg-primary').trim();
  if (bg) {
    const r = parseInt(bg.slice(1, 3), 16);
    return r < 80;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Resolve CSS variable or fallback.
 */
function cssVar(name, fallback) {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name).trim() || fallback;
}

export function draw(canvas) {
  if (!canvas) return;

  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth;
  const H = canvas.clientHeight;

  canvas.width = W * dpr;
  canvas.height = H * dpr;

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);

  const dark = isDarkMode();
  const textColor  = cssVar('--color-text-primary',   dark ? '#e8e8e8' : '#1a1a1a');
  const mutedColor = cssVar('--color-text-secondary',  dark ? '#aaa9a4' : '#5f5e5a');
  const axisColor  = cssVar('--color-axis',            dark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)');
  const gridColor  = cssVar('--color-grid',            dark ? 'rgba(255,255,255,0.055)' : 'rgba(0,0,0,0.055)');
  const labelBg    = cssVar('--color-label-bg',        dark ? 'rgba(30,30,30,0.88)' : 'rgba(255,255,255,0.88)');
  const accentColor = cssVar('--color-accent', '#7f77dd');
  const accentLight = cssVar('--color-accent-light', '#eeedfe');
  const accentDark  = cssVar('--color-accent-dark', '#3c3489');

  const LABEL_FONT  = '500 13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  const AXIS_LABEL_MAX_W = W * 0.18; // max width for side labels before wrapping
  const LABEL_LINE_H = 16;
  const LABEL_PADDING = 10; // gap between label text and axis arrow tip

  // ── Measure label widths to compute dynamic padding ──────────────────────
  ctx.font = LABEL_FONT;
  const topLabelW    = ctx.measureText(state.labels.top).width;
  const bottomLabelW = ctx.measureText(state.labels.bottom).width;

  // For side labels we allow wrapping, so padding = min(actual width, max allowed) + gap
  const leftLabelW  = Math.min(ctx.measureText(state.labels.left).width,  AXIS_LABEL_MAX_W);
  const rightLabelW = Math.min(ctx.measureText(state.labels.right).width, AXIS_LABEL_MAX_W);

  // Number of wrap lines for side labels (approximate)
  const leftLines  = Math.ceil(ctx.measureText(state.labels.left).width  / AXIS_LABEL_MAX_W);
  const rightLines = Math.ceil(ctx.measureText(state.labels.right).width / AXIS_LABEL_MAX_W);

  const padTop    = LABEL_LINE_H * 1 + LABEL_PADDING + 20;
  const padBottom = LABEL_LINE_H * 1 + LABEL_PADDING + 20;
  const padLeft   = leftLabelW  + LABEL_PADDING + 16;
  const padRight  = rightLabelW + LABEL_PADDING + 16;

  const plotX = padLeft;
  const plotY = padTop;
  const plotW = W - padLeft - padRight;
  const plotH = H - padTop - padBottom;

  const cx = plotX + plotW / 2;
  const cy = plotY + plotH / 2;
  const rW = plotW / 2;
  const rH = plotH / 2;

  // ── Grid lines ────────────────────────────────────────────────────────────
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.5;
  const steps = 4;
  for (let i = 1; i <= steps; i++) {
    const f = i / steps;
    // Vertical
    [cx + rW * f, cx - rW * f].forEach(x => {
      ctx.beginPath(); ctx.moveTo(x, plotY); ctx.lineTo(x, plotY + plotH); ctx.stroke();
    });
    // Horizontal
    [cy + rH * f, cy - rH * f].forEach(y => {
      ctx.beginPath(); ctx.moveTo(plotX, y); ctx.lineTo(plotX + plotW, y); ctx.stroke();
    });
  }

  // ── Plot border ───────────────────────────────────────────────────────────
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.5;
  ctx.strokeRect(plotX, plotY, plotW, plotH);

  // ── Axes ──────────────────────────────────────────────────────────────────
  const arrowLen = 7;
  ctx.strokeStyle = axisColor;
  ctx.fillStyle   = axisColor;
  ctx.lineWidth   = 1;

  // Horizontal axis
  ctx.beginPath(); ctx.moveTo(plotX, cy); ctx.lineTo(plotX + plotW, cy); ctx.stroke();
  // Right arrow
  ctx.beginPath();
  ctx.moveTo(plotX + plotW, cy);
  ctx.lineTo(plotX + plotW - arrowLen, cy - arrowLen / 2);
  ctx.lineTo(plotX + plotW - arrowLen, cy + arrowLen / 2);
  ctx.closePath(); ctx.fill();
  // Left arrow
  ctx.beginPath();
  ctx.moveTo(plotX, cy);
  ctx.lineTo(plotX + arrowLen, cy - arrowLen / 2);
  ctx.lineTo(plotX + arrowLen, cy + arrowLen / 2);
  ctx.closePath(); ctx.fill();

  // Vertical axis
  ctx.beginPath(); ctx.moveTo(cx, plotY); ctx.lineTo(cx, plotY + plotH); ctx.stroke();
  // Top arrow
  ctx.beginPath();
  ctx.moveTo(cx, plotY);
  ctx.lineTo(cx - arrowLen / 2, plotY + arrowLen);
  ctx.lineTo(cx + arrowLen / 2, plotY + arrowLen);
  ctx.closePath(); ctx.fill();
  // Bottom arrow
  ctx.beginPath();
  ctx.moveTo(cx, plotY + plotH);
  ctx.lineTo(cx - arrowLen / 2, plotY + plotH - arrowLen);
  ctx.lineTo(cx + arrowLen / 2, plotY + plotH - arrowLen);
  ctx.closePath(); ctx.fill();

  // ── Axis labels ───────────────────────────────────────────────────────────
  ctx.font = LABEL_FONT;
  ctx.fillStyle = textColor;

  // Top label — centered above plot area
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(state.labels.top, cx, plotY - LABEL_PADDING);

  // Bottom label — centered below plot area
  ctx.textBaseline = 'top';
  ctx.fillText(state.labels.bottom, cx, plotY + plotH + LABEL_PADDING);

  // Left label — right-aligned, vertically centered, wrapped
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  const leftTotalH = leftLines * LABEL_LINE_H;
  const leftStartY = cy - leftTotalH / 2 + LABEL_LINE_H / 2;
  drawWrappedText(ctx, state.labels.left, plotX - LABEL_PADDING, leftStartY, AXIS_LABEL_MAX_W, LABEL_LINE_H);

  // Right label — left-aligned, vertically centered, wrapped
  ctx.textAlign = 'left';
  const rightTotalH = rightLines * LABEL_LINE_H;
  const rightStartY = cy - rightTotalH / 2 + LABEL_LINE_H / 2;
  drawWrappedText(ctx, state.labels.right, plotX + plotW + LABEL_PADDING, rightStartY, AXIS_LABEL_MAX_W, LABEL_LINE_H);

  // ── Elements ──────────────────────────────────────────────────────────────
  ctx.textBaseline = 'alphabetic';

  state.elements.forEach(el => {
    const pos = calcCanvasPos(el.scores, cx, cy, rW, rH);
    const isSelected = el.id === state.selectedId;

    // Selection ring
    if (isSelected) {
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, AVATAR_RADIUS + 4, 0, Math.PI * 2);
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Avatar circle
    const img = getImage(el);
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, AVATAR_RADIUS, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, pos.x - AVATAR_RADIUS, pos.y - AVATAR_RADIUS, AVATAR_RADIUS * 2, AVATAR_RADIUS * 2);
      ctx.restore();

      ctx.beginPath();
      ctx.arc(pos.x, pos.y, AVATAR_RADIUS, 0, Math.PI * 2);
      ctx.strokeStyle = isSelected ? accentColor : 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, AVATAR_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? accentLight : (dark ? '#333' : '#d3d1c7');
      ctx.fill();
      ctx.strokeStyle = isSelected ? accentColor : axisColor;
      ctx.lineWidth = 1;
      ctx.stroke();

      // Initials
      ctx.font = '500 11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = isSelected ? accentDark : textColor;
      ctx.fillText(initials(el.name), pos.x, pos.y);
    }

    // Name label below avatar
    const LABEL_FONT_SMALL = '500 11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.font = LABEL_FONT_SMALL;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';

    const nameW = ctx.measureText(el.name).width;
    const lx = pos.x;
    const ly = pos.y + AVATAR_RADIUS + 13;

    ctx.fillStyle = labelBg;
    ctx.beginPath();
    ctx.roundRect(lx - nameW / 2 - 4, ly - 11, nameW + 8, 15, 3);
    ctx.fill();

    ctx.fillStyle = textColor;
    ctx.fillText(el.name, lx, ly);
  });
}

function initials(name) {
  return name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() || '')
    .join('');
}
