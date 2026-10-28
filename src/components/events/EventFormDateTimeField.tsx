import { useState, type ReactNode } from 'react';
import { Modal, Platform, Pressable, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { format, isValid, parse } from 'date-fns';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/cn';
import { haptics } from '@/lib/haptics';
import { colors } from '@/theme/colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppText, PressableScale } from '@/components/ui';

const DATE_STORE = 'yyyy-MM-dd';
const TIME_STORE = 'HH:mm';
const DATE_DISPLAY = 'd MMM yyyy';

export interface EventFormDateTimeFieldProps {
  value: string;
  mode: 'date' | 'time';
  onChange: (value: string) => void;
  placeholder: string;
  icon?: ReactNode;
  containerClassName?: string;
  maximumDate?: Date;
}

function parseValue(value: string, mode: 'date' | 'time'): Date {
  if (value) {
    const parsed = parse(value, mode === 'date' ? DATE_STORE : TIME_STORE, new Date());
    if (isValid(parsed)) return parsed;
  }
  return new Date();
}

export function EventFormDateTimeField({ value, mode, onChange, placeholder, icon, containerClassName, maximumDate }: EventFormDateTimeFieldProps) {
  const { t } = useTranslation();
  const isDark = useColorScheme() === 'dark';
  const [open, setOpen] = useState(false);
  const [temp, setTemp] = useState<Date>(() => parseValue(value, mode));

  const storeFormat = mode === 'date' ? DATE_STORE : TIME_STORE;
  const display = value ? (mode === 'date' ? format(parseValue(value, mode), DATE_DISPLAY) : value) : '';

  const openPicker = () => {
    haptics.selection();
    setTemp(parseValue(value, mode));
    setOpen(true);
  };

  const handleChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') {
      setOpen(false);
      if (event.type === 'set' && date) onChange(format(date, storeFormat));
      return;
    }
    if (date) setTemp(date);
  };

  const confirm = () => {
    onChange(format(temp, storeFormat));
    setOpen(false);
  };

  return (
    <>
      <View className={containerClassName}>
        <PressableScale
          onPress={openPicker}
          accessibilityLabel={placeholder}
          className="h-11 w-full flex-row items-center gap-2 rounded-[8px] bg-black/[0.04] px-3 dark:bg-white/[0.06]"
        >
          {icon}
          <AppText
            numberOfLines={1}
            className={cn('flex-1 font-gilroy-medium text-[15px]', display ? 'text-primary dark:text-dark-text' : 'text-muted dark:text-dark-muted')}
          >
            {display || placeholder}
          </AppText>
        </PressableScale>
      </View>

      {Platform.OS === 'android' && open ? (
        <DateTimePicker value={temp} mode={mode} is24Hour maximumDate={maximumDate} onChange={handleChange} />
      ) : null}

      {Platform.OS === 'ios' ? (
        <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
          <Pressable onPress={() => setOpen(false)} className="flex-1 justify-end bg-black/40">
            <Pressable onPress={(event) => event.stopPropagation()} className="rounded-t-[20px] bg-app-bg pb-8 pt-3 dark:bg-dark-surface">
              <View className="mb-1 flex-row items-center justify-between px-5">
                <PressableScale onPress={() => setOpen(false)} accessibilityLabel={t('Cancel')}>
                  <AppText className="font-gilroy-medium text-[15px] text-muted dark:text-dark-muted">{t('Cancel')}</AppText>
                </PressableScale>
                <PressableScale onPress={confirm} accessibilityLabel={t('Done')}>
                  <AppText className="font-gilroy-semibold text-[15px] text-links dark:text-dark-text">{t('Done')}</AppText>
                </PressableScale>
              </View>
              <DateTimePicker
                value={temp}
                mode={mode}
                display="spinner"
                is24Hour
                maximumDate={maximumDate}
                themeVariant={isDark ? 'dark' : 'light'}
                textColor={isDark ? colors.dark.text : colors.primary}
                onChange={handleChange}
                style={{ alignSelf: 'stretch' }}
              />
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </>
  );
}
