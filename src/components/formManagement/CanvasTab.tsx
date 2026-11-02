import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, View, type LayoutChangeEvent } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Maximize, Minus, Pencil, Plus, Square, Trash2, X } from 'lucide-react-native';
import Svg, { Circle, Defs, Path, Pattern, Rect } from 'react-native-svg';

import { AppText, PressableScale } from '@/components/ui';
import { PrimaryButton, SecondaryButton } from '@/components/merch/merchParts';
import { useThemeColor } from '@/hooks/useThemeColor';
import { cn } from '@/lib/cn';
import { haptics } from '@/lib/haptics';
import { colors } from '@/theme/colors';

import {
  buildCanvasEdges,
  connectQuestions,
  isChoiceType,
  questionTypeOf,
  removeConditionEdge,
  type CanvasEdge,
  type FormQuestion,
} from './formQuestions';
import { OptionIndicator } from './OptionIndicator';

const CANVAS_HEIGHT = 600;
const NODE_WIDTH = 252;
const TOP = 28;
const GAP = 84;
const OPTION_ROW = 26;
const OPTION_GAP = 6;
const LANE_OFFSET = 40;
const LANE_STEP = 14;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 1.5;
const SEQUENTIAL = '#94a3b8';
const CONDITION = '#4062d1';

interface NodeLayout {
  height: number;
  optionsY: number;
}

interface ConnectSource {
  id: string;
  optionIndex: number | null;
}

function estimateHeight(question: FormQuestion): number {
  const options = isChoiceType(question.type) ? question.options.length : 0;
  return 92 + (question.description ? 16 : 0) + options * (OPTION_ROW + OPTION_GAP);
}

function Handle({
  active,
  highlighted,
  onPress,
  label,
  style,
}: {
  active?: boolean;
  highlighted?: boolean;
  onPress?: () => void;
  label?: string;
  style: { left?: number; right?: number; top?: number; bottom?: number };
}) {
  const ring = useThemeColor(colors.white, colors.dark.surface);
  const fill = active || highlighted ? colors.accent : SEQUENTIAL;
  const size = active || highlighted ? 14 : 10;
  const dot = (
    <View
      className="rounded-full"
      style={{
        width: size,
        height: size,
        backgroundColor: fill,
        borderWidth: 2,
        borderColor: ring,
      }}
    />
  );
  if (!onPress) {
    return (
      <View pointerEvents="none" className="absolute" style={style}>
        {dot}
      </View>
    );
  }
  return (
    <Pressable
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="absolute"
      style={style}
    >
      {dot}
    </Pressable>
  );
}

