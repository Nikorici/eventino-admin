import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Mail } from 'lucide-react-native';

import { AppText, GlassButton, GlassInput, KeyboardPadding, ToastHost } from '@/components/ui';
import { AppleIcon } from '@/components/brand';
import { colors } from '@/theme/colors';
import { useThemeColor } from '@/hooks/useThemeColor';
import { sheetBottomPad } from '@/hooks/useScreenPadding';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface AppleEmailSheetProps {
  loading: boolean;
  error: string;
  onSubmit: (email: string) => void;
  onCancel: () => void;
}

export function AppleEmailSheet({ loading, error, onSubmit, onCancel }: AppleEmailSheetProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const iconColor = useThemeColor(colors.primary, colors.white);
  const [email, setEmail] = useState('');
  const [validationError, setValidationError] = useState('');
  const [showServerError, setShowServerError] = useState(true);

  const submit = () => {
    const value = email.trim();
    if (!value) {
      setValidationError(t('Please enter your email'));
      return;
    }
    if (!EMAIL_PATTERN.test(value)) {
      setValidationError(t('Please enter a valid email address'));
      return;
    }
    setValidationError('');
    setShowServerError(true);
    onSubmit(value);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={loading ? undefined : onCancel} statusBarTranslucent navigationBarTranslucent>
      <KeyboardPadding>
        <View className="flex-1 justify-end bg-black/40" style={{ paddingTop: insets.top + 8 }}>
          <Pressable className="flex-1" onPress={loading ? undefined : onCancel} accessibilityLabel={t('Close')} />
          <View className="max-h-full rounded-t-[24px] bg-app-bg pt-5 dark:bg-dark-bg">
            <View className="mb-4 flex-row items-center gap-2.5 px-5">
              <View className="h-9 w-9 items-center justify-center rounded-full bg-black/[0.05] dark:bg-white/10">
                <AppleIcon size={18} color={iconColor} />
              </View>
              <AppText className="font-gilroy-bold text-[20px]">{t('Your email')}</AppText>
            </View>
            <KeyboardAwareScrollView
              bottomOffset={24}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              style={{ flexShrink: 1 }}
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12, gap: 16 }}
            >
              <AppText className="font-gilroy-medium text-[14px] leading-[20px] text-muted">
                {t(
                  "Apple didn't share an email for this sign-in. Please enter the email where you want to receive your tickets and order confirmations.",
                )}
              </AppText>
              <GlassInput
                value={email}
                onChangeText={(next) => {
                  setEmail(next);
                  setShowServerError(false);
                  if (validationError) setValidationError('');
                }}
                placeholder={t('you@email.com')}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                autoFocus
                editable={!loading}
                returnKeyType="go"
                onSubmitEditing={submit}
                error={validationError || (showServerError ? error : '') || undefined}
                leftIcon={<Mail size={18} color={colors.muted} />}
              />
            </KeyboardAwareScrollView>
            <View className="flex-row gap-3 border-t border-app-border px-5 pt-3 dark:border-dark-border" style={{ paddingBottom: sheetBottomPad(insets.bottom) }}>
              <View className="flex-1">
                <GlassButton variant="secondary" label={t('Cancel')} onPress={onCancel} disabled={loading} />
              </View>
              <View className="flex-1">
                <GlassButton label={t('Continue')} onPress={submit} loading={loading} disabled={loading} />
              </View>
            </View>
          </View>
        </View>
      </KeyboardPadding>
      <ToastHost />
    </Modal>
  );
}
