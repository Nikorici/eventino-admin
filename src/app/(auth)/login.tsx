import { useState } from 'react';
import { View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Eye, EyeOff, Lock, Mail, User } from 'lucide-react-native';

import { cn } from '@/lib/cn';
import { extractApiError } from '@/lib/apiError';
import { haptics } from '@/lib/haptics';
import { navigate } from '@/lib/nav';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useResendOtpMutation, useSendOtpMutation } from '@/store/api/authApi';
import { AppText, GlassButton, GlassCard, GlassInput, PressableScale, Screen } from '@/components/ui';
import { Logo } from '@/components/brand';
import { OTP_LENGTH, OtpBoxes } from '@/components/auth/OtpBoxes';
import { SocialSignIn } from '@/components/auth/SocialSignIn';

type LoginStep = 'email' | 'otp' | 'password';

const MUTED = '#8a8d93';

function TextLink({
  label,
  onPress,
  tone = 'muted',
}: {
  label: string;
  onPress: () => void;
  tone?: 'muted' | 'strong';
}) {
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
      <AppText
        className={cn(
          'font-gilroy-semibold text-[13px]',
          tone === 'strong' ? 'text-primary dark:text-dark-text' : 'text-primary-light dark:text-dark-text/70',
        )}
      >
        {label}
      </AppText>
    </PressableScale>
  );
}

export default function LoginScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === 'dark';

  const { loginWithPassword, loginWithOtp } = useAuth();
  const toast = useToast();

  const [sendOtp, { isLoading: sendingOtp }] = useSendOtpMutation();
  const [resendOtp, { isLoading: resendingOtp }] = useResendOtpMutation();

  const [step, setStep] = useState<LoginStep>('email');
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState('');
  const [password, setPassword] = useState('');
  const [userExists, setUserExists] = useState(true);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [socialPending, setSocialPending] = useState(false);

  const busy = loading || sendingOtp || socialPending;
  const isNewAccount = !userExists;
  const canVerify = otpCode.length === OTP_LENGTH && (!isNewAccount || (firstName.trim().length > 0 && lastName.trim().length > 0));

  const goToStep = (next: LoginStep) => {
    setOtpCode('');
    setOtpError('');
    setPassword('');
    setShowPassword(false);
    setStep(next);
  };

  const onSignedIn = () => navigate.home();

  const onContinueWithEmail = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      toast(t('Please enter your email'), 'error');
      return;
    }
    try {
      const res = await sendOtp({ email: trimmed }).unwrap();
      const exists = res.user_exists ?? true;
      setUserExists(exists);
      setOtpCode('');
      setOtpError('');
      setFirstName('');
      setLastName('');
      setStep('otp');
      toast(
        exists ? t('Verification code sent to your email') : t('Account created! Verification code sent to your email'),
        'success',
      );
    } catch (error) {
      haptics.error();
      toast(extractApiError(error) ?? t('Could not send the code'), 'error');
    }
  };

  const onVerifyOtp = async () => {
    if (otpCode.length < OTP_LENGTH) {
      toast(t('Invalid code'), 'error');
      return;
    }
    if (isNewAccount && (!firstName.trim() || !lastName.trim())) {
      toast(t('Please enter your name'), 'error');
      return;
    }
    setLoading(true);
    setOtpError('');
    const r = await loginWithOtp(
      email.trim(),
      otpCode.trim(),
      isNewAccount ? { first_name: firstName.trim(), last_name: lastName.trim() } : undefined,
    );
    setLoading(false);
    if (r.ok) {
      haptics.success();
      toast(r.isNewAccount ? t('Account created successfully! Welcome!') : t('Login successful!'), 'success');
      onSignedIn();
    } else {
      const message = r.error || t('Invalid code');
      haptics.error();
      setOtpError(message);
      toast(message, 'error');
    }
  };

  const onResend = async () => {
    try {
      await resendOtp({ email: email.trim() }).unwrap();
      toast(t('Code sent'), 'success');
    } catch (error) {
      toast(extractApiError(error) ?? t('Could not send the code'), 'error');
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
      toast(t('Login successful!'), 'success');
      onSignedIn();
    } else {
      haptics.error();
      toast(t('Incorrect password, please try again'), 'error');
    }
  };

  const title = step === 'otp' ? t('Enter your code') : step === 'password' ? t('Welcome back') : t("Let's sign in");

  const subtitle =
    step === 'otp'
      ? `${t('We sent a 6-digit code to')} ${email.trim()}`
      : step === 'password'
        ? t('Welcome back, enter your password')
        : t('Welcome back. You’ve been missed');

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
                  <AppText className="text-center font-gilroy-medium text-[13px] leading-[19px] text-muted">
                    {t("Don't have an account? We'll create one for you automatically!")}
                  </AppText>
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
                  {isNewAccount ? (
                    <View className="gap-3.5">
                      <AppText className="font-gilroy-semibold text-[14px] text-primary dark:text-dark-text">
                        {t("You're creating a new account. Tell us your name:")}
                      </AppText>
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
                  <OtpBoxes
                    value={otpCode}
                    onChange={(next) => {
                      setOtpCode(next);
                      if (otpError) setOtpError('');
                    }}
                    editable={!loading}
                    autoFocus={!isNewAccount}
                    error={otpError}
                  />
                  <GlassButton label={t('Verify')} onPress={onVerifyOtp} loading={loading} disabled={busy || !canVerify} />
                  <View className="flex-row items-center justify-center gap-5">
                    <TextLink
                      label={t('Resend code')}
                      onPress={() => {
                        if (!resendingOtp) void onResend();
                      }}
                      tone="strong"
                    />
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
                        {showPassword ? <EyeOff size={18} color={MUTED} /> : <Eye size={18} color={MUTED} />}
                      </PressableScale>
                    }
                  />
                  <View className="flex-row justify-end">
                    <TextLink label={t('Forgot your password?')} onPress={navigate.forgotPassword} tone="strong" />
                  </View>
                  <GlassButton label={t('Log In')} onPress={onPasswordLogin} loading={loading} disabled={busy} />
                  <GlassButton
                    variant="secondary"
                    label={t('Use a code instead')}
                    onPress={() => goToStep('email')}
                    disabled={busy}
                  />
                </View>
              ) : null}

              {step !== 'otp' ? (
                <SocialSignIn mode="login" disabled={busy} onPendingChange={setSocialPending} onSignedIn={onSignedIn} />
              ) : null}
            </View>
          </GlassCard>

          {step !== 'otp' ? (
            <View className="mt-6 flex-row items-center justify-center gap-1.5">
              <AppText className="font-gilroy-medium text-[13px] text-muted">{t("Don't have an account?")}</AppText>
              <TextLink label={t('Sign Up')} onPress={navigate.register} tone="strong" />
            </View>
          ) : null}
        </View>
      </KeyboardAwareScrollView>
    </Screen>
  );
}