function QuestionNode({
  question,
  connectSource,
  onLayoutChange,
  onEdit,
  onDelete,
  onAddAfter,
  onStartConnect,
  onConnectHere,
}: {
  question: FormQuestion;
  connectSource: ConnectSource | null;
  onLayoutChange: (patch: Partial<NodeLayout>) => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddAfter: () => void;
  onStartConnect: (optionIndex: number | null) => void;
  onConnectHere: () => void;
}) {
  const { t } = useTranslation();
  const surface = useThemeColor(colors.white, colors.dark.surface);
  const border = useThemeColor('#e2e8f0', colors.dark.border);
  const iconColor = useThemeColor(colors.primary, colors.dark.text);
  const typeConfig = questionTypeOf(question.type);
  const isChoice = isChoiceType(question.type);
  const terminal = question.is_terminal;
  const isSource = connectSource?.id === question.id;
  const isTarget = connectSource != null && !isSource;
  const routeOf = (optionIndex: number) =>
    question.conditions.find(
      (condition) =>
        condition.optionIndex === optionIndex && (condition.action === 'skip' || condition.action === 'end'),
    );

  return (
    <View
      onLayout={(event: LayoutChangeEvent) => onLayoutChange({ height: event.nativeEvent.layout.height })}
      className="rounded-[12px] border"
      style={{
        width: NODE_WIDTH,
        backgroundColor: surface,
        borderColor: isTarget || isSource ? colors.accent : border,
        boxShadow: '0 4px 14px rgba(0,0,0,0.07)',
      }}
    >
      <Handle highlighted={isTarget} style={{ top: -6, left: NODE_WIDTH / 2 - (isTarget ? 7 : 5) }} />
      <View className="flex-row items-start gap-1.5 border-b border-app-border px-3 py-2.5 dark:border-dark-border">
        <View className="flex-1 flex-row flex-wrap gap-1.5">
          <View
            className="h-5 justify-center rounded-[6px] border px-2"
            style={{
              backgroundColor: `${typeConfig.color}15`,
              borderColor: `${typeConfig.color}30`,
            }}
          >
            <AppText className="font-gilroy-semibold text-[11px]" style={{ color: typeConfig.color }}>
              {t(typeConfig.label)}
            </AppText>
          </View>
          {question.required ? (
            <View className="h-5 justify-center rounded-[6px] bg-danger/10 px-2">
              <AppText className="font-gilroy-semibold text-[11px] text-danger dark:text-danger">{t('Required')}</AppText>
            </View>
          ) : null}
          {terminal ? (
            <View className="h-5 justify-center rounded-[6px] bg-danger/10 px-2">
              <AppText className="font-gilroy-semibold text-[11px] text-danger dark:text-danger">{t('End')}</AppText>
            </View>
          ) : null}
        </View>
        <View className="flex-row gap-1">
          <PressableScale
            onPress={() => {
              haptics.selection();
              onEdit();
            }}
            accessibilityLabel={t('Edit')}
            className="h-6 w-6 items-center justify-center rounded-[6px] bg-black/[0.05] dark:bg-white/10"
          >
            <Pencil size={13} color={iconColor} />
          </PressableScale>
          <PressableScale
            onPress={() => {
              haptics.selection();
              onDelete();
            }}
            accessibilityLabel={t('Delete')}
            className="h-6 w-6 items-center justify-center rounded-[6px] bg-danger/10"
          >
            <Trash2 size={13} color={colors.danger} />
          </PressableScale>
        </View>
      </View>
      <View className="gap-1.5 px-3 pt-2.5">
        {question.question ? (
          <AppText className="font-gilroy-semibold text-[13px]">{question.question}</AppText>
        ) : (
          <AppText className="font-gilroy-medium text-[13px] italic text-muted dark:text-dark-muted">{t('Untitled question')}</AppText>
        )}
        {question.description ? (
          <AppText className="font-gilroy-medium text-[11px] text-muted dark:text-dark-muted">{question.description}</AppText>
        ) : null}
      </View>
      {isChoice && question.options.length > 0 ? (
        <View
          className="mt-2 px-3"
          style={{ gap: OPTION_GAP }}
          onLayout={(event: LayoutChangeEvent) => onLayoutChange({ optionsY: event.nativeEvent.layout.y })}
        >
          {question.options.map((option, optionIndex) => {
            const route = routeOf(optionIndex);
            const activeHandle = isSource && connectSource?.optionIndex === optionIndex;
            return (
              <View
                key={`${option}-${optionIndex}`}
                className="flex-row items-center gap-2 rounded-[8px] bg-card-sm px-2 dark:bg-dark-elevated"
                style={{ height: OPTION_ROW }}
              >
                <OptionIndicator type={question.type} index={optionIndex} />
                <AppText numberOfLines={1} className="flex-1 font-gilroy-medium text-[12px]">
                  {option}
                </AppText>
                {route?.action === 'end' ? (
                  <View className="h-[18px] justify-center rounded-[5px] bg-danger/10 px-1.5">
                    <AppText className="font-gilroy-bold text-[10px] text-danger dark:text-danger">{t('End')}</AppText>
                  </View>
                ) : null}
                {route?.action === 'skip' ? (
                  <View
                    className="h-[18px] justify-center rounded-[5px] px-1.5"
                    style={{ backgroundColor: `${CONDITION}1a` }}
                  >
                    <AppText className="font-gilroy-bold text-[10px]" style={{ color: CONDITION }}>
                      {t('Skip')}
                    </AppText>
                  </View>
                ) : null}
                {terminal ? null : (
                  <Handle
                    active={activeHandle}
                    label={`${option} · ${t('Skip to question')}`}
                    onPress={() => onStartConnect(optionIndex)}
                    style={{
                      right: activeHandle ? -19 : -17,
                      top: activeHandle ? 6 : 8,
                    }}
                  />
                )}
              </View>
            );
          })}
        </View>
      ) : null}
      {terminal ? (
        <View className="mt-3 flex-row items-center gap-1.5 border-t border-app-border px-3 py-2 dark:border-dark-border">
          <Square size={12} color={colors.muted} />
          <AppText className="font-gilroy-semibold text-[11px] text-muted dark:text-dark-muted">{t('Form ends here')}</AppText>
        </View>
      ) : (
        <View className="h-3.5" />
      )}
      {terminal ? null : (
        <>
          <Pressable
            onPress={() => {
              haptics.selection();
              onAddAfter();
            }}
            accessibilityRole="button"
            accessibilityLabel={t('Add next question')}
            className="absolute h-6 w-6 items-center justify-center rounded-full border border-[#cbd5e1] dark:border-dark-border"
            style={{
              bottom: -12,
              left: NODE_WIDTH / 2 - 12,
              backgroundColor: surface,
            }}
          >
            <Plus size={14} color={iconColor} />
          </Pressable>
          <Handle
            active={isSource && connectSource?.optionIndex == null}
            label={`${question.question} · ${t('Skip to question')}`}
            onPress={() => onStartConnect(null)}
            style={{ bottom: -5, left: NODE_WIDTH / 2 + 23 }}
          />
        </>
      )}
      {isTarget ? (
        <Pressable
          onPress={onConnectHere}
          accessibilityRole="button"
          accessibilityLabel={`${t('Skip to question')}: ${question.question}`}
          className="absolute inset-0 rounded-[12px]"
        />
      ) : null}
    </View>
  );
}

