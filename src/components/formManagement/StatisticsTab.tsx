import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { BarChart3 } from 'lucide-react-native';
import Svg, { Circle } from 'react-native-svg';

import { AppText, EmptyState, Skeleton } from '@/components/ui';
import { Card, SectionLabel } from '@/components/merch/merchParts';
import { useThemeColor } from '@/hooks/useThemeColor';
import { isChoiceQuestionType, type FormQuestionStats, type FormStatisticsResponse } from '@/store/api/formsApi';

import { questionTypeOf, type FormQuestion } from './formQuestions';
import { Pill } from './FormBuilderTab';

export const ACCENT_GREEN = '#34c759';
export const ACCENT_BLUE = '#61859d';
export const ACCENT_ORANGE = '#ff9500';
const SAMPLE_ANSWER_LIMIT = 3;
const DONUT_SIZE = 112;
const DONUT_STROKE = 12;
const DONUT_RADIUS = 44;

export function StatTile({ label, value, tint }: { label: string; value: string; tint?: string }) {
  return (
    <Card className="flex-1 items-center px-2 py-3">
      <AppText numberOfLines={1} className="font-gilroy-bold text-[16px] leading-[21px]" style={tint ? { color: tint } : undefined}>
        {value}
      </AppText>
      <AppText numberOfLines={1} className="mt-0.5 font-gilroy-medium text-[11px] text-muted dark:text-dark-muted leading-[14px]">
        {label}
      </AppText>
    </Card>
  );
}

function OptionBar({ option, count, maxCount, total }: { option: string; count: number; maxCount: number; total: number }) {
  const ratio = maxCount > 0 ? Math.min(1, count / maxCount) : 0;
  const percent = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <View className="gap-1.5">
      <View className="flex-row items-center justify-between">
        <AppText numberOfLines={1} className="flex-1 pr-2 font-gilroy-medium text-[13px] leading-[17px]">
          {option}
        </AppText>
        <AppText className="font-gilroy-bold text-[12px] text-muted dark:text-dark-muted leading-[16px]">
          {count} · {percent}%
        </AppText>
      </View>
      <View className="h-2 overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/10">
        <View style={{ width: `${ratio * 100}%`, backgroundColor: ACCENT_BLUE }} className="h-full rounded-full" />
      </View>
    </View>
  );
}

function QuestionStatsCard({ questionId, title, stats }: { questionId: string; title: string; stats: FormQuestionStats }) {
  const { t } = useTranslation();
  const choiceEntries = Object.entries(stats.answers ?? {}).sort((a, b) => b[1] - a[1]);
  const maxCount = choiceEntries.reduce((max, [, count]) => Math.max(max, count), 0);
  const samples = (stats.textAnswers ?? [])
    .map((item) => (Array.isArray(item) ? item.join(', ') : item))
    .filter((text) => text.trim() !== '');
  const extraSamples = Math.max(0, samples.length - SAMPLE_ANSWER_LIMIT);
  const noAnswers = <AppText className="font-gilroy-medium text-[13px] text-muted dark:text-dark-muted leading-[17px]">{t('No answers recorded yet')}</AppText>;

  return (
    <Card className="gap-3 p-4">
      <View className="flex-row items-start justify-between gap-2">
        <AppText className="flex-1 font-gilroy-semibold text-[15px] leading-[20px]">{title}</AppText>
        <AppText className="font-gilroy-bold text-[12px] text-muted dark:text-dark-muted leading-[16px]">
          {stats.totalAnswers} {t('answers')}
        </AppText>
      </View>
      <View className="flex-row">
        <Pill label={t(questionTypeOf(stats.type).label)} />
      </View>
      {isChoiceQuestionType(stats.type) ? (
        choiceEntries.length > 0 && stats.totalAnswers > 0 ? (
          <View className="gap-3">
            {choiceEntries.map(([option, count]) => (
              <OptionBar key={`${questionId}-${option}`} option={option} count={count} maxCount={maxCount} total={stats.totalAnswers} />
            ))}
          </View>
        ) : (
          noAnswers
        )
      ) : samples.length > 0 ? (
        <View className="gap-2">
          <AppText className="font-gilroy-medium text-[12px] text-muted dark:text-dark-muted leading-[16px]">{t('Sample responses')}</AppText>
          {samples.slice(0, SAMPLE_ANSWER_LIMIT).map((text, index) => (
            <View key={`${questionId}-sample-${index}`} className="rounded-[10px] bg-black/[0.04] px-3 py-2 dark:bg-white/10">
              <AppText numberOfLines={3} className="font-gilroy-medium text-[13px] leading-[17px]">
                {text}
              </AppText>
            </View>
          ))}
          {extraSamples > 0 ? (
            <AppText className="font-gilroy-medium text-[12px] text-muted dark:text-dark-muted leading-[16px]">
              +{extraSamples} {t('more responses')}
            </AppText>
          ) : null}
        </View>
      ) : (
        noAnswers
      )}
    </Card>
  );
}

