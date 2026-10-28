import { View, TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui';
import { cn } from '@/lib/cn';

export const OTP_LENGTH = 6;

export interface OtpBoxesProps {
  value: string;
  onChange: (next: string) => void;
  onComplete?: (code: string) => void;
  editable?: boolean;
  autoFocus?: boolean;
  error?: string;
}

export function OtpBoxes({ value, onChange, onComplete, editable = true, autoFocus, error }: OtpBoxesProps) {
  const { t } = useTranslation();
  return (
    <View className="gap-2">
      <View className="relative">
        <View className="flex-row gap-2">
          {Array.from({ length: OTP_LENGTH }).map((_, index) => (
            <View
              key={index}
              className={cn(
                'h-[50px] flex-1 items-center justify-center rounded-[8px] border bg-app-surface dark:bg-dark-surface',
                error
                  ? 'border-danger'
                  : index === value.length
                    ? 'border-primary dark:border-white'
                    : 'border-app-border dark:border-dark-border',
              )}
            >
              <AppText className="font-gilroy-semibold text-[20px] text-primary dark:text-dark-text">
                {value[index] ?? ''}
              </AppText>
            </View>
          ))}
        </View>
        <TextInput
          value={value}
          onChangeText={(next) => {
            const cleaned = next.replace(/[^0-9]/g, '').slice(0, OTP_LENGTH);
            onChange(cleaned);
            if (cleaned.length === OTP_LENGTH && cleaned !== value) onComplete?.(cleaned);
          }}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={OTP_LENGTH}
          editable={editable}
          autoFocus={autoFocus}
          caretHidden
          accessibilityLabel={t('Verification code')}
          className="absolute inset-0 opacity-0"
        />
      </View>
      {error ? (
        <AppText className="text-center font-gilroy-medium text-xs text-danger dark:text-danger">{error}</AppText>
      ) : null}
    </View>
  );
}
