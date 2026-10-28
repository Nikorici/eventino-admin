import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedReaction,
  useSharedValue,
  withDecay,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import Svg, { G, Path, Text as SvgText } from 'react-native-svg';
import { Maximize2, Minus, Plus } from 'lucide-react-native';

import { haptics } from '@/lib/haptics';
import { hitRadiusForScale, hitTestSeat, hitTestSection } from '@/lib/seating/hitTest';
import type { IndexedSeat, SeatIndex } from '@/lib/seating/seatIndex';
import { buildSectionSeatPaths, isSellableSeat } from '@/lib/seating/seatPaths';
import { deriveRenderStatus, isSelectableStatus, type SeatStatusMap } from '@/lib/seating/status';
import {
  fitTransform,
  labelScale,
  needsSectionTier,
  rectContains,
  scaleLimits,
  SECTION_ZOOM_PADDING,
  sectionEntryScale,
  sectionTierScale,
  sectionZoom,
  visibleRect,
  toCanvasPoint,
  zoomAtPoint,
  type ScaleLimits,
  type Transform,
} from '@/lib/seating/viewport';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { CanvasSize, SeatCategory, VenueLayoutDetail } from '@/types/seating';
import { PressableScale, Skeleton } from '@/components/ui';

import { seatMapTheme, type SeatMapTheme } from './seatColors';
import { StageAndLabels } from './StageAndLabels';

const FIT_PADDING = 16;
const ZOOM_STEP = 1.5;
const DOUBLE_TAP_ZOOM = 2;
const DOUBLE_TAP_MAX_DELAY_MS = 200;
const PAN_MIN_DISTANCE = 6;
const ZOOM_ANIMATION_MS = 260;
const SETTLE_ANIMATION_MS = 180;
const VIEWPORT_COMMIT_INTERVAL_MS = 100;
const SEAT_LABEL_FONT_FACTOR = 1.1;

interface MatrixGroupProps {
  matrix?: number[];
}

class MatrixGroup extends G<MatrixGroupProps> {}

const AnimatedG = Animated.createAnimatedComponent(MatrixGroup);

function clampValue(value: number, min: number, max: number): number {
  'worklet';
  return Math.min(max, Math.max(min, value));
}

function translateBoundsWorklet(canvas: CanvasSize, container: CanvasSize, scale: number) {
  'worklet';
  const contentWidth = canvas.width * scale;
  const contentHeight = canvas.height * scale;
  const minTx = contentWidth > container.width ? container.width - contentWidth : (container.width - contentWidth) / 2;
  const maxTx = contentWidth > container.width ? 0 : minTx;
  const minTy =
    contentHeight > container.height ? container.height - contentHeight : (container.height - contentHeight) / 2;
  const maxTy = contentHeight > container.height ? 0 : minTy;
  return { minTx, maxTx, minTy, maxTy };
}

interface CommittedViewport extends Transform {
  settled: boolean;
}

interface PinchOrigin {
  scale: number;
  tx: number;
  ty: number;
  focalX: number;
  focalY: number;
}

export interface SeatMapCanvasProps {
  index: SeatIndex;
  layout: VenueLayoutDetail;
  categories: Map<number, SeatCategory>;
  statuses: SeatStatusMap;
  selectedSeatIds: Set<number>;
  language: string;
  onSeatPress: (seat: IndexedSeat) => void;
}

interface SectionSeatsProps {
  seats: IndexedSeat[];
  statuses: SeatStatusMap;
  selectedKey: string;
  categories: Map<number, SeatCategory>;
  seatRadius: number;
  theme: SeatMapTheme;
}

function parseSelectedKey(selectedKey: string): Set<number> {
  return new Set(selectedKey ? selectedKey.split(',').map(Number) : []);
}

const SectionSeats = memo(function SectionSeats({
  seats,
  statuses,
  selectedKey,
  categories,
  seatRadius,
  theme,
}: SectionSeatsProps) {
  const paths = useMemo(
    () => buildSectionSeatPaths(seats, statuses, parseSelectedKey(selectedKey), categories, seatRadius, theme),
    [seats, statuses, selectedKey, categories, seatRadius, theme],
  );
  return (
    <G>
      {paths.groups.map((group) => (
        <Path key={group.key} d={group.d} fill={group.fill} />
      ))}
      {paths.selectedRing ? (
        <Path d={paths.selectedRing} fill="none" stroke={theme.selectedRing} strokeWidth={2} />
      ) : null}
    </G>
  );
});

interface SeatLabelsProps {
  seats: IndexedSeat[];
  viewport: Transform;
  container: CanvasSize;
  statuses: SeatStatusMap;
  selectedSeatIds: Set<number>;
  categories: Map<number, SeatCategory>;
  seatRadius: number;
  theme: SeatMapTheme;
}