function EdgeLabel({
  x,
  y,
  label,
  condition,
  onRemove,
}: {
  x: number;
  y: number;
  label: string;
  condition: boolean;
  onRemove?: () => void;
}) {
  const { t } = useTranslation();
  const surface = useThemeColor(colors.white, colors.dark.surface);
  const pillBg = useThemeColor(condition ? '#e8edff' : '#f8fafc', condition ? '#1e2a4d' : colors.dark.elevated);
  return (
    <View
      pointerEvents="box-none"
      className="absolute items-center gap-[3px]"
      style={{ left: x - 60, top: y - 11, width: 120 }}
    >
      <View className="rounded-[4px] px-[7px] py-px" style={{ backgroundColor: pillBg, maxWidth: 110 }}>
        <AppText
          numberOfLines={1}
          className={cn('text-[11px]', condition ? 'font-gilroy-semibold' : 'font-gilroy-medium')}
          style={{ color: condition ? CONDITION : SEQUENTIAL }}
        >
          {label}
        </AppText>
      </View>
      {onRemove ? (
        <PressableScale
          onPress={() => {
            haptics.selection();
            onRemove();
          }}
          hitSlop={8}
          accessibilityLabel={t('Remove connection')}
          className="h-[18px] w-[18px] items-center justify-center rounded-full border border-[#c7d4f8]"
          style={{ backgroundColor: surface }}
        >
          <X size={10} color={CONDITION} />
        </PressableScale>
      ) : null}
    </View>
  );
}

function ZoomButton({
  label,
  onPress,
  children,
  first,
}: {
  label: string;
  onPress: () => void;
  children: ReactNode;
  first?: boolean;
}) {
  return (
    <PressableScale
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      accessibilityLabel={label}
      className={cn(
        'h-[30px] w-[30px] items-center justify-center',
        !first && 'border-t border-app-border dark:border-dark-border',
      )}
    >
      {children}
    </PressableScale>
  );
}

