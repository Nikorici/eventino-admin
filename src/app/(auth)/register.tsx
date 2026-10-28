import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  TextInput,
  View,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Building2, Check, Eye, EyeOff, Lock, Mail, MailCheck, User } from 'lucide-react-native';

import { cn } from '@/lib/cn';
import { navigate } from '@/lib/nav';
import { haptics } from '@/lib/haptics';
import { isAppleAuthAvailable, signInWithApple, SocialAuthCancelled } from '@/lib/social-auth';
import { useGoogleSignIn } from '@/hooks/useGoogleSignIn';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useRegisterMutation, useVerifyEmailMutation } from '@/store/api/authApi';
import {
  AppText,
  GlassButton,
  GlassCard,
  GlassHeader,
  GlassInput,
  PressableScale,
  Screen,
  SegmentedControl,
} from '@/components/ui';
import { AppleIcon, GoogleIcon, Logo } from '@/components/brand';

type AccountType = 'person' | 'organization';
type Step = 'form' | 'verify';
type SocialProvider = 'google' | 'apple';

const ICON_MUTED = '#8a8d93';
const ICON_ACCENT = '#15dd7d';

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

function CheckRow({
  checked,
  onToggle,
  children,
}: {
  checked: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const isDark = useColorScheme() === 'dark';
  return (
    <PressableScale
      onPress={() => {
        haptics.selection();
        onToggle();
      }}
      className="flex-row items-center gap-2.5"
    >
      <View
        className={cn(
          'h-5 w-5 items-center justify-center rounded-[6px] border',
          checked
            ? 'border-primary bg-primary dark:border-white dark:bg-white'
            : 'border-app-border bg-app-surface dark:border-dark-border dark:bg-dark-surface',
        )}
      >
        {checked ? <Check size={13} color={isDark ? '#2b3a44' : '#ffffff'} /> : null}
      </View>
      <View className="flex-1">{children}</View>
    </PressableScale>
  );
}

function extractFieldError(error: unknown): string | undefined {
  if (typeof error === 'object' && error && 'data' in error) {
    const data = (error as { data?: unknown }).data;
    if (typeof data === 'string') return data;
    if (typeof data === 'object' && data) {
      const record = data as Record<string, unknown>;
      if (typeof record.detail === 'string') return record.detail;
      if (typeof record.message === 'string') return record.message;
      const firstKey = Object.keys(record)[0];
      const value = firstKey ? record[firstKey] : undefined;
      if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
      if (typeof value === 'string') return value;
    }
  }
  return undefined;
}

export default function RegisterScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { loginWithPassword, loginWithSocial } = useAuth();
  const toast = useToast();
  const google = useGoogleSignIn();
  const [registerMutation, { isLoading: isRegistering }] = useRegisterMutation();
  const [verifyEmail, { isLoading: isVerifying }] = useVerifyEmailMutation();

  const [accountType, setAccountType] = useState<AccountType>('person');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [step, setStep] = useState<Step>('form');
  const [otpCode, setOtpCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
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

  const detailsValid =
    accountType === 'person'
      ? firstName.trim().length > 0 && lastName.trim().length > 0
      : organizationName.trim().length > 0;
  const canRegister =
    email.trim().length > 0 && password.length >= 6 && detailsValid && privacyAccepted && termsAccepted;
  const canVerify = otpCode.length === 6;
  const busy = isRegistering || finishing || socialProvider !== null;

  const handleRegister = async () => {
    if (!canRegister) {
      toast(t('Please fill in all fields'), 'error');
      return;
    }
    const formData = new FormData();
    formData.append('email', email.trim());
    formData.append('password', password);
    if (accountType === 'person') {
      formData.append('first_name', firstName.trim());
      formData.append('last_name', lastName.trim());
    } else {
      formData.append('organization_name', organizationName.trim());
      formData.append('is_organization', 'true');
    }
    try {
      haptics.medium();
      const res = await registerMutation(formData).unwrap();
      if (res?.status && res.status >= 400) {
        toast(res.message ?? t('Something went wrong'), 'error');
        return;
      }
      haptics.success();
      setStep('verify');
      toast(t('We sent a code to your email'), 'success');
    } catch (error) {
      toast(extractFieldError(error) ?? t('Something went wrong'), 'error');
    }
  };

  const handleVerify = async () => {
    if (!canVerify) {
      toast(t('Enter the 6-digit code'), 'error');
      return;
    }
    try {
      haptics.medium();
      await verifyEmail({ email: email.trim(), otp_code: otpCode }).unwrap();
      setFinishing(true);
      const result = await loginWithPassword(email.trim(), password);
      haptics.success();
      if (result.ok) navigate.home();
      else navigate.login();
    } catch (error) {
      setFinishing(false);
      toast(extractFieldError(error) ?? t('Invalid code'), 'error');
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
        toast(r.error || t('Something went wrong'), 'error');
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
        toast(r.error || t('Something went wrong'), 'error');
      }
    } catch (e) {
      if (!(e instanceof SocialAuthCancelled)) toast(t('Apple sign-in failed'), 'error');
    } finally {
      setSocialProvider(null);
    }
  };

  return (
    <Screen edges={[]}>
      <GlassHeader onBack={() => navigate.back()} transparent />
      <KeyboardAwareScrollView
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 72, paddingBottom: insets.bottom + 32 }}
      >
        <View className="gap-6 px-6">
          <View className="items-center gap-3">
            <Logo width={150} />
            <View className="items-center gap-1">
              <AppText className="text-center font-gilroy-bold text-[28px] leading-[34px] text-primary dark:text-dark-text">
                {step === 'form' ? t('Create account') : t('Verify your email')}
              </AppText>
              <AppText className="max-w-[320px] text-center font-gilroy-medium text-[15px] leading-[22px] text-muted">
                {step === 'form'
                  ? t('Join Eventino to discover and book events')
                  : t('We sent a code to your email')}
              </AppText>
            </View>
          </View>

          {step === 'form' ? (
            <GlassCard>
              <View className="gap-4 p-5">
                <SegmentedControl
                  value={accountType}
                  onChange={setAccountType}
                  options={[
                    { value: 'person', label: t('Person') },
                    { value: 'organization', label: t('Organization') },
                  ]}
                />

                <GlassInput
                  label={t('Email')}
                  value={email}
                  onChangeText={setEmail}
                  placeholder={t('Email')}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  leftIcon={<Mail size={18} color={ICON_MUTED} />}
                />

                <GlassInput
                  label={t('Password')}
                  value={password}
                  onChangeText={setPassword}
                  placeholder={t('Password')}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="newPassword"
                  leftIcon={<Lock size={18} color={ICON_MUTED} />}
                  rightIcon={
                    <PressableScale
                      onPress={() => {
                        haptics.selection();
                        setShowPassword((value) => !value);
                      }}
                      accessibilityLabel={showPassword ? t('Hide password') : t('Show password')}
                      hitSlop={8}
                    >
                      {showPassword ? (
                        <EyeOff size={18} color={ICON_MUTED} />
                      ) : (
                        <Eye size={18} color={ICON_MUTED} />
                      )}
                    </PressableScale>
                  }
                />

                {accountType === 'person' ? (
                  <View className="flex-row gap-3">
                    <GlassInput
                      containerClassName="flex-1"
                      label={t('First name')}
                      value={firstName}
                      onChangeText={setFirstName}
                      placeholder={t('First name')}
                      textContentType="givenName"
                      leftIcon={<User size={18} color={ICON_MUTED} />}
                    />
                    <GlassInput
                      containerClassName="flex-1"
                      label={t('Last name')}
                      value={lastName}
                      onChangeText={setLastName}
                      placeholder={t('Last name')}
                      textContentType="familyName"
                    />
                  </View>
                ) : (
                  <GlassInput
                    label={t('Organization name')}
                    value={organizationName}
                    onChangeText={setOrganizationName}
                    placeholder={t('Organization name')}
                    textContentType="organizationName"
                    leftIcon={<Building2 size={18} color={ICON_MUTED} />}
                  />
                )}

                <View className="gap-3 pt-1">
                  <CheckRow checked={privacyAccepted} onToggle={() => setPrivacyAccepted((v) => !v)}>
                    <AppText className="font-gilroy-medium text-[13px] leading-[19px] text-primary/70 dark:text-dark-text/70">
                      {t('I agree and accept')}{' '}
                      <AppText className="font-gilroy-semibold text-primary-light dark:text-accent">{t('Privacy Policy')}</AppText>
                    </AppText>
                  </CheckRow>
                  <CheckRow checked={termsAccepted} onToggle={() => setTermsAccepted((v) => !v)}>
                    <AppText className="font-gilroy-medium text-[13px] leading-[19px] text-primary/70 dark:text-dark-text/70">
                      {t('I agree and accept')}{' '}
                      <AppText className="font-gilroy-semibold text-primary-light dark:text-accent">{t('Terms of Use')}</AppText>
                    </AppText>
                  </CheckRow>
                </View>

                <GlassButton
                  label={t('Create account')}
                  onPress={handleRegister}
                  loading={isRegistering}
                  disabled={!canRegister || busy}
                  className="mt-1"
                />

                <Divider label={t('or')} />

                <View className="gap-3">
                  {google.available ? (
                    <ProviderButton
                      tone="google"
                      label={t('Sign Up With Google')}
                      onPress={onGoogle}
                      loading={socialProvider === 'google'}
                      disabled={busy}
                      icon={<GoogleIcon size={18} />}
                    />
                  ) : null}
                  {appleAvailable ? (
                    <ProviderButton
                      tone="apple"
                      label={t('Sign Up With Apple')}
                      onPress={onApple}
                      loading={socialProvider === 'apple'}
                      disabled={busy}
                      icon={<AppleIcon size={18} color="#ffffff" />}
                    />
                  ) : null}
                </View>
              </View>
            </GlassCard>
          ) : (
            <GlassCard>
              <View className="gap-5 p-5">
                <View className="items-center gap-3">
                  <View className="h-16 w-16 items-center justify-center rounded-full bg-accent/15">
                    <MailCheck size={28} color={ICON_ACCENT} />
                  </View>
                  <AppText className="font-gilroy-semibold text-base text-primary dark:text-dark-text">
                    {email}
                  </AppText>
                </View>

                <OtpBoxes value={otpCode} onChange={setOtpCode} editable={!busy} autoFocus />

                <GlassButton
                  label={t('Verify')}
                  onPress={handleVerify}
                  loading={isVerifying || finishing}
                  disabled={!canVerify || busy}
                />

                <PressableScale
                  onPress={() => {
                    haptics.selection();
                    setOtpCode('');
                    setStep('form');
                  }}
                  accessibilityLabel={t('Use a different email')}
                  className="items-center"
                  hitSlop={6}
                >
                  <AppText className="font-gilroy-semibold text-[13px] text-primary dark:text-dark-text">
                    {t('Use a different email')}
                  </AppText>
                </PressableScale>
              </View>
            </GlassCard>
          )}

          <View className="flex-row items-center justify-center gap-1.5">
            <AppText className="font-gilroy-medium text-[13px] text-muted">
              {t('Already have an account?')}
            </AppText>
            <PressableScale
              onPress={() => {
                haptics.selection();
                navigate.back();
              }}
              accessibilityLabel={t('Log In')}
              hitSlop={6}
            >
              <AppText className="font-gilroy-semibold text-[13px] text-primary dark:text-dark-text">
                {t('Log In')}
              </AppText>
            </PressableScale>
          </View>
        </View>
      </KeyboardAwareScrollView>
    </Screen>
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
