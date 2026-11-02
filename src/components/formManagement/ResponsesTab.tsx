import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Image } from 'expo-image';
import { File, Paths } from 'expo-file-system';
import { ArrowUpDown, ChevronDown, ChevronUp, Download, Users } from 'lucide-react-native';

import { AppText, Chip, EmptyState } from '@/components/ui';
import { Card, SecondaryButton } from '@/components/merch/merchParts';
import { OptionSheet } from '@/components/dashboard/OptionSheet';
import { SearchBar } from '@/components/shared/SearchBar';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/cn';
import { shareFile } from '@/lib/downloads';
import { haptics } from '@/lib/haptics';
import type { FormRespondent } from '@/store/api/formsApi';
import { colors } from '@/theme/colors';

import type { FormQuestion } from './formQuestions';
import { ACCENT_BLUE, ACCENT_GREEN, ACCENT_ORANGE, StatTile } from './StatisticsTab';

type StatusFilter = 'all' | 'completed' | 'pending';
type SortBy = 'name' | 'status';

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export function buildResponsesCsv(responses: FormRespondent[], questions: FormQuestion[]): string {
  const headers = ['Name', 'Email', 'Status', ...questions.map((question) => question.question)];
  const rows = responses.map((response) => [
    response.user.name,
    response.user.email,
    response.has_answered ? 'Completed' : 'Pending',
    ...questions.map((question) => {
      const answer = response.responses[question.id]?.answer;
      return Array.isArray(answer) ? answer.join(', ') : (answer ?? '');
    }),
  ]);
  return [headers.join(','), ...rows.map((row) => row.map(csvCell).join(','))].join('\n');
}

function AnswerValue({ answer }: { answer: string | string[] | null | undefined }) {
  const { t } = useTranslation();
  if (Array.isArray(answer) && answer.length > 0) {
    return (
      <View className="flex-row flex-wrap gap-1.5">
        {answer.map((item, index) => (
          <View key={`${item}-${index}`} className="rounded-full bg-black/[0.05] px-2.5 py-1 dark:bg-white/10">
            <AppText className="font-gilroy-medium text-[12px]">{item}</AppText>
          </View>
        ))}
      </View>
    );
  }
  if (typeof answer === 'string' && answer.trim() !== '') {
    return <AppText className="font-gilroy-medium text-[13px]">{answer}</AppText>;
  }
  return <AppText className="font-gilroy-medium text-[13px] text-muted dark:text-dark-muted">{t('No answer')}</AppText>;
}

