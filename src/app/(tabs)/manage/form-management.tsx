import { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Ban, ClipboardList } from 'lucide-react-native';

import { AppText, Chip, EmptyState, GlassHeader, Screen } from '@/components/ui';
import { ListSkeleton } from '@/components/merch/merchParts';
import { CanvasTab } from '@/components/formManagement/CanvasTab';
import { FormBuilderTab } from '@/components/formManagement/FormBuilderTab';
import {
  deleteQuestion,
  duplicateQuestion,
  EMPTY_QUESTION,
  generateQuestionId,
  moveQuestion,
  toFormQuestions,
  toQuestionsPayload,
  upsertQuestion,
  type FormQuestion,
} from '@/components/formManagement/formQuestions';
import { QuestionSheet } from '@/components/formManagement/QuestionSheet';
import { ResponsesTab } from '@/components/formManagement/ResponsesTab';
import { StatisticsSkeleton, StatisticsTab, TilesSkeleton } from '@/components/formManagement/StatisticsTab';
import { useScreenPadding } from '@/hooks/useScreenPadding';
import { useSelectedEvent } from '@/hooks/useSelectedEvent';
import { useToast } from '@/hooks/useToast';
import { haptics } from '@/lib/haptics';
import { navigate } from '@/lib/nav';
import {
  useGetEventFormResponsesQuery,
  useGetEventFormStatisticsQuery,
  useUpdateEventQuestionsMutation,
} from '@/store/api/formsApi';
import { colors } from '@/theme/colors';

type FormTab = 'canvas' | 'builder' | 'statistics' | 'responses';

interface SheetState {
  initial: FormQuestion;
  isEditing: boolean;
  afterId: string | null;
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <EmptyState
      icon={AlertCircle}
      title={t('Something went wrong.')}
      message={t('Please try again.')}
      actionLabel={t('Try again')}
      onAction={onRetry}
    />
  );
}

export default function FormManagementScreen() {
  const { t } = useTranslation();
  const toast = useToast();
  const padding = useScreenPadding();
  const { eventId, data: event, isLoading: eventLoading, isError: eventError, refetch: refetchEvent } =
    useSelectedEvent();
  const cancelled = event?.is_cancelled === true;
  const skip = eventId == null || cancelled;
  const statsQuery = useGetEventFormStatisticsQuery(eventId ?? 0, { skip });
  const responsesQuery = useGetEventFormResponsesQuery(eventId ?? 0, { skip });
  const [updateQuestions, { isLoading: saving }] = useUpdateEventQuestionsMutation();

  const serverQuestions = event?.questions_data;
  const [syncedFrom, setSyncedFrom] = useState(serverQuestions);
  const [questions, setQuestions] = useState<FormQuestion[]>(() => toFormQuestions(serverQuestions));
  if (serverQuestions !== syncedFrom) {
    setSyncedFrom(serverQuestions);
    setQuestions(toFormQuestions(serverQuestions));
  }

  const [tab, setTab] = useState<FormTab>('builder');
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const respondents = responsesQuery.data?.data ?? [];

  const openAdd = (afterId: string | null) => {
    haptics.light();
    setSheet({ initial: { ...EMPTY_QUESTION, id: generateQuestionId() }, isEditing: false, afterId });
  };

  const openEdit = (question: FormQuestion) => setSheet({ initial: question, isEditing: true, afterId: null });

  const onSave = async () => {
    if (eventId == null) return;
    try {
      await updateQuestions({ eventId, questions: toQuestionsPayload(questions) }).unwrap();
      haptics.success();
      toast(t('Questions updated successfully'), 'success');
    } catch {
      haptics.error();
      toast(t('Failed to update questions'), 'error');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchEvent(), ...(skip ? [] : [statsQuery.refetch(), responsesQuery.refetch()])]);
    } finally {
      setRefreshing(false);
    }
  };

  const tabs: { value: FormTab; label: string }[] = [
    { value: 'canvas', label: t('Canvas Builder') },
    { value: 'builder', label: t('Form Builder') },
    { value: 'statistics', label: t('Statistics') },
    { value: 'responses', label: t('Responses') },
  ];

  const renderTab = () => {
    switch (tab) {
      case 'canvas':
        return (
          <CanvasTab
            questions={questions}
            saving={saving}
            onChange={setQuestions}
            onAdd={openAdd}
            onEdit={openEdit}
            onDelete={(question) => setQuestions((prev) => deleteQuestion(prev, question.id))}
            onSave={() => void onSave()}
          />
        );
      case 'builder':
        return (
          <FormBuilderTab
            questions={questions}
            saving={saving}
            onAdd={() => openAdd(null)}
            onEdit={openEdit}
            onMove={(index, direction) => setQuestions((prev) => moveQuestion(prev, index, direction))}
            onDuplicate={(index) => setQuestions((prev) => duplicateQuestion(prev, index, t('Copy')))}
            onDelete={(question) => setQuestions((prev) => deleteQuestion(prev, question.id))}
            onSave={() => void onSave()}
          />
        );
      case 'statistics':
        if (statsQuery.isLoading) return <StatisticsSkeleton />;
        if (statsQuery.isError) return <ErrorState onRetry={() => void statsQuery.refetch()} />;
        return <StatisticsTab stats={statsQuery.data} questions={questions} />;
      case 'responses':
        if (responsesQuery.isLoading) {
          return (
            <View className="gap-4">
              <TilesSkeleton count={2} />
              <TilesSkeleton count={2} />
              <ListSkeleton />
            </View>
          );
        }
        if (responsesQuery.isError) return <ErrorState onRetry={() => void responsesQuery.refetch()} />;
        return <ResponsesTab responses={respondents} questions={questions} />;
    }
  };

  const renderBody = () => {
    if (eventLoading) return <ListSkeleton />;
    if (eventError || !event) {
      return (
        <EmptyState
          icon={ClipboardList}
          title={t('Unable to load event data.')}
          actionLabel={t('Try again')}
          onAction={() => void refetchEvent()}
        />
      );
    }
    if (cancelled) return <EmptyState icon={Ban} title={t('Event cancelled, no form management.')} />;
    return (
      <View className="gap-4">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="-mx-4"
          contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
        >
          {tabs.map((entry) => (
            <Chip
              key={entry.value}
              label={entry.label}
              selected={tab === entry.value}
              onPress={() => setTab(entry.value)}
              trailing={
                entry.value === 'responses' && respondents.length > 0 ? (
                  <View className="h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1">
                    <AppText className="font-gilroy-bold text-[10px] text-white">{respondents.length}</AppText>
                  </View>
                ) : undefined
              }
            />
          ))}
        </ScrollView>
        {renderTab()}
      </View>
    );
  };

  return (
    <Screen edges={[]}>
      <GlassHeader title={t('Form Management')} onBack={navigate.back} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: padding.top, paddingBottom: padding.bottom, paddingHorizontal: 16 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={colors.muted}
            progressViewOffset={padding.top}
          />
        }
      >
        <View className="gap-4">
          <AppText className="font-gilroy-medium text-[14px] text-muted dark:text-dark-muted">
            {t('Manage your event registration form')}
          </AppText>
          {renderBody()}
        </View>
      </ScrollView>

      {sheet ? (
        <QuestionSheet
          initial={sheet.initial}
          isEditing={sheet.isEditing}
          questions={questions}
          onClose={() => setSheet(null)}
          onSave={(saved) => {
            setQuestions((prev) => upsertQuestion(prev, saved, sheet.afterId));
            setSheet(null);
          }}
        />
      ) : null}
    </Screen>
  );
}
