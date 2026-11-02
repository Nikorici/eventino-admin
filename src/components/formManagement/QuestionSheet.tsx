import { useState } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Check, ChevronDown, X } from 'lucide-react-native';

import { AppText, Chip, GlassInput, PressableScale } from '@/components/ui';
import { Card, SheetModal, ToggleRow } from '@/components/merch/merchParts';
import { useThemeColor } from '@/hooks/useThemeColor';
import { cn } from '@/lib/cn';
import { haptics } from '@/lib/haptics';
import { colors } from '@/theme/colors';

import { FormButton } from './FormButton';
import {
  CONDITION_ACTIONS,
  emptyCondition,
  finalizeQuestion,
  isChoiceType,
  isQuestionLevel,
  QUESTION_TYPES,
  validateQuestion,
  type FormCondition,
  type FormQuestion,
} from './formQuestions';
import { OptionIndicator } from './OptionIndicator';

interface SelectOption {
  value: string;
  label: string;
}

function InlineSelect({
  value,
  options,
  placeholder,
  accessibilityLabel,
  onChange,
}: {
  value: string | null;
  options: SelectOption[];
  placeholder: string;
  accessibilityLabel: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const iconColor = useThemeColor(colors.primary, colors.dark.text);
  const selected = options.find((option) => option.value === value);
  return (
    <View className="flex-1 gap-1.5">
      <PressableScale
        onPress={() => {
          haptics.selection();
          setOpen((current) => !current);
        }}
        accessibilityLabel={accessibilityLabel}
        className="h-11 flex-row items-center justify-between gap-2 rounded-[10px] border border-app-border bg-app-surface px-3 dark:border-dark-border dark:bg-dark-surface"
      >
        <AppText numberOfLines={1} className={cn('flex-1 font-gilroy-medium text-[14px] leading-[19px]', !selected && 'text-muted dark:text-dark-muted')}>
          {selected?.label ?? placeholder}
        </AppText>
        <ChevronDown size={16} color={colors.muted} />
      </PressableScale>
      {open ? (
        <View className="overflow-hidden rounded-[10px] border border-app-border bg-app-surface dark:border-dark-border dark:bg-dark-surface">
          {options.map((option, index) => (
            <Pressable
              key={option.value}
              onPress={() => {
                haptics.selection();
                onChange(option.value);
                setOpen(false);
              }}
              accessibilityRole="button"
              accessibilityLabel={option.label}
              className={cn(
                'flex-row items-center justify-between gap-2 px-3 py-2.5',
                index > 0 && 'border-t border-app-border dark:border-dark-border',
              )}
            >
              <AppText numberOfLines={1} className="flex-1 font-gilroy-medium text-[14px] leading-[19px]">
                {option.label}
              </AppText>
              {option.value === value ? <Check size={16} color={iconColor} /> : null}
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <AppText className="font-gilroy-medium text-[13px] text-primary/70 dark:text-dark-text/70 leading-[17px]">
      {label}
      {required ? <AppText className="font-gilroy-medium text-[13px] text-danger dark:text-danger leading-[17px]"> *</AppText> : null}
    </AppText>
  );
}

function LinkButton({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) {
  return (
    <PressableScale
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      accessibilityLabel={label}
      hitSlop={8}
      className="self-start px-1"
    >
      <AppText className={cn('font-gilroy-semibold text-[13px] leading-[17px]', danger ? 'text-danger dark:text-danger' : 'text-links dark:text-dark-text')}>
        {label}
      </AppText>
    </PressableScale>
  );
}

function ConditionEditor({
  condition,
  questions,
  onChange,
  onRemove,
}: {
  condition: FormCondition;
  questions: FormQuestion[];
  onChange: (patch: Partial<FormCondition>) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const actionOptions = CONDITION_ACTIONS.map((action) => ({ value: action.value, label: t(action.label) }));
  const targetOptions = questions.map((question, index) => ({
    value: question.id,
    label: `${index + 1}. ${question.question.substring(0, 35)}`,
  }));
  return (
    <View className="gap-2">
      <View className="flex-row items-start gap-2">
        <InlineSelect
          value={condition.action}
          options={actionOptions}
          placeholder={t('Continue to next question')}
          accessibilityLabel={t('Condition action')}
          onChange={(value) => {
            const action = CONDITION_ACTIONS.find((entry) => entry.value === value)?.value ?? 'continue';
            onChange({
              action,
              ...(action !== 'skip' ? { targetQuestionIndex: null, targetQuestionId: null } : {}),
              ...(action !== 'show_message' ? { message: '' } : {}),
            });
          }}
        />
        <View className="h-11 justify-center">
          <LinkButton label={t('Remove')} onPress={onRemove} danger />
        </View>
      </View>
      {condition.action === 'show_message' ? (
        <GlassInput
          placeholder={t('Enter message to display')}
          value={condition.message}
          onChangeText={(message) => onChange({ message })}
          autoCapitalize="sentences"
        />
      ) : null}
      {condition.action === 'skip' ? (
        <InlineSelect
          value={condition.targetQuestionId}
          options={targetOptions}
          placeholder={t('Select question')}
          accessibilityLabel={t('Select question')}
          onChange={(value) =>
            onChange({ targetQuestionId: value, targetQuestionIndex: questions.findIndex((q) => q.id === value) })
          }
        />
      ) : null}
    </View>
  );
}

export function QuestionSheet({
  initial,
  isEditing,
  questions,
  onClose,
  onSave,
}: {
  initial: FormQuestion;
  isEditing: boolean;
  questions: FormQuestion[];
  onClose: () => void;
  onSave: (question: FormQuestion) => void;
}) {
  const { t } = useTranslation();
  const { height } = useWindowDimensions();
  const mutedIcon = useThemeColor(colors.muted, colors.dark.textSecondary);
  const [draft, setDraft] = useState<FormQuestion>(initial);
  const [newOption, setNewOption] = useState('');
  const [errors, setErrors] = useState<{ question?: string; options?: string }>({});

  const isChoice = isChoiceType(draft.type);
  const routing = draft.conditions.find(isQuestionLevel);

  const patchConditions = (update: (conditions: FormCondition[]) => FormCondition[]) =>
    setDraft((prev) => ({ ...prev, conditions: update(prev.conditions) }));

  const addOption = () => {
    const value = newOption.trim();
    if (!value) return;
    haptics.selection();
    setErrors((prev) => ({ ...prev, options: undefined }));
    setDraft((prev) => ({ ...prev, options: [...prev.options, value] }));
    setNewOption('');
  };

  const removeOption = (index: number) => {
    haptics.selection();
    setDraft((prev) => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index),
      conditions: prev.conditions
        .filter((condition) => condition.optionIndex !== index)
        .map((condition) =>
          condition.optionIndex != null && condition.optionIndex > index
            ? { ...condition, optionIndex: condition.optionIndex - 1 }
            : condition,
        ),
    }));
  };

  const updateCondition = (target: FormCondition, patch: Partial<FormCondition>) =>
    patchConditions((conditions) => conditions.map((c) => (c === target ? { ...c, ...patch } : c)));

  const removeCondition = (target: FormCondition) => patchConditions((conditions) => conditions.filter((c) => c !== target));

  const setTerminal = (checked: boolean) =>
    setDraft((prev) =>
      checked
        ? {
            ...prev,
            is_terminal: true,
            conditions: prev.conditions.filter((c) => !isQuestionLevel(c) && c.action !== 'skip'),
          }
        : {
            ...prev,
            is_terminal: false,
            conditions: prev.conditions.filter((c) => !(isQuestionLevel(c) && c.action === 'end')),
          },
    );

  const submit = () => {
    const found = validateQuestion(draft);
    if (found.question || found.options) {
      haptics.error();
      setErrors({ question: found.question && t(found.question), options: found.options && t(found.options) });
      return;
    }
    haptics.success();
    onSave(finalizeQuestion(draft));
  };

  return (
    <SheetModal visible onClose={onClose} title={isEditing ? t('Edit Question') : t('Add Question')}>
      <ScrollView
        style={{ maxHeight: height * 0.72 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: 16, paddingBottom: 4 }}
      >
        <View className="gap-1.5">
          <FieldLabel label={t('Question Text')} required />
          <GlassInput
            placeholder={t('Enter your question')}
            value={draft.question}
            onChangeText={(question) => {
              setErrors((prev) => ({ ...prev, question: undefined }));
              setDraft((prev) => ({ ...prev, question }));
            }}
            error={errors.question}
            autoCapitalize="sentences"
            accessibilityLabel={t('Question Text')}
          />
        </View>

        <View className="gap-1.5">
          <FieldLabel label={`${t('Description')} (${t('optional')})`} />
          <GlassInput
            placeholder={t('Add a description or helper text')}
            value={draft.description}
            onChangeText={(description) => setDraft((prev) => ({ ...prev, description }))}
            autoCapitalize="sentences"
            accessibilityLabel={t('Description')}
          />
        </View>

        <View className="gap-2">
          <FieldLabel label={t('Question Type')} />
          <View className="flex-row flex-wrap gap-2">
            {QUESTION_TYPES.map((entry) => (
              <Chip
                key={entry.value}
                label={t(entry.label)}
                selected={draft.type === entry.value}
                onPress={() => {
                  setErrors((prev) => ({ ...prev, options: undefined }));
                  setDraft((prev) => ({ ...prev, type: entry.value }));
                }}
              />
            ))}
          </View>
        </View>

        {isChoice ? (
          <View className="gap-2">
            <FieldLabel label={t('Answer Options')} required />
            <View className="gap-3">
              {draft.options.map((option, index) => {
                const condition = draft.conditions.find((c) => c.optionIndex === index);
                return (
                  <View key={index} className="gap-2">
                    <View className="flex-row items-center gap-2">
                      <View className="w-[18px] items-center">
                        <OptionIndicator type={draft.type} index={index} />
                      </View>
                      <View className="flex-1">
                        <GlassInput
                          value={option}
                          accessibilityLabel={`${t('Option')} ${index + 1}`}
                          onChangeText={(value) =>
                            setDraft((prev) => ({
                              ...prev,
                              options: prev.options.map((entry, i) => (i === index ? value : entry)),
                            }))
                          }
                        />
                      </View>
                      <PressableScale
                        onPress={() => removeOption(index)}
                        accessibilityLabel={t('Remove option')}
                        className="h-10 w-10 items-center justify-center rounded-full bg-black/[0.04] dark:bg-white/10"
                      >
                        <X size={16} color={mutedIcon} />
                      </PressableScale>
                    </View>
                    {draft.is_terminal ? null : (
                      <View className="ml-[26px]">
                        {condition ? (
                          <ConditionEditor
                            condition={condition}
                            questions={questions}
                            onChange={(patch) => updateCondition(condition, patch)}
                            onRemove={() => removeCondition(condition)}
                          />
                        ) : (
                          <LinkButton
                            label={`+ ${t('Add Logic')}`}
                            onPress={() => patchConditions((conditions) => [...conditions, emptyCondition(index)])}
                          />
                        )}
                      </View>
                    )}
                  </View>
                );
              })}
              <View className="flex-row items-center gap-2">
                <View className="flex-1">
                  <GlassInput
                    placeholder={t('Add an option')}
                    value={newOption}
                    onChangeText={setNewOption}
                    onSubmitEditing={addOption}
                    returnKeyType="done"
                    accessibilityLabel={t('Add an option')}
                  />
                </View>
                <FormButton size="field" label={t('Add')} onPress={addOption} />
              </View>
              {errors.options ? (
                <AppText className="font-gilroy-medium text-xs text-danger dark:text-danger">{errors.options}</AppText>
              ) : null}
            </View>
          </View>
        ) : null}

        <View className="gap-2">
          <Card className="px-4">
            <View className="py-2">
              <ToggleRow
                bordered={false}
                label={t('Required question')}
                value={draft.required}
                onValueChange={(required) => setDraft((prev) => ({ ...prev, required }))}
              />
            </View>
            <View className="border-t border-[#f0f2f8] py-2 dark:border-dark-border">
              <ToggleRow
                bordered={false}
                label={t('End form at this question')}
                value={draft.is_terminal}
                onValueChange={setTerminal}
              />
            </View>
          </Card>
          {draft.is_terminal ? (
            <AppText className="font-gilroy-medium text-[12px] text-muted dark:text-dark-muted leading-[16px]">
              {t('The form will end after this question is answered. No further questions will be shown.')}
            </AppText>
          ) : null}
        </View>

        {!isChoice && !draft.is_terminal ? (
          <View className="gap-2">
            <View className="gap-0.5">
              <FieldLabel label={t('Question Routing')} />
              <AppText className="font-gilroy-medium text-[12px] text-muted dark:text-dark-muted leading-[16px]">
                {t('Control what happens after this question is answered')}
              </AppText>
            </View>
            {routing ? (
              <ConditionEditor
                condition={routing}
                questions={questions}
                onChange={(patch) => updateCondition(routing, patch)}
                onRemove={() => removeCondition(routing)}
              />
            ) : (
              <LinkButton
                label={`+ ${t('Add Routing')}`}
                onPress={() => patchConditions((conditions) => [...conditions, emptyCondition(null)])}
              />
            )}
          </View>
        ) : null}
      </ScrollView>

      <View className="mt-5 flex-row gap-3">
        <View className="flex-1">
          <FormButton size="lg" label={t('Cancel')} onPress={onClose} />
        </View>
        <View className="flex-1">
          <FormButton primary size="lg" label={isEditing ? t('Update Question') : t('Add Question')} onPress={submit} />
        </View>
      </View>
    </SheetModal>
  );
}

