import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Switch, View, useWindowDimensions } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { Check, ChevronDown, TriangleAlert, type LucideIcon } from 'lucide-react-native';

import { AppText, GlassButton, GlassInput, KeyboardPadding, PressableScale, SlideUp } from '@/components/ui';
import { useThemeColor } from '@/hooks/useThemeColor';
import { cn } from '@/lib/cn';
import { haptics } from '@/lib/haptics';
import { colors } from '@/theme/colors';

import { TONE_COLORS, type Tone } from './printingLogic';
import { sheetBottomPad } from '@/hooks/useScreenPadding';

export interface SelectOption {
  value: string;
  label: string;
}

export function SelectField({
  label,
  value,
  options,
  onChange,
  fallbackLabel,
  disabled,
  accessibilityLabel,
}: {
  label?: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  fallbackLabel?: string;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const iconColor = useThemeColor(colors.muted, colors.dark.textSecondary);
  const current = options.find((option) => option.value === value)?.label ?? fallbackLabel ?? '';
  const title = label ?? accessibilityLabel ?? '';
  return (
    <View className="w-full gap-1.5">
      {label ? <AppText className="font-gilroy-medium text-[13px] leading-[17px] text-primary/70 dark:text-dark-text/70">{label}</AppText> : null}
      <PressableScale
        onPress={() => {
          haptics.selection();
          setOpen(true);
        }}
        disabled={disabled}
        accessibilityLabel={title}
        className={cn(
          'h-12 flex-row items-center gap-2 rounded-[10px] border border-app-border bg-app-surface px-3 dark:border-dark-border dark:bg-dark-surface',
          disabled && 'opacity-60',
        )}
      >
        <AppText numberOfLines={1} className="flex-1 font-gilroy text-[15px] leading-[20px]">
          {current}
        </AppText>
        <ChevronDown size={18} color={iconColor} />
      </PressableScale>
      {open ? (
        <SelectSheet title={title} options={options} value={value} onSelect={onChange} onClose={() => setOpen(false)} />
      ) : null}
    </View>
  );
}

function SelectSheet({
  title,
  options,
  value,
  onSelect,
  onClose,
}: {
  title: string;
  options: SelectOption[];
  value: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const checkColor = useThemeColor(colors.primary, colors.dark.text);
  const { height: windowHeight } = useWindowDimensions();
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <Pressable className="flex-1" onPress={onClose} accessibilityLabel={t('Close')} />
        <SlideUp>
        <View className="rounded-t-[20px] bg-app-bg pb-8 pt-3 dark:bg-dark-bg" style={{ maxHeight: windowHeight * 0.7 }}>
          <View className="mb-2 h-1 w-10 self-center rounded-full bg-black/15 dark:bg-white/20" />
          <AppText className="px-5 pb-2 font-gilroy-bold text-[18px] leading-[24px]">{title}</AppText>
          <ScrollView>
            {options.map((option) => (
              <PressableScale
                key={option.value || 'none'}
                onPress={() => {
                  haptics.selection();
                  onClose();
                  if (option.value !== value) onSelect(option.value);
                }}
                accessibilityLabel={option.label}
                className="flex-row items-center justify-between gap-3 px-5 py-3.5"
              >
                <AppText className="flex-1 font-gilroy-semibold text-[15px] leading-[20px]">{option.label}</AppText>
                {option.value === value ? <Check size={18} color={checkColor} /> : null}
              </PressableScale>
            ))}
          </ScrollView>
        </View>
        </SlideUp>
      </View>
    </Modal>
  );
}

export function SmallButton({
  label,
  onPress,
  primary,
  danger,
  icon: Icon,
  disabled,
  loading,
  compact,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  danger?: boolean;
  icon?: LucideIcon;
  disabled?: boolean;
  loading?: boolean;
  compact?: boolean;
}) {
  const spinner = useThemeColor(primary ? colors.white : colors.primary, primary ? colors.primary : colors.dark.text);
  const iconColor = danger ? colors.danger : spinner;
  return (
    <PressableScale
      onPress={() => {
        haptics.light();
        onPress();
      }}
      disabled={disabled || loading}
      accessibilityLabel={label}
      className={cn(
        'flex-row items-center justify-center gap-1.5 rounded-[10px] border',
        compact ? 'h-8 px-3' : 'h-9 px-3.5',
        primary
          ? 'border-transparent bg-primary dark:bg-white'
          : 'border-app-border bg-app-surface dark:border-dark-border dark:bg-dark-surface',
        (disabled || loading) && 'opacity-50',
      )}
    >
      {loading ? (
        <ActivityIndicator size="small" color={spinner} />
      ) : (
        <>
          {Icon ? <Icon size={15} color={iconColor} /> : null}
          <AppText
            numberOfLines={1}
            className={cn(
              'font-gilroy-semibold',
              compact ? 'text-[12px] leading-[16px]' : 'text-[13px] leading-[17px]',
              primary
                ? 'text-white dark:text-primary'
                : danger
                  ? 'text-danger dark:text-danger'
                  : 'text-primary dark:text-dark-text',
            )}
          >
            {label}
          </AppText>
        </>
      )}
    </PressableScale>
  );
}

export function Notice({ text, tone = 'warn' }: { text: string; tone?: 'warn' | 'error' }) {
  const warnColor = useThemeColor('#c2410c', TONE_COLORS.warn);
  const color = tone === 'warn' ? warnColor : TONE_COLORS.error;
  return (
    <View
      className="flex-row items-start gap-2 rounded-[10px] px-3 py-2.5"
      style={{ backgroundColor: tone === 'warn' ? 'rgba(249,115,22,0.1)' : 'rgba(216,54,54,0.1)' }}
    >
      <View className="mt-px">
        <TriangleAlert size={16} color={color} />
      </View>
      <AppText className="flex-1 font-gilroy-medium text-[13px] leading-[17px]" style={{ color }}>
        {text}
      </AppText>
    </View>
  );
}

export function ErrorText({ text }: { text?: string | null }) {
  if (!text) return null;
  return <AppText className="font-gilroy-medium text-[12px] leading-[16px] text-danger dark:text-danger">{text}</AppText>;
}

export function StaleNote({ show }: { show: boolean }) {
  const { t } = useTranslation();
  if (!show) return null;
  return <Notice text={t("Can't reach the server — showing the last known state.")} />;
}

export function StatusPill({ label, tone }: { label: string; tone: Tone }) {
  const color = TONE_COLORS[tone];
  return (
    <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: `${color}21` }}>
      <AppText numberOfLines={1} className="font-gilroy-semibold text-[11px] leading-[14px]" style={{ color }}>
        {label}
      </AppText>
    </View>
  );
}