const SeatLabels = memo(function SeatLabels({
  seats,
  viewport,
  container,
  statuses,
  selectedSeatIds,
  categories,
  seatRadius,
  theme,
}: SeatLabelsProps) {
  const fontSize = seatRadius * SEAT_LABEL_FONT_FACTOR;
  const labels = useMemo(() => {
    const rect = visibleRect(viewport, container);
    const margin = seatRadius * 2;
    const items: { seat: IndexedSeat; fill: string }[] = [];
    for (const seat of seats) {
      if (!rectContains(rect, seat.x, seat.y, margin)) continue;
      const selected = selectedSeatIds.has(seat.id);
      const status = deriveRenderStatus(statuses, seat.id, selected, isSellableSeat(seat, categories));
      if (!isSelectableStatus(status)) continue;
      items.push({ seat, fill: selected ? theme.selectedRing : theme.seatLabel });
    }
    return items;
  }, [seats, viewport, container, statuses, selectedSeatIds, categories, seatRadius, theme]);

  return (
    <G>
      {labels.map(({ seat, fill }) => (
        <SvgText
          key={seat.id}
          x={seat.x}
          y={seat.y + fontSize * 0.35}
          fontSize={fontSize}
          fill={fill}
          textAnchor="middle"
        >
          {seat.label}
        </SvgText>
      ))}
    </G>
  );
});

interface ZoomControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  iconColor: string;
}

function ZoomControls({ onZoomIn, onZoomOut, onReset, iconColor }: ZoomControlsProps) {
  const { t } = useTranslation();
  const buttonClass =
    'h-10 w-10 items-center justify-center rounded-full border border-app-border bg-app-surface/95 dark:border-dark-border dark:bg-dark-surface/95';
  return (
    <View pointerEvents="box-none" className="absolute right-3 top-3 gap-2">
      <PressableScale onPress={onZoomIn} accessibilityLabel={t('Zoom in')} className={buttonClass}>
        <Plus size={18} color={iconColor} />
      </PressableScale>
      <PressableScale onPress={onZoomOut} accessibilityLabel={t('Zoom out')} className={buttonClass}>
        <Minus size={18} color={iconColor} />
      </PressableScale>
      <PressableScale onPress={onReset} accessibilityLabel={t('Reset zoom')} className={buttonClass}>
        <Maximize2 size={16} color={iconColor} />
      </PressableScale>
    </View>
  );
}

interface SeatMapSurfaceProps extends SeatMapCanvasProps {
  container: CanvasSize;
  theme: SeatMapTheme;
}

