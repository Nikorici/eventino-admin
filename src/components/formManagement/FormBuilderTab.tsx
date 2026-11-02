import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, ClipboardList, Copy, Pencil, Trash2 } from 'lucide-react-native';

import { AppText, DashedAddButton, EmptyState, PressableScale } from '@/components/ui';
import { Card } from '@/components/merch/merchParts';
import { useThemeColor } from '@/hooks/useThemeColor';
import { cn } from '@/lib/cn';
import { haptics } from '@/lib/haptics';
import { colors } from '@/theme/colors';

import { FormButton } from './FormButton';
import { isChoiceType, questionTypeOf, type FormQuestion } from './formQuestions';
import { OptionIndicator } from './OptionIndicator';

const PREVIEW_LIMIT = 4;

export function Pill({ label, color, dot, alpha = '1a' }: { label: string; color?: string; dot?: string; alpha?: string }) {
  return (
    <View
      className={cn('h-6 flex-row items-center gap-1.5 rounded-full px-2.5', !color && 'bg-black/[0.05] dark:bg-white/10')}
      style={color ? { backgroundColor: `${color}${alpha}` } : undefined}
    >
      {dot ? <View className="h-2 w-2 rounded-full" style={{ backgroundColor: dot }} /> : null}
      <AppText
        className={cn('text-[11px] leading-[14px]', color ? 'font-gilroy-semibold' : 'font-gilroy-medium text-muted dark:text-dark-muted')}
        style={color ? { color } : undefined}
      >
        {label}
      </AppText>
    </View>
  );
}

function RoundAction({
  label,
  onPress,
  disabled,
  danger,
  children,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <PressableScale
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      disabled={disabled}
      accessibilityLabel={label}
      className={cn(
        'h-9 w-9 items-center justify-center rounded-full',
        danger ? 'bg-danger/[0.13]' : 'bg-black/[0.04] dark:bg-white/10',
        disabled && 'opacity-35',
      )}
    >
      {children}
    </PressableScale>
  );
}

function QuestionCard({
  question,
  index,
  total,
  onMove,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  question: FormQuestion;
  index: number;
  total: number;
  onMove: (direction: -1 | 1) => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const iconColor = useThemeColor(colors.primary, colors.dark.text);
  const typeConfig = questionTypeOf(question.type);
  const options = isChoiceType(question.type) ? question.options : [];
  return (
    <Card className="gap-3 p-4">
      <View className="flex-row flex-wrap items-center gap-1.5">
        <View className="h-[22px] w-[22px] items-center justify-center rounded-full bg-primary dark:bg-white">
          <AppText className="font-gilroy-bold text-[12px] text-white dark:text-primary leading-[16px]">{index + 1}</AppText>
        </View>
        <Pill label={t(typeConfig.label)} dot={typeConfig.color} />
        {question.required ? <Pill label={t('Required')} color={colors.danger} /> : null}
        {question.conditions.length > 0 ? <Pill label={t('Has conditions')} color={colors.accent} alpha="24" /> : null}
      </View>
      <View className="gap-1">
        <AppText className="font-gilroy-semibold text-[15px] leading-[20px]">{question.question}</AppText>
        {question.description ? (
          <AppText className="font-gilroy-medium text-[13px] text-muted dark:text-dark-muted leading-[17px]">{question.description}</AppText>
        ) : null}
      </View>
      {options.length > 0 ? (
        <View className="flex-row flex-wrap items-center gap-1.5">
          {options.slice(0, PREVIEW_LIMIT).map((option, optionIndex) => (
            <View
              key={`${option}-${optionIndex}`}
              className="h-6 flex-row items-center gap-1.5 rounded-[6px] bg-card-sm px-2 dark:bg-dark-elevated"
            >
              <OptionIndicator type={question.type} index={optionIndex} />
              <AppText className="font-gilroy-semibold text-[12px] text-primary/80 dark:text-dark-text/80 leading-[16px]">{option}</AppText>
            </View>
          ))}
          {options.length > PREVIEW_LIMIT ? (
            <AppText className="font-gilroy-semibold text-[12px] text-muted dark:text-dark-muted leading-[16px]">
              +{options.length - PREVIEW_LIMIT} {t('more')}
            </AppText>
          ) : null}
        </View>
      ) : null}
      <View className="h-px bg-[#f0f2f8] dark:bg-dark-border" />
      <View className="flex-row items-center justify-between">
        <View className="flex-row gap-2">
          <RoundAction label={t('Move up')} onPress={() => onMove(-1)} disabled={index === 0}>
            <ArrowUp size={16} color={iconColor} />
          </RoundAction>
          <RoundAction label={t('Move down')} onPress={() => onMove(1)} disabled={index === total - 1}>
            <ArrowDown size={16} color={iconColor} />
          </RoundAction>
        </View>
        <View className="flex-row gap-2">
          <RoundAction label={t('Edit')} onPress={onEdit}>
            <Pencil size={16} color={iconColor} />
          </RoundAction>
          <RoundAction label={t('Duplicate')} onPress={onDuplicate}>
            <Copy size={16} color={iconColor} />
          </RoundAction>
          <RoundAction label={t('Delete')} onPress={onDelete} danger>
            <Trash2 size={16} color={colors.danger} />
          </RoundAction>
        </View>
      </View>
    </Card>
  );
}

export function FormBuilderTab({
  questions,
  saving,
  onAdd,
  onEdit,
  onMove,
  onDuplicate,
  onDelete,
  onSave,
}: {
  questions: FormQuestion[];
  saving: boolean;
  onAdd: () => void;
  onEdit: (question: FormQuestion) => void;
  onMove: (index: number, direction: -1 | 1) => void;
  onDuplicate: (index: number) => void;
  onDelete: (question: FormQuestion) => void;
  onSave: () => void;
}) {
  const { t } = useTranslation();
  return (
    <View className="gap-4">
      <AppText className="font-gilroy-medium text-[13px] text-muted dark:text-dark-muted leading-[17px]">
        {t('Create and customize your registration questions. Use arrows to reorder.')}
      </AppText>
      {questions.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={t('No questions yet')}
          message={t('Start building your form by adding questions')}
          actionLabel={t('Add your first question')}
          onAction={onAdd}
          className="py-10"
        />
      ) : (
        <>
          <DashedAddButton label={t('Add Question')} onPress={onAdd} />
          <View className="gap-3">
            {questions.map((question, index) => (
              <QuestionCard
                key={question.id}
                question={question}
                index={index}
                total={questions.length}
                onMove={(direction) => onMove(index, direction)}
                onEdit={() => onEdit(question)}
                onDuplicate={() => onDuplicate(index)}
                onDelete={() => onDelete(question)}
              />
            ))}
          </View>
        </>
      )}
      <FormButton primary size="md" label={saving ? t('Saving...') : t('Save Changes')} loading={saving} onPress={onSave} />
    </View>
  );
}
