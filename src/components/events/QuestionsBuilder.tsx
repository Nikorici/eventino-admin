import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { ChevronDown, ChevronUp, ListChecks, Pencil, Plus, Trash2, X } from 'lucide-react-native';

import { cn } from '@/lib/cn';
import { haptics } from '@/lib/haptics';
import { colors } from '@/theme/colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { QuestionType } from '@/types/api';
import { AppText, Chip, DashedAddButton, GlassButton, GlassInput, PressableScale } from '@/components/ui';

export interface EventFormQuestion {
  id?: number | string;
  question: string;
  description: string;
  type: QuestionType;
  options: string[];
  conditions: unknown[];
  required: boolean;
}

export const QUESTION_OPTION_TYPES: QuestionType[] = ['multiple_choice', 'checkboxes', 'dropdown'];

const QUESTION_TYPE_LABELS: { value: QuestionType; label: string }[] = [
  { value: 'short_answer', label: 'Short Answer' },
  { value: 'paragraph', label: 'Paragraph' },
  { value: 'email', label: 'Email' },
  { value: 'phone_number', label: 'Phone Number' },
  { value: 'multiple_choice', label: 'Multiple Choice' },
  { value: 'checkboxes', label: 'Checkboxes' },
  { value: 'dropdown', label: 'Dropdown' },
];

export function questionTypeLabel(type: QuestionType): string {
  return QUESTION_TYPE_LABELS.find((entry) => entry.value === type)?.label ?? type;
}

const EMPTY_DRAFT: EventFormQuestion = {
  question: '',
  description: '',
  type: 'short_answer',
  options: [],
  conditions: [],
  required: false,
};

interface RequiredToggleProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  label: string;
}

function RequiredToggle({ value, onValueChange, label }: RequiredToggleProps) {
  return (
    <PressableScale
      onPress={() => {
        haptics.selection();
        onValueChange(!value);
      }}
      accessibilityLabel={label}
      className="flex-row items-center justify-between rounded-[12px] border border-app-border bg-app-surface px-4 py-3 dark:border-dark-border dark:bg-dark-surface"
    >
      <AppText className="font-gilroy-semibold text-[14px]">{label}</AppText>
      <View className={cn('h-[26px] w-[44px] justify-center rounded-full p-[3px]', value ? 'bg-primary dark:bg-white' : 'bg-black/15 dark:bg-white/20')}>
        <View className={cn('h-5 w-5 rounded-full bg-white dark:bg-dark-bg', value && 'self-end')} />
      </View>
    </PressableScale>
  );
}

export interface QuestionsBuilderProps {
  questions: EventFormQuestion[];
  onChange: (questions: EventFormQuestion[]) => void;
}

