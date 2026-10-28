import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, PressableScale } from '@/components/ui';
import { cn } from '@/lib/cn';
import { haptics } from '@/lib/haptics';

export const RESEND_COOLDOWN_SECONDS = 15;

export function ResendCode({ onResend }: { onResend: () => Promise<unknown> }) {
  const { t } = useTranslation();
  const [secondsLeft, setSecondsLeft] = useState(RESEND_COOLDOWN_SECONDS);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const waiting = secondsLeft > 0 || sending;

  return (
    <View className="flex-row items-center justify-center gap-1.5">
      <AppText className="font-gilroy-medium text-[13px] text-muted">{t('Did not get the code?')}</AppText>
      <PressableScale
        onPress={async () => {
          if (waiting) return;
          haptics.selection();
          setSending(true);
          await onResend();
          setSending(false);
          setSecondsLeft(RESEND_COOLDOWN_SECONDS);
        }}
        disabled={waiting}
        accessibilityLabel={t('Resend code')}
        hitSlop={8}
      >
        <AppText
          className={cn('font-gilroy-bold text-[13px] text-primary dark:text-dark-text', waiting && 'opacity-50')}
        >
          {t('Resend code')}
          {secondsLeft > 0 ? ` (${String(secondsLeft).padStart(2, '0')})` : ''}
        </AppText>
      </PressableScale>
    </View>
  );
}
