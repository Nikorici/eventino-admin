import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { buildSeatIndexFromResponse } from '@/lib/seating/seatIndex';
import { categoriesById } from '@/lib/seating/selection';
import { statusMapFromBuckets } from '@/lib/seating/status';
import { fixtureSeatMap } from '@/lib/seating/testFixtures';
import * as viewport from '@/lib/seating/viewport';

import { SeatMapCanvas } from './SeatMapCanvas';

jest.mock('@/store/hooks', () => ({
  useAppSelector: (selector: (state: unknown) => unknown) => selector({ theme: { preference: 'light' } }),
  useAppDispatch: () => jest.fn(),
}));

const CONTAINER = { width: 400, height: 400 };

async function flush() {
  await act(async () => {
    for (let tick = 0; tick < 5; tick += 1) await Promise.resolve();
  });
}

async function fireTap(testId: string, x: number, y: number) {
  await act(async () => {
    fireGestureHandler(getByGestureTestId(testId), [{ x, y }]);
  });
  await flush();
}

async function renderCanvas(onSeatPress = jest.fn(), selected = new Set<number>(), container = CONTAINER) {
  const index = buildSeatIndexFromResponse(fixtureSeatMap);
  await render(
    <SeatMapCanvas
      index={index}
      layout={fixtureSeatMap.layout}
      categories={categoriesById(fixtureSeatMap.categories)}
      statuses={statusMapFromBuckets(fixtureSeatMap.statuses)}
      selectedSeatIds={selected}
      language="en"
      onSeatPress={onSeatPress}
    />,
    { wrapper: GestureHandlerRootView },
  );
  await fireEvent(screen.getByTestId('seat-map-canvas'), 'layout', { nativeEvent: { layout: container } });
  return { onSeatPress, index };
}

const fit = viewport.fitTransform(fixtureSeatMap.layout.canvas, CONTAINER, 16);

function screenPoint(canvasX: number, canvasY: number, transform: viewport.Transform) {
  return { x: canvasX * transform.scale + transform.tx, y: canvasY * transform.scale + transform.ty };
}

describe('SeatMapCanvas', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows a skeleton until the container is measured, then the zoom controls', async () => {
    const index = buildSeatIndexFromResponse(fixtureSeatMap);
    await render(
      <SeatMapCanvas
        index={index}
        layout={fixtureSeatMap.layout}
        categories={categoriesById(fixtureSeatMap.categories)}
        statuses={statusMapFromBuckets(fixtureSeatMap.statuses)}
        selectedSeatIds={new Set()}
        language="en"
        onSeatPress={jest.fn()}
      />,
      { wrapper: GestureHandlerRootView },
    );
    expect(screen.queryByLabelText('Zoom in')).toBeNull();
    await fireEvent(screen.getByTestId('seat-map-canvas'), 'layout', { nativeEvent: { layout: CONTAINER } });
    expect(screen.getByLabelText('Zoom in')).toBeTruthy();
    expect(screen.getByLabelText('Seat map')).toBeTruthy();
  });

  it('zooms to the tapped section while below the section tier', async () => {
    const zoomSpy = jest.spyOn(viewport, 'sectionZoom');
    const { onSeatPress, index } = await renderCanvas();
    const point = screenPoint(200, 100, fit);
    await fireTap('seat-map-tap', point.x, point.y);
    expect(zoomSpy).toHaveBeenCalledTimes(1);
    expect(zoomSpy.mock.calls[0][0]).toBe(index.sectionBounds.find((bounds) => bounds.sectionId === 2));
    expect(onSeatPress).not.toHaveBeenCalled();
  });

  it('ignores taps outside every section outline while below the section tier', async () => {
    const zoomSpy = jest.spyOn(viewport, 'sectionZoom');
    const smallContainer = { width: 200, height: 200 };
    const { onSeatPress } = await renderCanvas(jest.fn(), new Set(), smallContainer);
    const smallFit = viewport.fitTransform(fixtureSeatMap.layout.canvas, smallContainer, 16);
    const whitespaceNearSeat = screenPoint(-20, 50, smallFit);
    await fireTap('seat-map-tap', whitespaceNearSeat.x, whitespaceNearSeat.y);
    const farFromEverything = screenPoint(700, 700, smallFit);
    await fireTap('seat-map-tap', farFromEverything.x, farFromEverything.y);
    expect(onSeatPress).not.toHaveBeenCalled();
    expect(zoomSpy).not.toHaveBeenCalled();
  });

  it('selects a seat straight from the fitted view when seats are legible without a section tier', async () => {
    const largeContainer = { width: 500, height: 500 };
    const zoomSpy = jest.spyOn(viewport, 'sectionZoom');
    const { onSeatPress } = await renderCanvas(jest.fn(), new Set(), largeContainer);
    const largeFit = viewport.fitTransform(fixtureSeatMap.layout.canvas, largeContainer, 16);
    expect(viewport.needsSectionTier(largeFit.scale, fixtureSeatMap.layout.seat_radius)).toBe(false);
    const seat = screenPoint(50, 50, largeFit);
    await fireTap('seat-map-tap', seat.x, seat.y);
    expect(zoomSpy).not.toHaveBeenCalled();
    expect(onSeatPress).toHaveBeenCalledTimes(1);
    expect(onSeatPress.mock.calls[0][0].id).toBe(101);
  });

  it('selects the tapped seat once zoomed past the section tier', async () => {
    const { onSeatPress } = await renderCanvas();
    const seat = screenPoint(50, 50, fit);
    await fireTap('seat-map-double-tap', seat.x, seat.y);
    const limits = viewport.scaleLimits(fit.scale, fixtureSeatMap.layout.seat_radius);
    const zoomed = viewport.zoomAtPoint(fit, 2, seat, fixtureSeatMap.layout.canvas, CONTAINER, limits);
    expect(zoomed.scale).toBeGreaterThanOrEqual(viewport.sectionTierScale(fit.scale));
    const target = screenPoint(50, 50, zoomed);
    await fireTap('seat-map-tap', target.x, target.y);
    expect(onSeatPress).toHaveBeenCalledTimes(1);
    expect(onSeatPress.mock.calls[0][0].id).toBe(101);
  });

  it('ignores taps on seats that cannot be selected', async () => {
    const { onSeatPress } = await renderCanvas();
    const focal = screenPoint(90, 50, fit);
    await fireTap('seat-map-double-tap', focal.x, focal.y);
    const limits = viewport.scaleLimits(fit.scale, fixtureSeatMap.layout.seat_radius);
    const zoomed = viewport.zoomAtPoint(fit, 2, focal, fixtureSeatMap.layout.canvas, CONTAINER, limits);
    const sold = screenPoint(90, 50, zoomed);
    await fireTap('seat-map-tap', sold.x, sold.y);
    expect(onSeatPress).not.toHaveBeenCalled();
  });

  it('lets a selected seat be tapped again to deselect it', async () => {
    const { onSeatPress } = await renderCanvas(jest.fn(), new Set([104]));
    const focal = screenPoint(50, 90, fit);
    await fireTap('seat-map-double-tap', focal.x, focal.y);
    const limits = viewport.scaleLimits(fit.scale, fixtureSeatMap.layout.seat_radius);
    const zoomed = viewport.zoomAtPoint(fit, 2, focal, fixtureSeatMap.layout.canvas, CONTAINER, limits);
    const target = screenPoint(50, 90, zoomed);
    await fireTap('seat-map-tap', target.x, target.y);
    expect(onSeatPress.mock.calls[0][0].id).toBe(104);
  });
});
