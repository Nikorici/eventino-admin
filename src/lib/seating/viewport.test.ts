import {
  centerOffsets,
  clampTransform,
  fitScale,
  fitTransform,
  labelScale,
  needsSectionTier,
  rectContains,
  scaleLimits,
  sectionTierScale,
  sectionZoom,
  sectionEntryScale,
  toCanvasPoint,
  translateBounds,
  visibleRect,
  zoomAtPoint,
} from './viewport';

const canvas = { width: 2900, height: 2000 };
const phone = { width: 393, height: 700 };

describe('viewport', () => {
  it('fits the canvas inside the container', () => {
    expect(fitScale(canvas, phone)).toBeCloseTo(393 / 2900, 6);
    expect(fitScale(canvas, phone, 20)).toBeCloseTo(353 / 2900, 6);
    expect(fitScale({ width: 100, height: 100 }, { width: 200, height: 400 })).toBe(2);
  });

  it('centers the fitted canvas', () => {
    const scale = 0.1;
    expect(centerOffsets(canvas, phone, scale)).toEqual({ tx: (393 - 290) / 2, ty: (700 - 200) / 2 });
    const fit = fitTransform(canvas, phone);
    expect(fit.tx).toBeCloseTo(0, 6);
    expect(fit.ty).toBeCloseTo((700 - 2000 * (393 / 2900)) / 2, 6);
  });

  it('derives scale limits capped by the seat size', () => {
    const fit = 393 / 2900;
    const limits = scaleLimits(fit, 13);
    expect(limits.minScale).toBeCloseTo(fit * 0.8, 6);
    expect(limits.maxScale).toBeCloseTo(60 / 26, 6);
    expect(scaleLimits(0.5, 5).maxScale).toBe(4);
    expect(sectionTierScale(fit)).toBeCloseTo(fit * 2, 6);
    expect(labelScale(13)).toBeCloseTo(14 / 13, 6);
  });

  it('skips the section tier when seats are already legible at the fitted scale', () => {
    const small = { width: 280, height: 280 };
    const container = { width: 375, height: 600 };
    const fit = fitScale(small, container, 16);
    const limits = scaleLimits(fit, 13);
    expect(sectionTierScale(fit)).toBeGreaterThan(limits.maxScale);
    expect(needsSectionTier(fit, 13)).toBe(false);
    expect(needsSectionTier(393 / 2900, 13)).toBe(true);
  });

  it('bounds translation so the canvas covers the viewport', () => {
    expect(translateBounds({ width: 1000, height: 1000 }, { width: 400, height: 400 }, 1)).toEqual({
      minTx: -600,
      maxTx: 0,
      minTy: -600,
      maxTy: 0,
    });
    expect(translateBounds({ width: 1000, height: 1000 }, { width: 400, height: 400 }, 0.2)).toEqual({
      minTx: 100,
      maxTx: 100,
      minTy: 100,
      maxTy: 100,
    });
  });

  it('clamps transforms into scale and translation bounds', () => {
    const big = { width: 1000, height: 1000 };
    const container = { width: 400, height: 400 };
    const limits = { minScale: 0.2, maxScale: 2 };
    expect(clampTransform({ scale: 5, tx: 50, ty: -5000 }, big, container, limits)).toEqual({ scale: 2, tx: 0, ty: -1600 });
    expect(clampTransform({ scale: 0.5, tx: 30, ty: -700 }, big, container, limits)).toEqual({ scale: 0.5, tx: 0, ty: -100 });
    expect(clampTransform({ scale: 0.1, tx: 0, ty: 0 }, big, container, limits)).toEqual({ scale: 0.2, tx: 100, ty: 100 });
  });

  it('keeps the focal canvas point fixed when zooming', () => {
    const big = { width: 2000, height: 2000 };
    const container = { width: 400, height: 400 };
    const limits = { minScale: 0.1, maxScale: 4 };
    const before = { scale: 1, tx: -300, ty: -300 };
    const focal = { x: 100, y: 150 };
    const canvasPoint = toCanvasPoint(focal, before);
    const after = zoomAtPoint(before, 2, focal, big, container, limits);
    expect(after.scale).toBe(2);
    expect(toCanvasPoint(focal, after)).toEqual(canvasPoint);
  });

  it('zooms to a section and centers it', () => {
    const big = { width: 2000, height: 2000 };
    const container = { width: 400, height: 400 };
    const limits = { minScale: 0.1, maxScale: 4 };
    const transform = sectionZoom({ minX: 800, minY: 800, maxX: 1200, maxY: 1000 }, big, container, limits, 0);
    expect(transform).toEqual({ scale: 1, tx: -800, ty: -700 });
    expect(toCanvasPoint({ x: 200, y: 200 }, transform)).toEqual({ x: 1000, y: 900 });
  });

  it('computes the visible canvas rect', () => {
    const rect = visibleRect({ scale: 2, tx: -100, ty: -50 }, { width: 400, height: 400 });
    expect(rect).toEqual({ minX: 50, minY: 25, maxX: 250, maxY: 225 });
    expect(rectContains(rect, 60, 30)).toBe(true);
    expect(rectContains(rect, 40, 30)).toBe(false);
    expect(rectContains(rect, 40, 30, 20)).toBe(true);
  });
});

describe('sectionEntryScale', () => {
  it('leaves the section tier for very wide sections', () => {
    const container = { width: 400, height: 800 };
    const canvas = { width: 2900, height: 2000 };
    const fit = 400 / 2900;
    const limits = { minScale: fit * 0.8, maxScale: 2.5 };
    const wideBalcony = { minX: 100, minY: 1500, maxX: 2800, maxY: 1900 };
    const transform = sectionZoom(wideBalcony, canvas, container, limits, 24, sectionEntryScale(fit), { x: 1450, y: 1700 });
    expect(transform.scale).toBeGreaterThanOrEqual(sectionTierScale(fit));
  });
});