export function Tag({ label }: { label: string }) {
  return (
    <View className="h-5 justify-center rounded-[6px] bg-black/[0.04] px-2 dark:bg-white/10">
      <AppText className="font-gilroy-semibold text-[11px] leading-[14px] text-primary/80 dark:text-dark-text/80">{label}</AppText>
    </View>
  );
}

export function Toggle({
  value,
  onChange,
  disabled,
  accessibilityLabel,
}: {
  value: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  accessibilityLabel: string;
}) {
  const trackOn = useThemeColor(colors.primary, colors.accent);
  const trackOff = useThemeColor('#d1d1d6', colors.dark.elevated);
  return (
    <Switch
      value={value}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      onValueChange={(next) => {
        haptics.selection();
        onChange(next);
      }}
      trackColor={{ true: trackOn, false: trackOff }}
      thumbColor={colors.white}
    />
  );
}

export function ToggleRow({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <AppText className="flex-1 font-gilroy-medium text-[14px] leading-[19px]">{label}</AppText>
      <Toggle value={value} onChange={onChange} disabled={disabled} accessibilityLabel={label} />
    </View>
  );
}

export function ChoiceRow<T extends string | null>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <View className={cn('flex-row flex-wrap gap-2', disabled && 'opacity-50')}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <PressableScale
            key={option.value ?? 'none'}
            disabled={disabled}
            onPress={() => {
              haptics.selection();
              onChange(option.value);
            }}
            accessibilityLabel={option.label}
            className={cn(
              'h-9 items-center justify-center rounded-full border px-4',
              active
                ? 'border-primary bg-primary dark:border-white dark:bg-white'
                : 'border-app-border bg-app-surface dark:border-dark-border dark:bg-white/10',
            )}
          >
            <AppText
              className={cn('font-gilroy-medium text-sm', active ? 'text-white dark:text-primary' : 'text-primary dark:text-dark-text')}
            >
              {option.label}
            </AppText>
          </PressableScale>
        );
      })}
    </View>
  );
}

