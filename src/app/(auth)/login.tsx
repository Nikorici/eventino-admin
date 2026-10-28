import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  TextInput,
  View,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Eye, EyeOff, Lock, Mail, User } from 'lucide-react-native';

import { cn } from '@/lib/cn';
import { haptics } from '@/lib/haptics';
import { navigate } from '@/lib/nav';
import { isAppleAuthAvailable, signInWithApple, SocialAuthCancelled } from '@/lib/social-auth';
import { useGoogleSignIn } from '@/hooks/useGoogleSignIn';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useResendOtpMutation, useSendOtpMutation } from '@/store/api/authApi';
import {
  AppText,
  GlassButton,
  GlassCard,
  GlassInput,
  PressableScale,
  Screen,
} from '@/components/ui';
import { AppleIcon, GoogleIcon, Logo } from '@/components/brand';

type LoginStep = 'email' | 'otp' | 'password';
type SocialProvider = 'google' | 'apple';

const MUTED = '#8a8d93';

function OtpBoxes({
  value,
  onChange,
  editable = true,
  autoFocus,
}: {
  value: string;
  onChange: (next: string) => void;
  editable?: boolean;
  autoFocus?: boolean;
}) {
  const inputRef = useRef<TextInput>(null);
  return (
    <View className="relative">
      <View className="flex-row gap-2">
        {Array.from({ length: 6 }).map((_, index) => {
          const char = value[index] ?? '';
          const focused = index === value.length;
          return (
            <View
              key={index}
              className={cn(
                'h-[50px] flex-1 items-center justify-center rounded-[8px] border bg-app-surface dark:bg-dark-surface',
                focused ? 'border-primary dark:border-white' : 'border-app-border dark:border-dark-border',
              )}
            >
              <AppText className="font-gilroy-semibold text-[20px] text-primary dark:text-dark-text">
                {char}
              </AppText>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(next) => onChange(next.replace(/[^0-9]/g, '').slice(0, 6))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={6}
        editable={editable}
        autoFocus={autoFocus}
        caretHidden
        accessibilityLabel="Verification code"
        className="absolute inset-0 opacity-0"
      />
    </View>
  );
}

function ProviderButton({
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
  tone: 'google' | 'apple';
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

function TextLink({
  label,
  onPress,
  tone = 'muted',
}: {
  label: string;
  onPress: () => void;
  tone?: 'muted' | 'accent' | 'strong';
}) {
  const toneClass =
    tone === 'accent'
      ? 'text-accent'
      : tone === 'strong'
        ? 'text-primary dark:text-dark-text'
        : 'text-primary-light dark:text-dark-text/70';
  return (
    <PressableScale
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      accessibilityLabel={label}
      hitSlop={8}
      className="self-center py-1.5"
    >
      <AppText className={cn('font-gilroy-semibold text-[13px]', toneClass)}>{label}</AppText>
    </PressableScale>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <View className="flex-row items-center gap-3 py-1">
      <View className="h-px flex-1 bg-app-border dark:bg-dark-border" />
      <AppText className="font-gilroy-medium text-[11px] uppercase tracking-[2px] text-muted">{label}</AppText>
      <View className="h-px flex-1 bg-app-border dark:bg-dark-border" />
    </View>
  );
}

export default function LoginScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  const { loginWithPassword, loginWithOtp, loginWithSocial } = useAuth();
  const toast = useToast();
  const google = useGoogleSignIn();

  const [sendOtp, { isLoading: sendingOtp }] = useSendOtpMutation();
  const [resendOtp] = useResendOtpMutation();

  const [step, setStep] = useState<LoginStep>('email');
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [password, setPassword] = useState('');
  const [userExists, setUserExists] = useState(true);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [socialProvider, setSocialProvider] = useState<SocialProvider | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);

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

  const busy = loading || sendingOtp || socialProvider !== null;

  const goToStep = (next: LoginStep) => {
    setOtpCode('');
    setPassword('');
    setShowPassword(false);
    setStep(next);
  };

  const onContinueWithEmail = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      toast(t('Please enter your email'), 'error');
      return;
    }
    try {
      const res = await sendOtp({ email: trimmed }).unwrap();
      setUserExists(res.user_exists ?? true);
      setOtpCode('');
      setStep('otp');
    } catch {
      toast(t('Could not send the code'), 'error');
    }
  };

  const onVerifyOtp = async () => {
    if (otpCode.length < 6) {
      toast(t('Invalid code'), 'error');
      return;
    }
    if (userExists === false && (!firstName.trim() || !lastName.trim())) {
      toast(t('Please enter your name'), 'error');
      return;
    }
    setLoading(true);
    const r = await loginWithOtp(
      email.trim(),
      otpCode.trim(),
      userExists === false ? { first_name: firstName.trim(), last_name: lastName.trim() } : undefined,
    );
    setLoading(false);
    if (r.ok) {
      haptics.success();
      navigate.home();
    } else {
      toast(r.error || t('Invalid code'), 'error');
    }
  };

  const onResend = async () => {
    haptics.selection();
    try {
      await resendOtp({ email: email.trim() }).unwrap();
      toast(t('Code sent'), 'success');
    } catch {
      toast(t('Could not send the code'), 'error');
    }
  };

  const onPasswordLogin = async () => {
    if (!email.trim()) {
      toast(t('Please enter your email'), 'error');
      return;
    }
    if (!password) {
      toast(t('Please enter your password'), 'error');
      return;
    }
    setLoading(true);
    const r = await loginWithPassword(email.trim(), password);
    setLoading(false);
    if (r.ok) {
      haptics.success();
      navigate.home();
    } else {
      toast(r.error || t('Wrong password'), 'error');
    }
  };

  const onGoogle = async () => {
    try {
      setSocialProvider('google');
      if (!google.available) {
        toast(t('Google sign-in failed'), 'error');
        return;
      }
      const payload = await google.signIn();
      const r = await loginWithSocial(payload);
      if (r.ok) {
        haptics.success();
        navigate.home();
      } else {
        toast(r.error || t('Login failed'), 'error');
      }
    } catch (e) {
      if (!(e instanceof SocialAuthCancelled)) toast(t('Google sign-in failed'), 'error');
    } finally {
      setSocialProvider(null);
    }
  };

  const onApple = async () => {
    try {
      setSocialProvider('apple');
      const payload = await signInWithApple();
      const r = await loginWithSocial(payload);
      if (r.ok) {
        haptics.success();
        navigate.home();
      } else if (r.appleEmailRequired) {
        toast(t('Please provide your email'), 'error');
      } else {
        toast(r.error || t('Login failed'), 'error');
      }
    } catch (e) {
      if (!(e instanceof SocialAuthCancelled)) toast(t('Apple sign-in failed'), 'error');
    } finally {
      setSocialProvider(null);
    }
  };

  const title =
    step === 'otp'
      ? t('Enter your code')
      : step === 'password'
        ? t('Welcome back')
        : t("Let's sign in");

  const subtitle =
    step === 'otp'
      ? `${t('We sent a 6-digit code to')} ${email.trim()}`
      : step === 'password'
        ? t('Welcome back, enter your password')
        : t('Log in or create an account to get your tickets');

  return (
    <Screen edges={[]}>
      <KeyboardAwareScrollView
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          paddingTop: insets.top + 72,
          paddingBottom: insets.bottom + 28,
        }}
      >
        <View className="px-6">
          <View className="mb-7 items-center gap-3">
            <Logo width={150} />
            <View className="items-center gap-1">
              <AppText className="text-center font-gilroy-bold text-[28px] leading-[34px] text-primary dark:text-dark-text">
                {title}
              </AppText>
              <AppText
                numberOfLines={2}
                className="max-w-[320px] text-center font-gilroy-medium text-[15px] leading-[22px] text-muted"
              >
                {subtitle}
              </AppText>
            </View>
          </View>

          <GlassCard>
            <View className="gap-4 p-5">
              {step === 'email' ? (
                <View className="gap-3.5">
                  <GlassInput
                    label={t('Email')}
                    value={email}
                    onChangeText={setEmail}
                    placeholder={t('you@email.com')}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    textContentType="emailAddress"
                    returnKeyType="next"
                    editable={!busy}
                    onSubmitEditing={onContinueWithEmail}
                    leftIcon={<Mail size={18} color={MUTED} />}
                  />
                  <GlassButton
                    label={t('Continue with email')}
                    onPress={onContinueWithEmail}
                    loading={sendingOtp}
                    disabled={busy}
                    icon={<ArrowRight size={18} color={isDark ? '#2b3a44' : '#ffffff'} />}
                  />
                  <GlassButton
                    variant="secondary"
                    label={t('Use password instead')}
                    onPress={() => goToStep('password')}
                    disabled={busy}
                  />
                </View>
              ) : null}

              {step === 'otp' ? (
                <View className="gap-4">
                  <OtpBoxes value={otpCode} onChange={setOtpCode} editable={!loading} autoFocus />
                  {userExists === false ? (
                    <View className="gap-3.5">
                      <GlassInput
                        label={t('First name')}
                        value={firstName}
                        onChangeText={setFirstName}
                        placeholder={t('First name')}
                        autoCapitalize="words"
                        autoComplete="name-given"
                        textContentType="givenName"
                        editable={!loading}
                        leftIcon={<User size={18} color={MUTED} />}
                      />
                      <GlassInput
                        label={t('Last name')}
                        value={lastName}
                        onChangeText={setLastName}
                        placeholder={t('Last name')}
                        autoCapitalize="words"
                        autoComplete="name-family"
                        textContentType="familyName"
                        editable={!loading}
                        leftIcon={<User size={18} color={MUTED} />}
                      />
                    </View>
                  ) : null}
                  <GlassButton
                    label={t('Verify')}
                    onPress={onVerifyOtp}
                    loading={loading}
                    disabled={busy}
                  />
                  <View className="flex-row items-center justify-center gap-5">
                    <TextLink label={t('Resend code')} onPress={onResend} tone="strong" />
                    <View className="h-3 w-px bg-app-border dark:bg-dark-border" />
                    <TextLink label={t('Use a different email')} onPress={() => goToStep('email')} />
                  </View>
                </View>
              ) : null}

              {step === 'password' ? (
                <View className="gap-3.5">
                  <GlassInput
                    label={t('Email')}
                    value={email}
                    onChangeText={setEmail}
                    placeholder={t('you@email.com')}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    textContentType="emailAddress"
                    returnKeyType="next"
                    editable={!loading}
                    leftIcon={<Mail size={18} color={MUTED} />}
                  />
                  <GlassInput
                    label={t('Password')}
                    value={password}
                    onChangeText={setPassword}
                    placeholder={t('Your password')}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoComplete="current-password"
                    textContentType="password"
                    editable={!loading}
                    returnKeyType="go"
                    onSubmitEditing={onPasswordLogin}
                    leftIcon={<Lock size={18} color={MUTED} />}
                    rightIcon={
                      <PressableScale
                        onPress={() => {
                          haptics.selection();
                          setShowPassword((prev) => !prev);
                        }}
                        accessibilityLabel={showPassword ? t('Hide password') : t('Show password')}
                        hitSlop={8}
                      >
                        {showPassword ? (
                          <EyeOff size={18} color={MUTED} />
                        ) : (
                          <Eye size={18} color={MUTED} />
                        )}
                      </PressableScale>
                    }
                  />
                  <View className="flex-row justify-end">
                    <TextLink
                      label={t('Forgot your password?')}
                      onPress={navigate.forgotPassword}
                      tone="strong"
                    />
                  </View>
                  <GlassButton
                    label={t('Log In')}
                    onPress={onPasswordLogin}
                    loading={loading}
                    disabled={busy}
                  />
                  <GlassButton
                    variant="secondary"
                    label={t('Use a code instead')}
                    onPress={() => goToStep('email')}
                    disabled={busy}
                  />
                </View>
              ) : null}

              {step !== 'otp' ? (
                <>
                  <Divider label={t('or')} />
                  <View className="gap-3">
                    {google.available ? (
                      <ProviderButton
                        tone="google"
                        label={t('Log In With Google')}
                        onPress={onGoogle}
                        loading={socialProvider === 'google'}
                        disabled={busy}
                        icon={<GoogleIcon size={20} />}
                      />
                    ) : null}
                    {appleAvailable ? (
                      <ProviderButton
                        tone="apple"
                        label={t('Log In With Apple')}
                        onPress={onApple}
                        loading={socialProvider === 'apple'}
                        disabled={busy}
                        icon={<AppleIcon size={20} color="#ffffff" />}
                      />
                    ) : null}
                  </View>
                </>
              ) : null}
            </View>
          </GlassCard>

          {step !== 'otp' ? (
            <View className="mt-6 flex-row items-center justify-center gap-1.5">
              <AppText className="font-gilroy-medium text-[13px] text-muted">
                {t("Don't have an account?")}
              </AppText>
              <TextLink label={t('Sign Up')} onPress={navigate.register} tone="strong" />
            </View>
          ) : null}
        </View>
      </KeyboardAwareScrollView>
    </Screen>
  );
}
