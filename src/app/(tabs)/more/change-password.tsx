import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, Lock } from 'lucide-react-native';

import { AppText, GlassButton, GlassHeader, GlassInput, PressableScale, Screen } from '@/components/ui';
import { useScreenPadding } from '@/hooks/useScreenPadding';
import { useToast } from '@/hooks/useToast';
import { extractApiError } from '@/lib/apiError';
import { haptics } from '@/lib/haptics';
import { navigate } from '@/lib/nav';
import { persistSession } from '@/lib/storage';
import { useChangePasswordMutation } from '@/store/api/authApi';
import { colors } from '@/theme/colors';

function VisibilityToggle({ visible, onToggle, label }: { visible: boolean; onToggle: () => void; label: string }) {
  return (
    <PressableScale onPress={onToggle} accessibilityLabel={label} className="h-8 w-8 items-center justify-center">
      {visible ? <EyeOff size={18} color={colors.muted} /> : <Eye size={18} color={colors.muted} />}
    </PressableScale>
  );
}

export default function ChangePasswordScreen() {
  const { t } = useTranslation();
  const padding = useScreenPadding();
  const toast = useToast();
  const [changePassword, { isLoading }] = useChangePasswordMutation();

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = useCallback(async () => {
    setError(null);
    if (!oldPassword || !newPassword || !confirmPassword) {
      setError(t('Please fill in all fields.'));
      return;
    }
    if (newPassword.length < 8) {
      setError(t('Password must be at least 8 characters.'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('Passwords do not match.'));
      return;
    }
    haptics.selection();
    try {
      const result = await changePassword({
        old_password: oldPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      }).unwrap();
      if (result.detail && !result.status && !result.access) {
        setError(result.detail);
        return;
      }
      if (result.access && result.refresh) {
        await persistSession({ accessToken: result.access, refreshToken: result.refresh });
      }
      toast(t('Password changed successfully.'), 'success');
      navigate.back();
    } catch (caught) {
      setError(extractApiError(caught) ?? t('Please try again.'));
    }
  }, [oldPassword, newPassword, confirmPassword, changePassword, toast, t]);

  return (
    <Screen edges={[]}>
      <GlassHeader title={t('Change Password')} onBack={navigate.back} />
      <KeyboardAwareScrollView
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: padding.top, paddingBottom: padding.bottom, paddingHorizontal: 16 }}
      >
        <View className="gap-4">
          <AppText className="font-gilroy-medium text-[14px] leading-[20px] text-muted dark:text-dark-muted">
            {t('Enter your current password and choose a new one.')}
          </AppText>

          <GlassInput
            label={t('Current password')}
            value={oldPassword}
            onChangeText={setOldPassword}
            secureTextEntry={!showOld}
            autoCapitalize="none"
            leftIcon={<Lock size={18} color={colors.muted} />}
            rightIcon={
              <VisibilityToggle
                visible={showOld}
                onToggle={() => setShowOld((v) => !v)}
                label={t('Current password')}
              />
            }
          />
          <GlassInput
            label={t('New password')}
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry={!showNew}
            autoCapitalize="none"
            leftIcon={<Lock size={18} color={colors.muted} />}
            rightIcon={
              <VisibilityToggle visible={showNew} onToggle={() => setShowNew((v) => !v)} label={t('New password')} />
            }
          />
          <GlassInput
            label={t('Confirm new password')}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!showNew}
            autoCapitalize="none"
            leftIcon={<Lock size={18} color={colors.muted} />}
            error={error ?? undefined}
          />

          <PressableScale
            onPress={() => {
              haptics.light();
              navigate.forgotPassword();
            }}
            accessibilityLabel={t('Forgot your password?')}
            className="self-end"
          >
            <AppText className="font-gilroy-semibold text-[14px] underline">{t('Forgot your password?')}</AppText>
          </PressableScale>

          <View className="mt-2">
            <GlassButton label={t('Change Password')} onPress={() => void onSubmit()} loading={isLoading} />
          </View>
        </View>
      </KeyboardAwareScrollView>
    </Screen>
  );
}