function RespondentRow({
  respondent,
  questions,
  expanded,
  onToggle,
}: {
  respondent: FormRespondent;
  questions: FormQuestion[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const statusColor = respondent.has_answered ? ACCENT_GREEN : ACCENT_ORANGE;
  return (
    <View>
      <Pressable
        onPress={() => {
          haptics.selection();
          onToggle();
        }}
        accessibilityRole="button"
        accessibilityLabel={respondent.user.name}
        accessibilityState={{ expanded }}
        className="flex-row items-center gap-3 py-3"
      >
        <View className="h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-brand/20 dark:bg-dark-elevated">
          {respondent.user.profile_image ? (
            <Image source={{ uri: respondent.user.profile_image }} contentFit="cover" style={{ width: '100%', height: '100%' }} />
          ) : (
            <AppText className="font-gilroy-bold text-[13px] text-primary dark:text-dark-text">
              {initials(respondent.user.name)}
            </AppText>
          )}
        </View>
        <View className="flex-1">
          <AppText numberOfLines={1} className="font-gilroy-semibold text-[14px]">
            {respondent.user.name}
          </AppText>
          <AppText numberOfLines={1} className="font-gilroy-medium text-[12px] text-muted dark:text-dark-muted">
            {respondent.user.email}
          </AppText>
        </View>
        <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: `${statusColor}22` }}>
          <AppText className="font-gilroy-bold text-[11px]" style={{ color: statusColor }}>
            {respondent.has_answered ? t('Completed') : t('Pending')}
          </AppText>
        </View>
        {expanded ? <ChevronUp size={16} color={colors.muted} /> : <ChevronDown size={16} color={colors.muted} />}
      </Pressable>
      {expanded ? (
        <View className="gap-3 pb-4 pl-[52px]">
          {respondent.has_answered ? (
            questions.map((question) => (
              <View key={question.id} className="gap-1">
                <AppText className="font-gilroy-medium text-[12px] text-muted dark:text-dark-muted">
                  {question.question}
                  {question.required ? ' *' : ''}
                </AppText>
                <AnswerValue answer={respondent.responses[question.id]?.answer} />
              </View>
            ))
          ) : (
            <View className="gap-0.5">
              <AppText className="font-gilroy-semibold text-[13px]">{t('Form not submitted yet')}</AppText>
              <AppText className="font-gilroy-medium text-[12px] text-muted dark:text-dark-muted">
                {t('Waiting for this participant to complete the form')}
              </AppText>
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
}

export function ResponsesTab({ responses, questions }: { responses: FormRespondent[]; questions: FormQuestion[] }) {
  const { t } = useTranslation();
  const toast = useToast();
  const iconColor = useThemeColor(colors.primary, colors.dark.text);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortBy>('name');
  const [sortOpen, setSortOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return responses
      .filter(
        (response) =>
          !term || response.user.name.toLowerCase().includes(term) || response.user.email.toLowerCase().includes(term),
      )
      .filter((response) => status === 'all' || (status === 'completed') === response.has_answered)
      .sort((a, b) =>
        sortBy === 'name'
          ? a.user.name.localeCompare(b.user.name)
          : Number(b.has_answered) - Number(a.has_answered),
      );
  }, [responses, search, status, sortBy]);

  const total = responses.length;
  const completed = responses.filter((response) => response.has_answered).length;
  const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

  const sortOptions: { value: SortBy; label: string }[] = [
    { value: 'name', label: t('Sort by Name') },
    { value: 'status', label: t('Sort by Status') },
  ];

  const onExport = async () => {
    if (exporting || responses.length === 0 || questions.length === 0) return;
    haptics.selection();
    setExporting(true);
    try {
      const file = new File(Paths.cache, `form_responses_${new Date().toISOString().split('T')[0]}.csv`);
      file.create({ overwrite: true, intermediates: true });
      file.write(buildResponsesCsv(responses, questions));
      const shared = await shareFile(file.uri, {
        mimeType: 'text/csv',
        UTI: 'public.comma-separated-values-text',
        dialogTitle: t('Export CSV'),
      });
      if (!shared) toast(t('Please try again.'), 'error');
    } catch {
      toast(t('Please try again.'), 'error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <View className="gap-4">
      <View className="gap-2.5">
        <View className="flex-row gap-2.5">
          <StatTile label={t('Total Participants')} value={String(total)} />
          <StatTile label={t('Completed')} value={String(completed)} tint={ACCENT_GREEN} />
        </View>
        <View className="flex-row gap-2.5">
          <StatTile label={t('Pending')} value={String(total - completed)} tint={ACCENT_ORANGE} />
          <StatTile label={t('Response Rate')} value={`${rate}%`} tint={ACCENT_BLUE} />
        </View>
      </View>

      <View className="gap-3">
        <SearchBar value={search} onChangeText={setSearch} placeholder={t('Search by name or email')} />
        <View className="flex-row flex-wrap gap-2">
          {(['all', 'completed', 'pending'] as const).map((value) => (
            <Chip
              key={value}
              label={value === 'all' ? t('All') : value === 'completed' ? t('Completed') : t('Pending')}
              selected={status === value}
              onPress={() => setStatus(value)}
            />
          ))}
        </View>
        <View className="flex-row gap-3">
          <View className="flex-1">
            <SecondaryButton
              label={sortOptions.find((option) => option.value === sortBy)?.label ?? t('Sort by Name')}
              onPress={() => {
                haptics.selection();
                setSortOpen(true);
              }}
              icon={<ArrowUpDown size={15} color={iconColor} />}
            />
          </View>
          <View className="flex-1">
            <SecondaryButton
              label={t('Export')}
              loading={exporting}
              disabled={responses.length === 0 || questions.length === 0}
              onPress={() => void onExport()}
              icon={<Download size={15} color={iconColor} />}
            />
          </View>
        </View>
      </View>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t('No responses found')}
          message={
            search.trim() || status !== 'all'
              ? t('Try adjusting your search or filter')
              : t('Responses will appear here once participants submit their answers')
          }
        />
      ) : (
        <Card className="px-4">
          {filtered.map((respondent, index) => {
            const key = String(respondent.user.id);
            return (
              <View key={key} className={cn(index > 0 && 'border-t border-app-border dark:border-dark-border')}>
                <RespondentRow
                  respondent={respondent}
                  questions={questions}
                  expanded={expanded === key}
                  onToggle={() => setExpanded((current) => (current === key ? null : key))}
                />
              </View>
            );
          })}
        </Card>
      )}

      {sortOpen ? (
        <OptionSheet
          title={t('Sort by')}
          options={sortOptions}
          value={sortBy}
          onSelect={setSortBy}
          onClose={() => setSortOpen(false)}
        />
      ) : null}
    </View>
  );
}