export function QuestionsBuilder({ questions, onChange }: QuestionsBuilderProps) {
  const { t } = useTranslation();
  const isDark = useColorScheme() === 'dark';
  const mutedIcon = isDark ? colors.dark.textSecondary : colors.muted;

  const [modalOpen, setModalOpen] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<EventFormQuestion>(EMPTY_DRAFT);
  const [questionError, setQuestionError] = useState<string | undefined>(undefined);
  const [optionsError, setOptionsError] = useState<string | undefined>(undefined);

  const openAdd = () => {
    haptics.selection();
    setDraft(EMPTY_DRAFT);
    setEditIndex(null);
    setQuestionError(undefined);
    setOptionsError(undefined);
    setModalOpen(true);
  };

  const openEdit = (index: number) => {
    haptics.selection();
    setDraft(questions[index]);
    setEditIndex(index);
    setQuestionError(undefined);
    setOptionsError(undefined);
    setModalOpen(true);
  };

  const removeQuestion = (index: number) => {
    haptics.selection();
    onChange(questions.filter((_, i) => i !== index));
  };

  const moveQuestion = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= questions.length) return;
    haptics.selection();
    const next = [...questions];
    const moved = next[index];
    next[index] = next[target];
    next[target] = moved;
    onChange(next);
  };

  const supportsOptions = QUESTION_OPTION_TYPES.includes(draft.type);

  const saveDraft = () => {
    const trimmedQuestion = draft.question.trim();
    const cleanOptions = draft.options.map((option) => option.trim()).filter((option) => option.length > 0);
    if (trimmedQuestion.length === 0) {
      setQuestionError(t('Question text is required'));
      haptics.error();
      return;
    }
    if (supportsOptions && cleanOptions.length < 2) {
      setOptionsError(t('At least 2 options are required'));
      haptics.error();
      return;
    }
    const saved: EventFormQuestion = {
      ...draft,
      question: trimmedQuestion,
      description: draft.description.trim(),
      options: cleanOptions,
    };
    const next = editIndex == null ? [...questions, saved] : questions.map((q, i) => (i === editIndex ? saved : q));
    onChange(next);
    haptics.success();
    setModalOpen(false);
  };

  const setDraftOption = (index: number, value: string) => {
    setOptionsError(undefined);
    setDraft((prev) => ({ ...prev, options: prev.options.map((option, i) => (i === index ? value : option)) }));
  };

  const addDraftOption = () => {
    haptics.selection();
    setDraft((prev) => ({ ...prev, options: [...prev.options, ''] }));
  };

  const removeDraftOption = (index: number) => {
    haptics.selection();
    setDraft((prev) => ({ ...prev, options: prev.options.filter((_, i) => i !== index) }));
  };

  return (
    <View className="gap-3">
      {questions.map((question, index) => (
        <View
          key={question.id ?? `new-${index}`}
          className="gap-2 rounded-2xl border border-app-border bg-app-bg p-4 dark:border-dark-border dark:bg-dark-bg"
        >
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1">
              <AppText className="font-gilroy-semibold text-[15px]">{question.question}</AppText>
              <AppText className="mt-0.5 font-gilroy-medium text-[12px] text-muted dark:text-dark-muted">
                {t(questionTypeLabel(question.type))}
                {question.required ? ` · ${t('Required')}` : ''}
              </AppText>
            </View>
            <View className="flex-row items-center gap-1.5">
              <PressableScale
                onPress={() => moveQuestion(index, -1)}
                disabled={index === 0}
                accessibilityLabel={t('Move up')}
                className={cn('h-8 w-8 items-center justify-center rounded-full bg-black/[0.05] dark:bg-white/10', index === 0 && 'opacity-30')}
              >
                <ChevronUp size={16} color={mutedIcon} />
              </PressableScale>
              <PressableScale
                onPress={() => moveQuestion(index, 1)}
                disabled={index === questions.length - 1}
                accessibilityLabel={t('Move down')}
                className={cn(
                  'h-8 w-8 items-center justify-center rounded-full bg-black/[0.05] dark:bg-white/10',
                  index === questions.length - 1 && 'opacity-30',
                )}
              >
                <ChevronDown size={16} color={mutedIcon} />
              </PressableScale>
              <PressableScale
                onPress={() => openEdit(index)}
                accessibilityLabel={t('Edit Question')}
                className="h-8 w-8 items-center justify-center rounded-full bg-black/[0.05] dark:bg-white/10"
              >
                <Pencil size={15} color={mutedIcon} />
              </PressableScale>
              <PressableScale
                onPress={() => removeQuestion(index)}
                accessibilityLabel={t('Remove')}
                className="h-8 w-8 items-center justify-center rounded-full bg-danger/10"
              >
                <Trash2 size={15} color={colors.danger} />
              </PressableScale>
            </View>
          </View>
          {QUESTION_OPTION_TYPES.includes(question.type) && question.options.length > 0 ? (
            <AppText numberOfLines={2} className="font-gilroy-medium text-[12px] text-muted dark:text-dark-muted">
              {question.options.join(' · ')}
            </AppText>
          ) : null}
        </View>
      ))}

      <DashedAddButton
        label={questions.length === 0 ? t('Add your first question') : t('Add Question')}
        onPress={openAdd}
      />

      <Modal visible={modalOpen} transparent animationType="fade" onRequestClose={() => setModalOpen(false)}>
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          <Pressable onPress={() => setModalOpen(false)} className="flex-1 justify-end bg-black/40">
            <Pressable onPress={(event) => event.stopPropagation()} className="max-h-[85%] rounded-t-[20px] bg-app-bg pt-3 dark:bg-dark-surface">
              <View className="mb-2 flex-row items-center justify-between px-5">
                <AppText className="font-gilroy-bold text-[17px]">
                  {editIndex == null ? t('Add Question') : t('Edit Question')}
                </AppText>
                <PressableScale
                  onPress={() => setModalOpen(false)}
                  accessibilityLabel={t('Cancel')}
                  className="h-9 w-9 items-center justify-center rounded-full bg-black/[0.05] dark:bg-white/10"
                >
                  <X size={17} color={mutedIcon} />
                </PressableScale>
              </View>
              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 14 }}>
                <GlassInput
                  label={t('Question Text')}
                  placeholder={t('Enter your question')}
                  value={draft.question}
                  onChangeText={(value) => {
                    setQuestionError(undefined);
                    setDraft((prev) => ({ ...prev, question: value }));
                  }}
                  error={questionError}
                  autoCapitalize="sentences"
                />
                <GlassInput
                  label={`${t('Description')} (${t('optional')})`}
                  placeholder={t('Add a description or helper text')}
                  value={draft.description}
                  onChangeText={(value) => setDraft((prev) => ({ ...prev, description: value }))}
                  autoCapitalize="sentences"
                />
                <View className="gap-2">
                  <AppText className="font-gilroy-medium text-[13px] text-primary/70 dark:text-dark-text/70">{t('Question Type')}</AppText>
                  <View className="flex-row flex-wrap gap-2">
                    {QUESTION_TYPE_LABELS.map((entry) => (
                      <Chip
                        key={entry.value}
                        label={t(entry.label)}
                        selected={draft.type === entry.value}
                        onPress={() => {
                          setOptionsError(undefined);
                          setDraft((prev) => ({ ...prev, type: entry.value }));
                        }}
                      />
                    ))}
                  </View>
                </View>
                {supportsOptions ? (
                  <View className="gap-2">
                    <View className="flex-row items-center gap-1.5">
                      <ListChecks size={15} color={mutedIcon} />
                      <AppText className="font-gilroy-medium text-[13px] text-primary/70 dark:text-dark-text/70">{t('Answer Options')}</AppText>
                    </View>
                    {draft.options.map((option, index) => (
                      <View key={index} className="flex-row items-center gap-2">
                        <View className="flex-1">
                          <GlassInput
                            placeholder={`${t('Option')} ${index + 1}`}
                            value={option}
                            onChangeText={(value) => setDraftOption(index, value)}
                            autoCapitalize="sentences"
                          />
                        </View>
                        <PressableScale
                          onPress={() => removeDraftOption(index)}
                          accessibilityLabel={t('Remove')}
                          className="h-9 w-9 items-center justify-center rounded-full bg-danger/10"
                        >
                          <X size={15} color={colors.danger} />
                        </PressableScale>
                      </View>
                    ))}
                    <PressableScale onPress={addDraftOption} accessibilityLabel={t('Add an option')} className="flex-row items-center gap-1.5 self-start">
                      <Plus size={15} color={colors.links} />
                      <AppText className="font-gilroy-semibold text-[13px] text-links dark:text-dark-text">{t('Add an option')}</AppText>
                    </PressableScale>
                    {optionsError ? <AppText className="font-gilroy-medium text-xs text-danger">{optionsError}</AppText> : null}
                  </View>
                ) : null}
                <RequiredToggle
                  label={t('Required question')}
                  value={draft.required}
                  onValueChange={(value) => setDraft((prev) => ({ ...prev, required: value }))}
                />
                <GlassButton label={t('Save')} variant="primary" onPress={saveDraft} className="rounded-[12px]" />
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
