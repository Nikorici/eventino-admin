import type { CanvasSize } from '@/types/seating';

import type { Point } from './hitTest';
import type { Rect } from './seatIndex';

export interface Transform {
  scale: number;
  tx: number;
  ty: number;
}

export interface ScaleLimits {
  minScale: number;
  maxScale: number;
}

export interface TranslateBounds {
  minTx: number;
  maxTx: number;
  minTy: number;
  maxTy: number;
}

export const MIN_SCALE_FACTOR = 0.8;
export const MAX_SCALE_FLOOR = 2.5;
export const MAX_SCALE_FIT_FACTOR = 8;
export const MAX_SEAT_DIAMETER_PT = 60;
export const SECTION_TIER_FIT_FACTOR = 2;
export const SECTION_TIER_MAX_SEAT_PT = 7;
export const LABEL_GLYPH_PT = 14;
export const SECTION_ZOOM_PADDING = 24;
export const SECTION_ENTRY_MARGIN = 1.1;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function fitScale(canvas: CanvasSize, container: CanvasSize, padding = 0): number {
  const availableWidth = Math.max(1, container.width - padding * 2);
  const availableHeight = Math.max(1, container.height - padding * 2);
  return Math.min(availableWidth / Math.max(1, canvas.width), availableHeight / Math.max(1, canvas.height));
}

export function centerOffsets(canvas: CanvasSize, container: CanvasSize, scale: number): { tx: number; ty: number } {
  return {
    tx: (container.width - canvas.width * scale) / 2,
    ty: (container.height - canvas.height * scale) / 2,
  };
}

export function fitTransform(canvas: CanvasSize, container: CanvasSize, padding = 0): Transform {
  const scale = fitScale(canvas, container, padding);
  return { scale, ...centerOffsets(canvas, container, scale) };
}

export function scaleLimits(fit: number, seatRadius: number): ScaleLimits {
  const minScale = fit * MIN_SCALE_FACTOR;
  const seatCap = MAX_SEAT_DIAMETER_PT / (2 * Math.max(1, seatRadius));
  const maxScale = Math.max(minScale, Math.min(Math.max(MAX_SCALE_FLOOR, fit * MAX_SCALE_FIT_FACTOR), seatCap));
  return { minScale, maxScale };
}

export function sectionTierScale(fit: number): number {
  return fit * SECTION_TIER_FIT_FACTOR;
}

export function needsSectionTier(fit: number, seatRadius: number): boolean {
  return fit * seatRadius < SECTION_TIER_MAX_SEAT_PT;
}

export function sectionEntryScale(fit: number): number {
  return sectionTierScale(fit) * SECTION_ENTRY_MARGIN;
}

export function labelScale(seatRadius: number): number {
  return LABEL_GLYPH_PT / Math.max(1, seatRadius);
}

export function translateBounds(canvas: CanvasSize, container: CanvasSize, scale: number): TranslateBounds {
  const contentWidth = canvas.width * scale;
  const contentHeight = canvas.height * scale;
  const horizontal =
    contentWidth > container.width
      ? { min: container.width - contentWidth, max: 0 }
      : { min: (container.width - contentWidth) / 2, max: (container.width - contentWidth) / 2 };
  const vertical =
    contentHeight > container.height
      ? { min: container.height - contentHeight, max: 0 }
      : { min: (container.height - contentHeight) / 2, max: (container.height - contentHeight) / 2 };
  return { minTx: horizontal.min, maxTx: horizontal.max, minTy: vertical.min, maxTy: vertical.max };
}

export function clampTransform(
  transform: Transform,
  canvas: CanvasSize,
  container: CanvasSize,
  limits: ScaleLimits,
): Transform {
  const scale = clamp(transform.scale, limits.minScale, limits.maxScale);
  const bounds = translateBounds(canvas, container, scale);
  return {
    scale,
    tx: clamp(transform.tx, bounds.minTx, bounds.maxTx),
    ty: clamp(transform.ty, bounds.minTy, bounds.maxTy),
  };
}

export function zoomAtPoint(
  transform: Transform,
  factor: number,
  focal: Point,
  canvas: CanvasSize,
  container: CanvasSize,
  limits: ScaleLimits,
): Transform {
  const scale = clamp(transform.scale * factor, limits.minScale, limits.maxScale);
  const ratio = scale / transform.scale;
  return clampTransform(
    {
      scale,
      tx: focal.x - (focal.x - transform.tx) * ratio,
      ty: focal.y - (focal.y - transform.ty) * ratio,
    },
    canvas,
    container,
    limits,
  );
}

export function sectionZoom(
  bounds: Rect,
  canvas: CanvasSize,
  container: CanvasSize,
  limits: ScaleLimits,
  padding = SECTION_ZOOM_PADDING,
  minEntryScale = 0,
  anchor?: Point,
): Transform {
  const width = Math.max(1, bounds.maxX - bounds.minX);
  const height = Math.max(1, bounds.maxY - bounds.minY);
  const availableWidth = Math.max(1, container.width - padding * 2);
  const availableHeight = Math.max(1, container.height - padding * 2);
  const fitToSection = Math.min(availableWidth / width, availableHeight / height);
  const scale = clamp(Math.max(fitToSection, minEntryScale), limits.minScale, limits.maxScale);
  const centerX = anchor ? anchor.x : (bounds.minX + bounds.maxX) / 2;
  const centerY = anchor ? anchor.y : (bounds.minY + bounds.maxY) / 2;
  return clampTransform(
    {
      scale,
      tx: container.width / 2 - centerX * scale,
      ty: container.height / 2 - centerY * scale,
    },
    canvas,
    container,
    limits,
  );
}

export function visibleRect(transform: Transform, container: CanvasSize): Rect {
  return {
    minX: -transform.tx / transform.scale,
    minY: -transform.ty / transform.scale,
    maxX: (container.width - transform.tx) / transform.scale,
    maxY: (container.height - transform.ty) / transform.scale,
  };
}

export function rectContains(rect: Rect, x: number, y: number, margin = 0): boolean {
  return x >= rect.minX - margin && x <= rect.maxX + margin && y >= rect.minY - margin && y <= rect.maxY + margin;
}

export function toCanvasPoint(point: Point, transform: Transform): Point {
  return { x: (point.x - transform.tx) / transform.scale, y: (point.y - transform.ty) / transform.scale };
}
