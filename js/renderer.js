/**
 * renderer.js
 * Handles all Canvas 2D drawing of the cartesian plane.
 */

import { state } from './store.js';

const IMAGE_CACHE = new Map();
const AVATAR_RADIUS = 18;
const MAX_SCORE = 10;

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

function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let currentY = y;
  for (let i = 0; i < words.length; i++) {
    const testLine = line ? line + ' ' + words[i] : words[i];
    if (ctx.measureText(testLine).width > maxWidth && line !== '') {
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

function calcCanvasPos(scores, cx, cy, rW, rH) {
  const nx = (scores.right - scores.left) / MAX_SCORE;
  const ny = (scores.top - scores.bottom) / MAX_SCORE;
  return { x: cx + nx * rW, y: cy - ny * rH };
}

function isDarkMode() {
  if (document.documentElement.dataset.theme === 'dark')  return true;
  if (document.documentElement.dataset.theme === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function cssVar(name, fallback) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

/**
 * Draw the plane onto any canvas (used both for display and capture).
 * bgColor: CSS color string or null for transparent.
 */
export function draw(canvas, { bgColor = null } = {}) {
  if (!canvas) return;

  const dpr = window.devicePixelRatio || 1;
  const W   = canvas.clientWidth;
  const H   = canvas.clientHeight;
  if (W === 0 || H === 0) return;

  canvas.width  = W * dpr;
  canvas.height = H * dpr;

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);

  if (bgColor) {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, W, H);
  }

  const dark = isDarkMode();
  const textColor   = cssVar('--color-text-primary',  dark ? '#e8e8e8' : '#1a1a1a');
  const axisColor   = cssVar('--color-axis',           dark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)');
  const gridColor   = cssVar('--color-grid',           dark ? 'rgba(255,255,255,0.055)' : 'rgba(0,0,0,0.055)');
  const labelBg     = cssVar('--color-label-bg',       dark ? 'rgba(30,30,30,0.88)' : 'rgba(255,255,255,0.88)');
  const accentColor = cssVar('--color-accent',         dark ? '#9d96e8' : '#7f77dd');
  const accentLight = cssVar('--color-accent-light',   dark ? '#2a2654' : '#eeedfe');
  const accentDark  = cssVar('--color-accent-dark',    dark ? '#cbc8f8' : '#3c3489');

  const LABEL_FONT       = '500 13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  const AXIS_LABEL_MAX_W = W * 0.18;
  const LABEL_LINE_H     = 16;
  const LABEL_PADDING    = 10;

  ctx.font = LABEL_FONT;
  const leftLabelW  = Math.min(ctx.measureText(state.labels.left).width,  AXIS_LABEL_MAX_W);
  const rightLabelW = Math.min(ctx.measureText(state.labels.right).width, AXIS_LABEL_MAX_W);
  const leftLines   = Math.ceil(ctx.measureText(state.labels.left).width  / AXIS_LABEL_MAX_W);
  const rightLines  = Math.ceil(ctx.measureText(state.labels.right).width / AXIS_LABEL_MAX_W);

  const padTop    = LABEL_LINE_H + LABEL_PADDING + 20;
  const padBottom = LABEL_LINE_H + LABEL_PADDING + 20;
  const padLeft   = leftLabelW  + LABEL_PADDING + 16;
  const padRight  = rightLabelW + LABEL_PADDING + 16;

  const plotX = padLeft;
  const plotY = padTop;
  const plotW = W - padLeft - padRight;
  const plotH = H - padTop  - padBottom;
  const cx    = plotX + plotW / 2;
  const cy    = plotY + plotH / 2;
  const rW    = plotW / 2;
  const rH    = plotH / 2;

  // ── Grid ──────────────────────────────────────────────────────────────────
  ctx.strokeStyle = gridColor;
  ctx.lineWidth   = 0.5;
  for (let i = 1; i <= 4; i++) {
    const f = i / 4;
    [cx + rW * f, cx - rW * f].forEach(x => {
      ctx.beginPath(); ctx.moveTo(x, plotY); ctx.lineTo(x, plotY + plotH); ctx.stroke();
    });
    [cy + rH * f, cy - rH * f].forEach(y => {
      ctx.beginPath(); ctx.moveTo(plotX, y); ctx.lineTo(plotX + plotW, y); ctx.stroke();
    });
  }
  ctx.strokeRect(plotX, plotY, plotW, plotH);

  // ── Axes ──────────────────────────────────────────────────────────────────
  const arrowLen = 7;
  ctx.strokeStyle = axisColor;
  ctx.fillStyle   = axisColor;
  ctx.lineWidth   = 1;

  ctx.beginPath(); ctx.moveTo(plotX, cy); ctx.lineTo(plotX + plotW, cy); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(plotX + plotW, cy);
  ctx.lineTo(plotX + plotW - arrowLen, cy - arrowLen / 2);
  ctx.lineTo(plotX + plotW - arrowLen, cy + arrowLen / 2);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(plotX, cy);
  ctx.lineTo(plotX + arrowLen, cy - arrowLen / 2);
  ctx.lineTo(plotX + arrowLen, cy + arrowLen / 2);
  ctx.closePath(); ctx.fill();

  ctx.beginPath(); ctx.moveTo(cx, plotY); ctx.lineTo(cx, plotY + plotH); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, plotY);
  ctx.lineTo(cx - arrowLen / 2, plotY + arrowLen);
  ctx.lineTo(cx + arrowLen / 2, plotY + arrowLen);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx, plotY + plotH);
  ctx.lineTo(cx - arrowLen / 2, plotY + plotH - arrowLen);
  ctx.lineTo(cx + arrowLen / 2, plotY + plotH - arrowLen);
  ctx.closePath(); ctx.fill();

  // ── Axis labels ───────────────────────────────────────────────────────────
  ctx.font      = LABEL_FONT;
  ctx.fillStyle = textColor;

  ctx.textAlign    = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(state.labels.top, cx, plotY - LABEL_PADDING);

  ctx.textBaseline = 'top';
  ctx.fillText(state.labels.bottom, cx, plotY + plotH + LABEL_PADDING);

  ctx.textAlign    = 'right';
  ctx.textBaseline = 'middle';
  const leftStartY = cy - (leftLines * LABEL_LINE_H) / 2 + LABEL_LINE_H / 2;
  drawWrappedText(ctx, state.labels.left, plotX - LABEL_PADDING, leftStartY, AXIS_LABEL_MAX_W, LABEL_LINE_H);

  ctx.textAlign = 'left';
  const rightStartY = cy - (rightLines * LABEL_LINE_H) / 2 + LABEL_LINE_H / 2;
  drawWrappedText(ctx, state.labels.right, plotX + plotW + LABEL_PADDING, rightStartY, AXIS_LABEL_MAX_W, LABEL_LINE_H);

  // ── Elements (skip hidden) ────────────────────────────────────────────────
  ctx.textBaseline = 'alphabetic';

  state.elements.filter(el => !el.hidden).forEach(el => {
    const pos        = calcCanvasPos(el.scores, cx, cy, rW, rH);
    const isSelected = el.id === state.selectedId;

    if (isSelected) {
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, AVATAR_RADIUS + 4, 0, Math.PI * 2);
      ctx.strokeStyle = accentColor;
      ctx.lineWidth   = 2;
      ctx.stroke();
    }

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
      ctx.lineWidth   = 1.5;
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, AVATAR_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle   = isSelected ? accentLight : (dark ? '#333' : '#d3d1c7');
      ctx.fill();
      ctx.strokeStyle = isSelected ? accentColor : axisColor;
      ctx.lineWidth   = 1;
      ctx.stroke();
      ctx.font         = '500 11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle    = isSelected ? accentDark : textColor;
      ctx.fillText(initials(el.name), pos.x, pos.y);
    }

    ctx.font         = '500 11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'alphabetic';
    const nameW = ctx.measureText(el.name).width;
    const lx    = pos.x;
    const ly    = pos.y + AVATAR_RADIUS + 13;
    ctx.fillStyle = labelBg;
    ctx.beginPath();
    ctx.roundRect(lx - nameW / 2 - 4, ly - 11, nameW + 8, 15, 3);
    ctx.fill();
    ctx.fillStyle = textColor;
    ctx.fillText(el.name, lx, ly);
  });
}

function initials(name) {
  return name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('');
}