function CompletionCard({ completed, pending }: { completed: number; pending: number }) {
  const { t } = useTranslation();
  const track = useThemeColor('rgba(0,0,0,0.06)', 'rgba(255,255,255,0.1)');
  const pendingDot = useThemeColor('rgba(0,0,0,0.12)', 'rgba(255,255,255,0.2)');
  const total = completed + pending;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const circumference = 2 * Math.PI * DONUT_RADIUS;
  const center = DONUT_SIZE / 2;
  return (
    <Card className="gap-3 p-4">
      <AppText className="font-gilroy-bold text-[16px] leading-[21px]">{t('Completion progress')}</AppText>
      <View className="flex-row items-center gap-5">
        <View style={{ width: DONUT_SIZE, height: DONUT_SIZE }}>
          <Svg width={DONUT_SIZE} height={DONUT_SIZE}>
            <Circle cx={center} cy={center} r={DONUT_RADIUS} stroke={track} strokeWidth={DONUT_STROKE} fill="none" />
            {completed > 0 ? (
              <Circle
                cx={center}
                cy={center}
                r={DONUT_RADIUS}
                stroke={ACCENT_BLUE}
                strokeWidth={DONUT_STROKE}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${(circumference * percent) / 100} ${circumference}`}
                transform={`rotate(-90 ${center} ${center})`}
              />
            ) : null}
          </Svg>
          <View className="absolute inset-0 items-center justify-center">
            <AppText className="font-gilroy-bold text-[20px] leading-[26px]">{percent}%</AppText>
            <AppText className="font-gilroy-medium text-[11px] text-muted dark:text-dark-muted leading-[14px]">{t('Completed')}</AppText>
          </View>
        </View>
        <View className="flex-1 gap-2.5">
          <View className="flex-row items-center gap-2">
            <View className="h-2 w-2 rounded-full" style={{ backgroundColor: ACCENT_BLUE }} />
            <AppText className="flex-1 font-gilroy-medium text-[13px] leading-[17px]">{t('Completed')}</AppText>
            <AppText className="font-gilroy-bold text-[13px] leading-[17px]">{completed}</AppText>
          </View>
          <View className="flex-row items-center gap-2">
            <View className="h-2 w-2 rounded-full" style={{ backgroundColor: pendingDot }} />
            <AppText className="flex-1 font-gilroy-medium text-[13px] leading-[17px]">{t('Pending')}</AppText>
            <AppText className="font-gilroy-bold text-[13px] leading-[17px]">{pending}</AppText>
          </View>
        </View>
      </View>
    </Card>
  );
}

export function TilesSkeleton({ count }: { count: number }) {
  return (
    <View className="flex-row gap-2.5">
      {Array.from({ length: count }, (_, key) => (
        <Card key={key} className="flex-1 items-center gap-1.5 px-2 py-3">
          <Skeleton className="h-4 w-10" />
          <Skeleton className="h-3 w-16" />
        </Card>
      ))}
    </View>
  );
}

export function StatisticsSkeleton() {
  return (
    <View className="gap-4">
      <TilesSkeleton count={3} />
      {[0, 1].map((key) => (
        <Card key={key} className="gap-3 p-4">
          <View className="flex-row items-start justify-between gap-2">
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="h-3 w-14" />
          </View>
          <Skeleton className="h-6 w-24 rounded-full" />
          {[0, 1, 2].map((row) => (
            <View key={row} className="gap-1.5">
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-2 w-full rounded-full" />
            </View>
          ))}
        </Card>
      ))}
    </View>
  );
}

export function StatisticsTab({
  stats,
  questions,
}: {
  stats: FormStatisticsResponse | undefined;
  questions: FormQuestion[];
}) {
  const { t } = useTranslation();
  const position = (id: string) => {
    const index = questions.findIndex((question) => question.id === id);
    return index < 0 ? questions.length : index;
  };
  const entries = Object.entries(stats?.questionStats ?? {}).sort(([a], [b]) => position(a) - position(b));
  if (!stats || questions.length === 0 || entries.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title={t('No data available')}
        message={t('Statistics will appear once participants submit their responses')}
      />
    );
  }
  return (
    <View className="gap-4">
      <View className="flex-row gap-2.5">
        <StatTile label={t('Total Participants')} value={String(stats.totalParticipants)} />
        <StatTile label={t('Completed')} value={String(stats.totalResponses)} tint={ACCENT_GREEN} />
        <StatTile label={t('Completion Rate')} value={`${stats.completionRate}%`} tint={ACCENT_BLUE} />
      </View>
      <CompletionCard
        completed={stats.totalResponses}
        pending={Math.max(0, stats.totalParticipants - stats.totalResponses)}
      />
      <View className="gap-3">
        <SectionLabel>{t('Answers per question')}</SectionLabel>
        {entries.map(([questionId, questionStats]) => (
          <QuestionStatsCard
            key={questionId}
            questionId={questionId}
            title={questions.find((question) => question.id === questionId)?.question || questionStats.question}
            stats={questionStats}
          />
        ))}
      </View>
    </View>
  );
}