export function LabelPreview({ uri, stale, label }: { uri: string; stale?: boolean; label: string }) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const portrait = size ? size.height > size.width : false;
  const ratio = size ? (portrait ? size.height / size.width : size.width / size.height) : 2;
  return (
    <View
      className={cn('w-full overflow-hidden rounded-[10px] border border-app-border bg-white dark:border-dark-border', stale && 'opacity-50')}
      style={{ aspectRatio: ratio }}
    >
      <Image
        source={{ uri }}
        accessibilityLabel={label}
        contentFit="contain"
        onLoad={(event) => setSize({ width: event.source.width, height: event.source.height })}
        style={
          portrait
            ? { width: `${100 / ratio}%`, height: `${ratio * 100}%`, position: 'absolute', top: 0, left: 0, transformOrigin: 'top left', transform: [{ rotate: '90deg' }, { translateY: '-100%' }] }
            : { width: '100%', height: '100%' }
        }
      />
    </View>
  );
}

export function PromptSheet({
  title,
  message,
  initialValue,
  inputLabel,
  confirmLabel,
  destructive,
  onConfirm,
  onClose,
}: {
  title: string;
  message?: string;
  initialValue?: string;
  inputLabel?: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: (value: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [value, setValue] = useState(initialValue ?? '');
  const hasInput = initialValue !== undefined;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <KeyboardPadding>
        <View className="flex-1 justify-end bg-black/40" style={{ paddingTop: insets.top + 8 }}>
          <Pressable className="flex-1" onPress={onClose} accessibilityLabel={t('Close')} />
          <SlideUp>
          <View className="max-h-full rounded-t-[20px] bg-app-bg pt-3 dark:bg-dark-bg">
            <View className="mb-4 gap-4 px-5">
              <View className="h-1 w-10 self-center rounded-full bg-black/15 dark:bg-white/20" />
              <AppText className="font-gilroy-bold text-[18px] leading-[24px]">{title}</AppText>
            </View>
            {message || hasInput ? (
              <KeyboardAwareScrollView
                bottomOffset={24}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                style={{ flexShrink: 1 }}
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12, gap: 16 }}
              >
                {message ? <AppText className="font-gilroy-medium text-[14px] text-muted">{message}</AppText> : null}
                {hasInput ? <GlassInput label={inputLabel} value={value} onChangeText={setValue} autoFocus /> : null}
              </KeyboardAwareScrollView>
            ) : null}
            <View className="flex-row gap-3 border-t border-app-border px-5 pt-3 dark:border-dark-border" style={{ paddingBottom: sheetBottomPad(insets.bottom) }}>
              <View className="flex-1">
                <GlassButton label={t('Cancel')} variant="secondary" onPress={onClose} />
              </View>
              <View className="flex-1">
                <GlassButton
                  label={confirmLabel}
                  variant={destructive ? 'danger' : 'primary'}
                  disabled={hasInput && !value.trim()}
                  onPress={() => {
                    onClose();
                    onConfirm(value.trim());
                  }}
                />
              </View>
            </View>
          </View>
          </SlideUp>
        </View>
      </KeyboardPadding>
    </Modal>
  );
}

export function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View className="gap-1">
      <AppText className="font-gilroy-semibold text-[18px] leading-[24px]">{title}</AppText>
      {subtitle ? <AppText className="font-gilroy-medium text-[14px] leading-[19px] text-muted">{subtitle}</AppText> : null}
    </View>
  );
}

export function FieldBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View className="gap-1.5">
      <AppText className="font-gilroy-medium text-[13px] leading-[17px] text-primary/70 dark:text-dark-text/70">{label}</AppText>
      {children}
    </View>
  );
}