export function CanvasTab({
  questions,
  saving,
  onChange,
  onAdd,
  onEdit,
  onDelete,
  onSave,
}: {
  questions: FormQuestion[];
  saving: boolean;
  onChange: (questions: FormQuestion[]) => void;
  onAdd: (afterId: string | null) => void;
  onEdit: (question: FormQuestion) => void;
  onDelete: (question: FormQuestion) => void;
  onSave: () => void;
}) {
  const { t } = useTranslation();
  const [viewWidth, setViewWidth] = useState(0);
  const [layouts, setLayouts] = useState<Record<string, NodeLayout>>({});
  const [scale, setScale] = useState(1);
  const [connectSource, setConnectSource] = useState<ConnectSource | null>(null);
  const surface = useThemeColor(colors.white, colors.dark.surface);
  const dots = useThemeColor('#e2e8f0', colors.dark.border);
  const iconColor = useThemeColor(colors.primary, colors.dark.text);

  const edges = buildCanvasEdges(questions);
  const conditionEdges = edges.filter((edge) => edge.kind === 'condition');
  const nodeX = conditionEdges.length === 0 ? Math.max(16, (viewWidth - NODE_WIDTH) / 2) : 16;
  const laneStart = nodeX + NODE_WIDTH + LANE_OFFSET;
  const positions = new Map<string, { y: number; height: number; optionsY: number }>();
  let cursor = TOP;
  questions.forEach((question) => {
    const layout = layouts[question.id];
    const height = layout?.height ?? estimateHeight(question);
    positions.set(question.id, {
      y: cursor,
      height,
      optionsY: layout?.optionsY ?? 70,
    });
    cursor += height + GAP;
  });
  const graphWidth =
    conditionEdges.length > 0 ? laneStart + (conditionEdges.length - 1) * LANE_STEP + 64 : nodeX * 2 + NODE_WIDTH;
  const graphHeight = cursor - GAP + 60;
  const contentWidth = Math.max(viewWidth / scale, graphWidth);
  const contentHeight = Math.max(CANVAS_HEIGHT / scale, graphHeight);
  const centerX = nodeX + NODE_WIDTH / 2;

  const updateLayout = (id: string, patch: Partial<NodeLayout>) =>
    setLayouts((prev) => {
      const current = prev[id] ?? { height: 0, optionsY: 0 };
      const next = { ...current, ...patch };
      if (next.height === current.height && next.optionsY === current.optionsY) return prev;
      return { ...prev, [id]: next };
    });

  const geometry = (edge: CanvasEdge, lane: number) => {
    const source = positions.get(edge.sourceId);
    const target = positions.get(edge.targetId);
    if (!source || !target) return null;
    const targetY = target.y;
    if (edge.kind === 'sequential') {
      const startY = source.y + source.height;
      return {
        path: `M${centerX} ${startY} V${targetY - 1}`,
        labelX: centerX,
        labelY: (startY + targetY) / 2 + 4,
        targetY,
      };
    }
    const laneX = laneStart + lane * LANE_STEP;
    const approach = targetY - 18;
    if (edge.optionIndex != null) {
      const startX = nodeX + NODE_WIDTH;
      const startY = source.y + source.optionsY + edge.optionIndex * (OPTION_ROW + OPTION_GAP) + OPTION_ROW / 2;
      return {
        path: `M${startX} ${startY} H${laneX} V${approach} H${centerX} V${targetY - 1}`,
        labelX: laneX,
        labelY: (startY + approach) / 2,
        targetY,
      };
    }
    const startX = centerX + 28;
    const startY = source.y + source.height;
    return {
      path: `M${startX} ${startY} V${startY + 14} H${laneX} V${approach} H${centerX} V${targetY - 1}`,
      labelX: laneX,
      labelY: (startY + 14 + approach) / 2,
      targetY,
    };
  };

  const drawn = edges.flatMap((edge) => {
    const lane = conditionEdges.indexOf(edge);
    const shape = geometry(edge, lane);
    return shape ? [{ edge, ...shape }] : [];
  });

  const fitView = () => {
    if (viewWidth === 0) return;
    const fit = Math.min(
      1,
      viewWidth / Math.max(viewWidth, graphWidth),
      CANVAS_HEIGHT / Math.max(CANVAS_HEIGHT, graphHeight),
    );
    setScale(Math.max(MIN_ZOOM, Math.round(fit * 100) / 100));
  };

  const connectTo = (targetId: string) => {
    if (!connectSource) return;
    haptics.success();
    onChange(connectQuestions(questions, connectSource.id, connectSource.optionIndex, targetId));
    setConnectSource(null);
  };

  return (
    <View className="gap-3">
      <View className="gap-2">
        <View className="flex-row gap-3">
          <View className="flex-1">
            <SecondaryButton
              label={t('Add Question')}
              onPress={() => onAdd(null)}
              icon={<Plus size={15} color={iconColor} />}
            />
          </View>
          {questions.length > 0 ? (
            <View className="flex-1">
              <PrimaryButton
                compact
                label={saving ? t('Saving...') : t('Save Changes')}
                loading={saving}
                onPress={onSave}
              />
            </View>
          ) : null}
        </View>
        <AppText className="font-gilroy-medium text-[12px] text-muted dark:text-dark-muted">
          {t('Tap a handle, then a question to connect · Per-option handles on the right')}
        </AppText>
      </View>

      <View
        accessibilityLabel={t('Canvas')}
        onLayout={(event: LayoutChangeEvent) => setViewWidth(Math.floor(event.nativeEvent.layout.width))}
        className="overflow-hidden rounded-[14px] border border-app-border dark:border-dark-border"
        style={{ height: CANVAS_HEIGHT, backgroundColor: surface }}
      >
        <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
          <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false}>
            <View
              style={{
                width: contentWidth * scale,
                height: contentHeight * scale,
              }}
            >
              <View
                style={{
                  width: contentWidth,
                  height: contentHeight,
                  transform: [{ scale }],
                  transformOrigin: 'top left',
                }}
              >
                <Pressable
                  disabled={!connectSource}
                  onPress={() => setConnectSource(null)}
                  accessibilityLabel={t('Cancel')}
                  className="absolute inset-0"
                >
                  <Svg width={contentWidth} height={contentHeight}>
                    <Defs>
                      <Pattern id="canvas-dots" width={24} height={24} patternUnits="userSpaceOnUse">
                        <Circle cx={1} cy={1} r={1} fill={dots} />
                      </Pattern>
                    </Defs>
                    <Rect width={contentWidth} height={contentHeight} fill="url(#canvas-dots)" />
                    {drawn.map(({ edge, path }) => {
                      const stroke = edge.kind === 'condition' ? CONDITION : SEQUENTIAL;
                      return (
                        <Path
                          key={edge.id}
                          d={path}
                          stroke={stroke}
                          strokeWidth={edge.kind === 'condition' ? 2 : 1.5}
                          fill="none"
                          strokeLinejoin="round"
                        />
                      );
                    })}
                    {drawn.map(({ edge, targetY }) => (
                      <Path
                        key={`${edge.id}-arrow`}
                        d={`M${centerX - 6} ${targetY - 8} L${centerX} ${targetY - 1} L${centerX + 6} ${targetY - 8} Z`}
                        fill={edge.kind === 'condition' ? CONDITION : SEQUENTIAL}
                      />
                    ))}
                  </Svg>
                </Pressable>

                {questions.map((question) => {
                  const position = positions.get(question.id);
                  return (
                    <View key={question.id} className="absolute" style={{ left: nodeX, top: position?.y ?? 0 }}>
                      <QuestionNode
                        question={question}
                        connectSource={connectSource}
                        onLayoutChange={(patch) => updateLayout(question.id, patch)}
                        onEdit={() => onEdit(question)}
                        onDelete={() => {
                          setConnectSource(null);
                          onDelete(question);
                        }}
                        onAddAfter={() => onAdd(question.id)}
                        onStartConnect={(optionIndex) =>
                          setConnectSource((current) =>
                            current?.id === question.id && current.optionIndex === optionIndex
                              ? null
                              : { id: question.id, optionIndex },
                          )
                        }
                        onConnectHere={() => connectTo(question.id)}
                      />
                    </View>
                  );
                })}

                {drawn.map(({ edge, labelX, labelY }) => {
                  if (edge.kind === 'sequential') {
                    return edge.showNext ? (
                      <EdgeLabel key={`${edge.id}-label`} x={labelX} y={labelY} label={t('Next')} condition={false} />
                    ) : null;
                  }
                  return (
                    <EdgeLabel
                      key={`${edge.id}-label`}
                      x={labelX}
                      y={labelY}
                      label={edge.optionLabel ?? t('Go to')}
                      condition
                      onRemove={() => onChange(removeConditionEdge(questions, edge))}
                    />
                  );
                })}
              </View>
            </View>
          </ScrollView>
        </ScrollView>

        {questions.length === 0 ? (
          <View pointerEvents="box-none" className="absolute inset-0 items-center justify-center gap-3">
            <PressableScale
              onPress={() => {
                haptics.selection();
                onAdd(null);
              }}
              accessibilityLabel={t('Add Question')}
              className="h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-muted"
            >
              <Plus size={24} color={colors.muted} />
            </PressableScale>
            <AppText className="font-gilroy-medium text-[13px] text-muted dark:text-dark-muted">
              {t('Click to add your first question')}
            </AppText>
          </View>
        ) : null}

        <View
          className="absolute bottom-3 left-3 overflow-hidden rounded-[8px] border border-app-border dark:border-dark-border"
          style={{
            backgroundColor: surface,
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          }}
        >
          <ZoomButton
            first
            label={t('Zoom in')}
            onPress={() => setScale((s) => Math.min(MAX_ZOOM, Math.round((s + 0.25) * 100) / 100))}
          >
            <Plus size={14} color={iconColor} />
          </ZoomButton>
          <ZoomButton
            label={t('Zoom out')}
            onPress={() => setScale((s) => Math.max(MIN_ZOOM, Math.round((s - 0.25) * 100) / 100))}
          >
            <Minus size={14} color={iconColor} />
          </ZoomButton>
          <ZoomButton label={t('Fit view')} onPress={fitView}>
            <Maximize size={13} color={iconColor} />
          </ZoomButton>
        </View>
      </View>
    </View>
  );
}
