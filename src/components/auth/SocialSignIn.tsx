import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, PressableScale } from '@/components/ui';
import { AppleIcon, GoogleIcon } from '@/components/brand';
import { cn } from '@/lib/cn';
import { USE_MOCKS } from '@/lib/constants';
import { haptics } from '@/lib/haptics';
import {
  inExpoGo,
  isAppleAuthAvailable,
  signInWithApple,
  SocialAuthCancelled,
  type AppleSocialPayload,
} from '@/lib/social-auth';
import { useAuth } from '@/hooks/useAuth';
import { useGoogleSignIn } from '@/hooks/useGoogleSignIn';
import { useToast } from '@/hooks/useToast';

import { AppleEmailSheet } from './AppleEmailSheet';

type SocialProvider = 'google' | 'apple';

export interface SocialSignInProps {
  mode: 'login' | 'register';
  disabled?: boolean;
  onPendingChange?: (pending: boolean) => void;
  onSignedIn: () => void;
}

export function ProviderButton({
  label,
  onPress,
  loading,
  disabled,
  icon,
  tone,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon: ReactNode;
  tone: SocialProvider;
}) {
  const isApple = tone === 'apple';
  const isDisabled = loading || disabled;
  return (
    <PressableScale
      onPress={() => {
        if (isDisabled) return;
        haptics.light();
        onPress();
      }}
      disabled={isDisabled}
      accessibilityLabel={label}
      className={cn(
        'h-12 w-full flex-row items-center justify-center gap-2.5 rounded-[10px] border',
        isApple ? 'border-black bg-black' : 'border-app-border bg-white',
        isDisabled && 'opacity-70',
      )}
    >
      {loading ? (
        <ActivityIndicator color={isApple ? '#ffffff' : '#2b3a44'} />
      ) : (
        <>
          {icon}
          <AppText
            className={cn(
              'font-gilroy-semibold text-base',
              isApple ? 'text-white dark:text-white' : 'text-primary dark:text-primary',
            )}
          >
            {label}
          </AppText>
        </>
      )}
    </PressableScale>
  );
}

export function SocialSignIn({ mode, disabled, onPendingChange, onSignedIn }: SocialSignInProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const google = useGoogleSignIn();
  const { loginWithSocial } = useAuth();

  const [provider, setProvider] = useState<SocialProvider | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [applePending, setApplePending] = useState<AppleSocialPayload | null>(null);
  const [appleEmailLoading, setAppleEmailLoading] = useState(false);
  const [appleEmailError, setAppleEmailError] = useState('');

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
  const isLogin = mode === 'login';

  const startProvider = (next: SocialProvider | null) => {
    setProvider(next);
    onPendingChange?.(next !== null);
  };

  const succeed = (from: SocialProvider) => {
    haptics.success();
    toast(
      isLogin
        ? t('Login successful!')
        : from === 'google'
          ? t('Sign up with Google successful!')
          : t('Sign up with Apple successful!'),
      'success',
    );
    onSignedIn();
  };

  const onGoogle = async () => {
    if (!google.available) {
      toast(t("Google sign-in isn't available yet."), 'info');
      return;
    }
    startProvider('google');
    try {
      const result = await loginWithSocial(await google.signIn());
      if (result.ok) succeed('google');
      else toast(result.error || (isLogin ? t('Login failed') : t('Sign up failed. Please try again.')), 'error');
    } catch (error) {
      if (!(error instanceof SocialAuthCancelled)) toast(t('Google sign-in failed'), 'error');
    } finally {
      startProvider(null);
    }
  };

  const onApple = async () => {
    if (!appleReady) {
      toast(t("Apple sign-in isn't available yet."), 'info');
      return;
    }
    startProvider('apple');
    try {
      const payload = await signInWithApple();
      const result = await loginWithSocial(payload);
      if (result.ok) succeed('apple');
      else if (result.appleEmailRequired) {
        setAppleEmailError('');
        setApplePending(payload);
      } else toast(result.error || (isLogin ? t('Login failed') : t('Sign up failed. Please try again.')), 'error');
    } catch (error) {
      if (!(error instanceof SocialAuthCancelled)) toast(t('Apple sign-in failed'), 'error');
    } finally {
      startProvider(null);
    }
  };

  const submitAppleEmail = async (email: string) => {
    if (!applePending) return;
    setAppleEmailLoading(true);
    setAppleEmailError('');
    const result = await loginWithSocial({ ...applePending, user: { ...applePending.user, email } });
    setAppleEmailLoading(false);
    if (result.ok) {
      setApplePending(null);
      succeed('apple');
      return;
    }
    const message = result.error || (isLogin ? t('Login failed') : t('Sign up failed. Please try again.'));
    haptics.error();
    setAppleEmailError(message);
    toast(message, 'error');
  };

  const busy = disabled || provider !== null;

  return (
    <View className="gap-4">
      <View className="flex-row items-center gap-3 py-1">
        <View className="h-px flex-1 bg-app-border dark:bg-dark-border" />
        <AppText className="font-gilroy-medium text-[11px] uppercase tracking-[2px] text-muted">{t('or')}</AppText>
        <View className="h-px flex-1 bg-app-border dark:bg-dark-border" />
      </View>
      <View className="gap-3">
        <ProviderButton
          tone="google"
          label={isLogin ? t('Log In With Google') : t('Sign Up With Google')}
          onPress={() => void onGoogle()}
          loading={provider === 'google'}
          disabled={busy}
          icon={<GoogleIcon size={20} />}
        />
        <ProviderButton
          tone="apple"
          label={isLogin ? t('Log In With Apple') : t('Sign Up With Apple')}
          onPress={() => void onApple()}
          loading={provider === 'apple'}
          disabled={busy}
          icon={<AppleIcon size={20} color="#ffffff" />}
        />
      </View>
      {applePending ? (
        <AppleEmailSheet
          loading={appleEmailLoading}
          error={appleEmailError}
          onSubmit={(email) => void submitAppleEmail(email)}
          onCancel={() => {
            setApplePending(null);
            setAppleEmailError('');
          }}
        />
      ) : null}
    </View>
  );
}