function SeatMapSurface({
  container,
  theme,
  index,
  layout,
  categories,
  statuses,
  selectedSeatIds,
  language,
  onSeatPress,
}: SeatMapSurfaceProps) {
  const { t } = useTranslation();
  const canvas = index.canvas;
  const seatRadius = index.seatRadius;
  const fit = useMemo(() => fitTransform(canvas, container, FIT_PADDING), [canvas, container]);
  const limits = useMemo<ScaleLimits>(() => scaleLimits(fit.scale, seatRadius), [fit.scale, seatRadius]);
  const sectionTier = needsSectionTier(fit.scale, seatRadius) ? sectionTierScale(fit.scale) : 0;
  const labelTier = labelScale(seatRadius);

  const s = useSharedValue(fit.scale);
  const tx = useSharedValue(fit.tx);
  const ty = useSharedValue(fit.ty);
  const lastCommit = useSharedValue(0);
  const pendingDecays = useSharedValue(0);
  const pinchOrigin = useSharedValue<PinchOrigin>({ scale: fit.scale, tx: fit.tx, ty: fit.ty, focalX: 0, focalY: 0 });
  const [viewport, setViewport] = useState<CommittedViewport>({ ...fit, settled: true });

  const commitViewport = useCallback((scale: number, x: number, y: number, settled: boolean) => {
    setViewport((previous) =>
      previous.scale === scale && previous.tx === x && previous.ty === y && previous.settled === settled
        ? previous
        : { scale, tx: x, ty: y, settled },
    );
  }, []);

  useAnimatedReaction(
    () => ({ scale: s.value, x: tx.value, y: ty.value }),
    (current, previous) => {
      if (previous && current.scale === previous.scale && current.x === previous.x && current.y === previous.y) return;
      const now = Date.now();
      if (now - lastCommit.value < VIEWPORT_COMMIT_INTERVAL_MS) return;
      lastCommit.value = now;
      scheduleOnRN(commitViewport, current.scale, current.x, current.y, false);
    },
    [commitViewport],
  );

  const animateTo = useCallback(
    (target: Transform) => {
      const config = { duration: ZOOM_ANIMATION_MS, easing: Easing.out(Easing.cubic) };
      s.value = withTiming(target.scale, config);
      tx.value = withTiming(target.tx, config);
      ty.value = withTiming(target.ty, config, (finished) => {
        if (finished) scheduleOnRN(commitViewport, target.scale, target.tx, target.ty, true);
      });
    },
    [commitViewport, s, tx, ty],
  );

  const zoomAt = useCallback(
    (x: number, y: number, factor: number, scale: number, offsetX: number, offsetY: number) => {
      haptics.light();
      animateTo(zoomAtPoint({ scale, tx: offsetX, ty: offsetY }, factor, { x, y }, canvas, container, limits));
    },
    [animateTo, canvas, container, limits],
  );

  const handleTap = useCallback(
    (x: number, y: number, scale: number, offsetX: number, offsetY: number) => {
      const point = toCanvasPoint({ x, y }, { scale, tx: offsetX, ty: offsetY });
      if (scale < sectionTier) {
        const section = hitTestSection(point, index.sectionBounds);
        if (!section) return;
        haptics.light();
        animateTo(sectionZoom(section, canvas, container, limits, SECTION_ZOOM_PADDING, sectionEntryScale(fit.scale), point));
        return;
      }
      const seat = hitTestSeat(point, index, hitRadiusForScale(seatRadius, scale));
      if (!seat) return;
      const status = deriveRenderStatus(statuses, seat.id, selectedSeatIds.has(seat.id), isSellableSeat(seat, categories));
      if (!isSelectableStatus(status)) {
        haptics.warning();
        return;
      }
      onSeatPress(seat);
    },
    [animateTo, canvas, categories, container, fit.scale, index, limits, onSeatPress, seatRadius, sectionTier, selectedSeatIds, statuses],
  );

  const handleTapRef = useRef(handleTap);
  const zoomAtRef = useRef(zoomAt);
  useEffect(() => {
    handleTapRef.current = handleTap;
    zoomAtRef.current = zoomAt;
  }, [handleTap, zoomAt]);

  const dispatchTap = useCallback((x: number, y: number, scale: number, offsetX: number, offsetY: number) => {
    handleTapRef.current(x, y, scale, offsetX, offsetY);
  }, []);

  const dispatchDoubleTap = useCallback((x: number, y: number, scale: number, offsetX: number, offsetY: number) => {
    zoomAtRef.current(x, y, DOUBLE_TAP_ZOOM, scale, offsetX, offsetY);
  }, []);

  const gesture = useMemo(() => {
    const { minScale, maxScale } = limits;
    const pinch = Gesture.Pinch()
      .withTestId('seat-map-pinch')
      .onStart((event) => {
        pinchOrigin.value = { scale: s.value, tx: tx.value, ty: ty.value, focalX: event.focalX, focalY: event.focalY };
      })
      .onUpdate((event) => {
        const origin = pinchOrigin.value;
        const nextScale = clampValue(origin.scale * event.scale, minScale, maxScale);
        const ratio = nextScale / origin.scale;
        s.value = nextScale;
        tx.value = event.focalX - (origin.focalX - origin.tx) * ratio;
        ty.value = event.focalY - (origin.focalY - origin.ty) * ratio;
      })
      .onEnd(() => {
        const scale = s.value;
        const bounds = translateBoundsWorklet(canvas, container, scale);
        const settledX = clampValue(tx.value, bounds.minTx, bounds.maxTx);
        const settledY = clampValue(ty.value, bounds.minTy, bounds.maxTy);
        if (settledX === tx.value && settledY === ty.value) {
          scheduleOnRN(commitViewport, scale, settledX, settledY, true);
          return;
        }
        const config = { duration: SETTLE_ANIMATION_MS };
        tx.value = withTiming(settledX, config);
        ty.value = withTiming(settledY, config, (finished) => {
          if (finished) scheduleOnRN(commitViewport, scale, settledX, settledY, true);
        });
      });

    const pan = Gesture.Pan()
      .maxPointers(1)
      .minDistance(PAN_MIN_DISTANCE)
      .withTestId('seat-map-pan')
      .onChange((event) => {
        tx.value += event.changeX;
        ty.value += event.changeY;
      })
      .onEnd((event) => {
        const scale = s.value;
        const bounds = translateBoundsWorklet(canvas, container, scale);
        pendingDecays.value = 2;
        const onAxisSettled = (finished?: boolean) => {
          if (!finished) return;
          pendingDecays.value -= 1;
          if (pendingDecays.value === 0) scheduleOnRN(commitViewport, scale, tx.value, ty.value, true);
        };
        tx.value = withDecay(
          { velocity: event.velocityX, clamp: [bounds.minTx, bounds.maxTx], rubberBandEffect: true },
          onAxisSettled,
        );
        ty.value = withDecay(
          { velocity: event.velocityY, clamp: [bounds.minTy, bounds.maxTy], rubberBandEffect: true },
          onAxisSettled,
        );
      });

    const doubleTap = Gesture.Tap()
      .numberOfTaps(2)
      .maxDelay(DOUBLE_TAP_MAX_DELAY_MS)
      .withTestId('seat-map-double-tap')
      .onEnd((event, success) => {
        if (!success) return;
        scheduleOnRN(dispatchDoubleTap, event.x, event.y, s.value, tx.value, ty.value);
      });

    const singleTap = Gesture.Tap()
      .withTestId('seat-map-tap')
      .onEnd((event, success) => {
        if (!success) return;
        scheduleOnRN(dispatchTap, event.x, event.y, s.value, tx.value, ty.value);
      });

    return Gesture.Race(Gesture.Simultaneous(pinch, pan), Gesture.Exclusive(doubleTap, singleTap));
  }, [canvas, commitViewport, container, dispatchDoubleTap, dispatchTap, limits, pendingDecays, pinchOrigin, s, tx, ty]);

  const animatedProps = useAnimatedProps<MatrixGroupProps>(() => ({
    matrix: [s.value, 0, 0, s.value, tx.value, ty.value],
  }));

  const selectedKeys = useMemo(() => {
    const keys = new Map<number, number[]>();
    for (const seatId of selectedSeatIds) {
      const seat = index.seatsById.get(seatId);
      if (!seat) continue;
      const bucket = keys.get(seat.sectionId);
      if (bucket) bucket.push(seatId);
      else keys.set(seat.sectionId, [seatId]);
    }
    const result = new Map<number, string>();
    for (const [sectionId, ids] of keys) result.set(sectionId, ids.sort((a, b) => a - b).join(','));
    return result;
  }, [index, selectedSeatIds]);

  const seatsBySection = useMemo(() => {
    const groups = new Map<number, IndexedSeat[]>();
    for (const seat of index.seats) {
      const bucket = groups.get(seat.sectionId);
      if (bucket) bucket.push(seat);
      else groups.set(seat.sectionId, [seat]);
    }
    return groups;
  }, [index]);

  const zoomFromCenter = useCallback(
    (factor: number) => zoomAt(container.width / 2, container.height / 2, factor, s.value, tx.value, ty.value),
    [container, s, tx, ty, zoomAt],
  );

  const resetZoom = useCallback(() => {
    haptics.light();
    animateTo(fit);
  }, [animateTo, fit]);

  const showRowLabels = viewport.scale >= sectionTier;
  const showSeatLabels = viewport.settled && viewport.scale >= labelTier;
  const mountTransform = `translate(${fit.tx} ${fit.ty}) scale(${fit.scale})`;

  return (
    <View className="flex-1">
      <GestureDetector gesture={gesture}>
        <View
          accessibilityLabel={t('Seat map')}
          style={{ width: container.width, height: container.height, backgroundColor: theme.canvas }}
        >
          <Svg width={container.width} height={container.height}>
            <AnimatedG animatedProps={animatedProps} transform={mountTransform}>
              <StageAndLabels
                elements={layout.elements}
                sections={layout.sections}
                language={language}
                seatRadius={seatRadius}
                showRowLabels={showRowLabels}
                theme={theme}
              />
              {layout.sections.map((section) => (
                <SectionSeats
                  key={section.id}
                  seats={seatsBySection.get(section.id) ?? []}
                  statuses={statuses}
                  selectedKey={selectedKeys.get(section.id) ?? ''}
                  categories={categories}
                  seatRadius={seatRadius}
                  theme={theme}
                />
              ))}
              {showSeatLabels ? (
                <SeatLabels
                  seats={index.seats}
                  viewport={viewport}
                  container={container}
                  statuses={statuses}
                  selectedSeatIds={selectedSeatIds}
                  categories={categories}
                  seatRadius={seatRadius}
                  theme={theme}
                />
              ) : null}
            </AnimatedG>
          </Svg>
        </View>
      </GestureDetector>
      <ZoomControls
        onZoomIn={() => zoomFromCenter(ZOOM_STEP)}
        onZoomOut={() => zoomFromCenter(1 / ZOOM_STEP)}
        onReset={resetZoom}
        iconColor={theme.label}
      />
    </View>
  );
}

export function SeatMapCanvas(props: SeatMapCanvasProps) {
  const [container, setContainer] = useState<CanvasSize | null>(null);
  const theme = seatMapTheme(useColorScheme() === 'dark');

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width <= 0 || height <= 0) return;
    setContainer((previous) =>
      previous && previous.width === width && previous.height === height ? previous : { width, height },
    );
  }, []);

  return (
    <View className="flex-1 overflow-hidden" onLayout={onLayout} testID="seat-map-canvas">
      {container ? (
        <SeatMapSurface key={`${container.width}x${container.height}`} container={container} theme={theme} {...props} />
      ) : (
        <Skeleton className="flex-1 rounded-none" />
      )}
    </View>
  );
}
