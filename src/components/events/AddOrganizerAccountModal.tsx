import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Mail, ShieldCheck, Tag, X } from 'lucide-react-native';

import { ProviderButton } from '@/components/auth/SocialSignIn';
import { AppleIcon, GoogleIcon } from '@/components/brand';
import { AppText, GlassButton, GlassInput, ToastHost } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useGoogleSignIn } from '@/hooks/useGoogleSignIn';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useToast } from '@/hooks/useToast';
import { extractClientErrorMessage } from '@/lib/apiError';
import { USE_MOCKS } from '@/lib/constants';
import { haptics } from '@/lib/haptics';
import { inExpoGo, isAppleAuthAvailable, signInWithApple, SocialAuthCancelled } from '@/lib/social-auth';
import { useSendOtpMutation } from '@/store/api/authApi';
import {
  useLinkAccountWithAppleMutation,
  useLinkAccountWithGoogleMutation,
  useLinkAccountWithOtpMutation,
} from '@/store/api/linkedAccountsApi';
import { colors } from '@/theme/colors';

type Provider = 'google' | 'apple';

export function AddOrganizerAccountModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const { user } = useAuth();
  const google = useGoogleSignIn();
  const iconColor = useThemeColor(colors.muted, colors.dark.textSecondary);
  const [mode, setMode] = useState<'choose' | 'otp'>('choose');
  const [provider, setProvider] = useState<Provider | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [codeError, setCodeError] = useState('');
  const [sendOtp, { isLoading: sending }] = useSendOtpMutation();
  const [linkWithOtp, { isLoading: linking }] = useLinkAccountWithOtpMutation();
  const [linkWithGoogle] = useLinkAccountWithGoogleMutation();
  const [linkWithApple] = useLinkAccountWithAppleMutation();

  useEffect(() => {
    let active = true;
    isAppleAuthAvailable()
      .then((available) => {
        if (active) setAppleAvailable(available);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const appleReady = USE_MOCKS || (appleAvailable && !inExpoGo);
  const busy = provider !== null;

  const changeEmail = () => {
    setCodeSent(false);
    setCode('');
    setCodeError('');
  };

  const close = () => {
    changeEmail();
    setMode('choose');
    setNickname('');
    setEmail('');
    setEmailError('');
    onClose();
  };

  const linked = () => {
    haptics.success();
    toast(t('Account linked successfully'), 'success');
    close();
  };

  const finishLink = async (request: Promise<unknown>) => {
    try {
      await request;
      linked();
    } catch (error) {
      toast(extractClientErrorMessage(error) ?? t('Failed to link account'), 'error');
    }
  };

  const onGoogle = async () => {
    if (!google.available) {
      toast(t("Google sign-in isn't available yet."), 'info');
      return;
    }
    setProvider('google');
    try {
      const { access_token } = await google.signIn();
      await finishLink(linkWithGoogle({ access_token, nickname: nickname.trim() }).unwrap());
    } catch (error) {
      if (!(error instanceof SocialAuthCancelled)) toast(t('Google sign-in failed'), 'error');
    } finally {
      setProvider(null);
    }
  };

  const onApple = async () => {
    if (!appleReady) {
      toast(t("Apple sign-in isn't available yet."), 'info');
      return;
    }
    setProvider('apple');
    try {
      const { identity_token, user: appleUser, platform } = await signInWithApple();
      await finishLink(linkWithApple({ identity_token, user: appleUser, platform, nickname: nickname.trim() }).unwrap());
    } catch (error) {
      if (!(error instanceof SocialAuthCancelled)) toast(t('Apple sign-in failed'), 'error');
    } finally {
      setProvider(null);
    }
  };

  const onSendCode = async () => {
    const trimmed = email.trim();
    setEmailError('');
    if (!trimmed) {
      setEmailError(t('Please enter your email'));
      return;
    }
    if (user?.email && trimmed.toLowerCase() === user.email.toLowerCase()) {
      setEmailError(t('This is your current account.'));
      return;
    }
    try {
      await sendOtp({ email: trimmed }).unwrap();
      setCodeSent(true);
      setCode('');
      toast(t('Code sent'), 'success');
    } catch (error) {
      setEmailError(extractClientErrorMessage(error) ?? t('Could not send the code'));
    }
  };

  const onLink = async () => {
    setCodeError('');
    try {
      await linkWithOtp({ email: email.trim(), otp_code: code, nickname: nickname.trim() }).unwrap();
      linked();
    } catch (error) {
      setCodeError(extractClientErrorMessage(error) ?? t('Invalid code'));
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <Pressable className="flex-1 justify-end bg-black/40" onPress={close}>
          <Pressable
            className="gap-4 rounded-t-[24px] bg-app-bg px-5 pb-10 pt-4 dark:bg-dark-bg"
            onPress={(event) => event.stopPropagation()}
          >
            <View className="flex-row items-start justify-between gap-3">
              <View className="flex-1 gap-1">
                <AppText className="font-gilroy-bold text-[20px]">{t('Link another organizer')}</AppText>
                <AppText className="font-gilroy-medium text-[13px] text-muted">
                  {t('Sign in with another organizer account to manage them from one place.')}
                </AppText>
              </View>
              <Pressable
                onPress={close}
                accessibilityLabel={t('Close')}
                className="h-9 w-9 items-center justify-center rounded-full bg-black/[0.04] dark:bg-white/10"
              >
                <X size={18} color={colors.muted} />
              </Pressable>
            </View>

            <GlassInput
              label={t('Nickname')}
              value={nickname}
              onChangeText={setNickname}
              placeholder={t('Optional label (e.g. Work, Agency)')}
              autoCorrect={false}
              leftIcon={<Tag size={18} color={iconColor} />}
            />

            {mode === 'choose' ? (
              <View className="gap-3">
                <ProviderButton
                  tone="google"
                  label={t('Continue with Google')}
                  onPress={() => void onGoogle()}
                  loading={provider === 'google'}
                  disabled={busy}
                  icon={<GoogleIcon size={20} />}
                />
                <ProviderButton
                  tone="apple"
                  label={t('Continue with Apple')}
                  onPress={() => void onApple()}
                  loading={provider === 'apple'}
                  disabled={busy}
                  icon={<AppleIcon size={20} color="#ffffff" />}
                />
                <GlassButton
                  variant="secondary"
                  label={t('Continue with email code')}
                  onPress={() => setMode('otp')}
                  disabled={busy}
                  icon={<Mail size={18} color={iconColor} />}
                />
              </View>
            ) : (
              <View className="gap-3">
                <GlassInput
                  label={t('Email')}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="name@domain.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  textContentType="emailAddress"
                  editable={!codeSent && !sending}
                  error={emailError || undefined}
                  onSubmitEditing={() => void onSendCode()}
                  leftIcon={<Mail size={18} color={iconColor} />}
                />

                {codeSent ? (
                  <>
                    <AppText className="font-gilroy-medium text-[13px] text-muted">
                      {`${t('We sent a 6-digit code to')} ${email.trim()}`}
                    </AppText>
                    <GlassInput
                      label={t('Verification code')}
                      value={code}
                      onChangeText={(next) => setCode(next.replace(/[^0-9]/g, '').slice(0, 6))}
                      placeholder="000000"
                      keyboardType="number-pad"
                      textContentType="oneTimeCode"
                      autoComplete="one-time-code"
                      maxLength={6}
                      editable={!linking}
                      error={codeError || undefined}
                      onSubmitEditing={() => void onLink()}
                      leftIcon={<ShieldCheck size={18} color={iconColor} />}
                    />
                    <GlassButton
                      label={t('Link account')}
                      onPress={() => void onLink()}
                      loading={linking}
                      disabled={linking || code.length !== 6}
                    />
                    <GlassButton variant="secondary" label={t('Change email')} onPress={changeEmail} disabled={linking} />
                  </>
                ) : (
                  <GlassButton label={t('Send code')} onPress={() => void onSendCode()} loading={sending} disabled={sending} />
                )}

                <GlassButton variant="ghost" label={t('Back')} onPress={() => setMode('choose')} disabled={sending || linking} />
              </View>
            )}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
      <ToastHost />
    </Modal>
  );
}
