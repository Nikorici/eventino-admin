import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react-native';

import { cn } from '@/lib/cn';
import { GEOAPIFY_API_KEY, USE_MOCKS } from '@/lib/constants';
import { extractApiError } from '@/lib/apiError';
import { haptics } from '@/lib/haptics';
import { navigate } from '@/lib/nav';
import { colors } from '@/theme/colors';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import {
  useResendResetCodeMutation,
  useResetPasswordMutation,
  useSendResetCodeMutation,
  useVerifyResetCodeMutation,
  type VerificationResponse,
} from '@/store/api/authApi';
import { AppText, GlassButton, GlassCard, GlassHeader, GlassInput, PressableScale, Screen } from '@/components/ui';
import { Logo } from '@/components/brand';
import { OTP_LENGTH, OtpBoxes } from '@/components/auth/OtpBoxes';
import { ResendCode } from '@/components/auth/ResendCode';

type ResetStep = 'email' | 'otp' | 'password';

const STEP_ORDER: ResetStep[] = ['email', 'otp', 'password'];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

function responseMessage(response: VerificationResponse): string | undefined {
  const detail = typeof response.data === 'string' ? response.data : undefined;
  return [response.message, detail].filter(Boolean).join(': ') || undefined;
}

function backendErrors(error: unknown): string[] {
  if (typeof error !== 'object' || error === null || !('data' in error)) return [];
  const data: unknown = error.data;
  if (typeof data !== 'object' || data === null) return [];
  const fields: unknown[] = [
    'new_password' in data ? data.new_password : undefined,
    'confirm_password' in data ? data.confirm_password : undefined,
  ];
  return fields.flatMap((value) =>
    Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [],
  );
}

function useRequestLocation(): string {
  const [location, setLocation] = useState('');
  useEffect(() => {
    if (USE_MOCKS || !GEOAPIFY_API_KEY) return;
    let active = true;
    fetch(`https://api.geoapify.com/v1/ipinfo?&apiKey=${GEOAPIFY_API_KEY}`)
      .then((response) => response.json())
      .then((result: { country?: { name?: string }; city?: { name?: string } }) => {
        if (active) setLocation(`${result.country?.name ?? ''}, ${result.city?.name ?? ''}`);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);
  return location;
}

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { loginWithPassword } = useAuth();
  const location = useRequestLocation();

  const [sendResetCode, { isLoading: isSending }] = useSendResetCodeMutation();
  const [resendResetCode] = useResendResetCodeMutation();
  const [verifyResetCode, { isLoading: isVerifying }] = useVerifyResetCodeMutation();
  const [resetPassword, { isLoading: isResetting }] = useResetPasswordMutation();

  const [step, setStep] = useState<ResetStep>('email');
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newPasswordError, setNewPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  const activeIndex = STEP_ORDER.indexOf(step);

  const heroTitle =
    step === 'email' ? t('Reset your password') : step === 'otp' ? t('Check your inbox') : t('Create a new password');
  const heroSubtitle =
    step === 'email'
      ? t('Enter your email and we will send you a reset code.')
      : step === 'otp'
        ? t('We sent a 6-digit verification code to your email.')
        : t('Choose a new password to secure your account.');

  const resetMeta = () => ({ email, device: Platform.OS, location, date: new Date().toISOString() });

  const handleSendCode = async () => {
    const value = email.trim();
    if (!EMAIL_PATTERN.test(value)) {
      toast(t('Please enter a valid email address'), 'error');
      return;
    }
    try {
      setEmail(value);
      const res = await sendResetCode({ ...resetMeta(), email: value }).unwrap();
      if (res.status !== 200 && res.status !== 201) {
        haptics.error();
        toast(responseMessage(res) ?? t('Something went wrong'), 'error');
        return;
      }
      haptics.success();
      setOtpCode('');
      setOtpError('');
      setStep('otp');
    } catch (error) {
      haptics.error();
      toast(extractApiError(error) ?? t('Something went wrong'), 'error');
    }
  };

  const handleResend = async () => {
    try {
      const res = await resendResetCode(resetMeta()).unwrap();
      if (res.status !== 200) {
        toast(responseMessage(res) ?? t('Something went wrong'), 'error');
        return;
      }
      haptics.success();
      toast(t('Code sent'), 'success');
    } catch (error) {
      toast(extractApiError(error) ?? t('Something went wrong'), 'error');
    }
  };

  const handleVerify = async (code: string = otpCode) => {
    if (code.length < OTP_LENGTH) {
      toast(t('Invalid code'), 'error');
      return;
    }
    setOtpError('');
    try {
      const res = await verifyResetCode({ email, otp_code: code }).unwrap();
      if (res.status === 200 && res.reset_token) {
        setResetToken(res.reset_token);
        haptics.success();
        setStep('password');
        return;
      }
      haptics.error();
      setOtpError(t('Invalid code'));
      toast(responseMessage(res) ?? t('Invalid code'), 'error');
    } catch {
      haptics.error();
      setOtpError(t('Invalid code'));
      toast(t('Invalid code'), 'error');
    }
  };

  const handleReset = async () => {
    const tooShort = newPassword.length < MIN_PASSWORD_LENGTH;
    const mismatch = newPassword !== confirmPassword;
    setNewPasswordError(tooShort ? t('Password must be at least 8 characters') : '');
    setConfirmPasswordError(mismatch ? t('Passwords do not match') : '');
    if (tooShort || mismatch) {
      haptics.error();
      return;
    }
    setFinalizing(true);
    try {
      await resetPassword({
        email,
        reset_token: resetToken,
        new_password: newPassword,
        confirm_password: confirmPassword,
      }).unwrap();
      const result = await loginWithPassword(email, newPassword);
      haptics.success();
      toast(t('Password changed successfully!'), 'success');
      if (result.ok) navigate.replace('home');
      else navigate.replace('login');
    } catch (error) {
      haptics.error();
      const messages = backendErrors(error);
      if (messages.length > 0) messages.forEach((message) => toast(message, 'error'));
      else toast(extractApiError(error) ?? t('Something went wrong.'), 'error');
    } finally {
      setFinalizing(false);
    }
  };

  return (
    <Screen edges={[]}>
      <GlassHeader onBack={() => navigate.back()} transparent />
      <KeyboardAwareScrollView
        bottomOffset={24}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: insets.top + 72, paddingBottom: insets.bottom + 48, paddingHorizontal: 24 }}
      >
        <View className="mb-6 items-center gap-3">
          <Logo width={150} />
          <View className="items-center gap-1">
            <AppText className="text-center font-gilroy-bold text-[28px] leading-[34px] text-primary dark:text-dark-text">
              {heroTitle}
            </AppText>
            <AppText className="max-w-[320px] text-center font-gilroy-medium text-[15px] leading-[22px] text-muted">
              {heroSubtitle}
            </AppText>
            {step === 'otp' ? (
              <AppText className="mt-1 font-gilroy-bold text-[14px] text-primary dark:text-dark-text">{email}</AppText>
            ) : null}
          </View>
        </View>

        <View className="flex-row items-center justify-center gap-2 pb-5">
          {STEP_ORDER.map((value, index) => (
            <View
              key={value}
              style={{ width: index === activeIndex ? 22 : 8 }}
              className={cn(
                'h-2 rounded-full',
                index <= activeIndex ? 'bg-primary dark:bg-white' : 'bg-primary/15 dark:bg-white/15',
              )}
            />
          ))}
        </View>

        <GlassCard className="gap-4 p-5">
          {step === 'email' ? (
            <>
              <GlassInput
                label={t('Email')}
                value={email}
                onChangeText={setEmail}
                placeholder={t('you@email.com')}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                returnKeyType="send"
                onSubmitEditing={() => void handleSendCode()}
                leftIcon={<Mail size={18} color={colors.muted} />}
              />
              <GlassButton
                label={t('Send code')}
                onPress={() => void handleSendCode()}
                loading={isSending}
                disabled={email.trim().length === 0 || isSending}
              />
            </>
          ) : null}

          {step === 'otp' ? (
            <>
              <OtpBoxes
                value={otpCode}
                onChange={(next) => {
                  setOtpCode(next);
                  if (otpError) setOtpError('');
                }}
                editable={!isVerifying}
                autoFocus
                error={otpError}
                onComplete={(code) => void handleVerify(code)}
              />
              <GlassButton
                label={t('Verify')}
                onPress={() => void handleVerify()}
                loading={isVerifying}
                disabled={otpCode.length < OTP_LENGTH || isVerifying}
              />
              <ResendCode onResend={handleResend} />
            </>
          ) : null}

          {step === 'password' ? (
            <>
              <GlassInput
                label={t('New password')}
                value={newPassword}
                onChangeText={(value) => {
                  setNewPassword(value);
                  if (newPasswordError) setNewPasswordError('');
                }}
                placeholder={t('at least 8 characters')}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="password-new"
                textContentType="newPassword"
                error={newPasswordError || undefined}
                leftIcon={<LockKeyhole size={18} color={colors.muted} />}
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
                      <EyeOff size={18} color={colors.muted} />
                    ) : (
                      <Eye size={18} color={colors.muted} />
                    )}
                  </PressableScale>
                }
              />
              <GlassInput
                label={t('Confirm password')}
                value={confirmPassword}
                onChangeText={(value) => {
                  setConfirmPassword(value);
                  if (confirmPasswordError) setConfirmPasswordError('');
                }}
                placeholder={t('Confirm password')}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                textContentType="newPassword"
                returnKeyType="done"
                onSubmitEditing={() => void handleReset()}
                error={
                  confirmPasswordError ||
                  (confirmPassword.length > 0 && confirmPassword !== newPassword ? t('Passwords do not match') : undefined)
                }
                leftIcon={<LockKeyhole size={18} color={colors.muted} />}
              />
              <GlassButton
                label={t('Reset password')}
                onPress={() => void handleReset()}
                loading={isResetting || finalizing}
                disabled={newPassword.length === 0 || confirmPassword.length === 0 || finalizing}
              />
            </>
          ) : null}
        </GlassCard>

        {step === 'otp' ? (
          <View className="mt-5 flex-row items-center justify-center gap-1.5">
            <AppText className="font-gilroy-medium text-[13px] text-muted">{t('Wrong email?')}</AppText>
            <PressableScale
              onPress={() => {
                haptics.selection();
                setOtpCode('');
                setOtpError('');
                setStep('email');
              }}
              accessibilityLabel={t('Change email')}
              hitSlop={8}
            >
              <AppText className="font-gilroy-bold text-[13px] text-primary dark:text-dark-text">{t('Change email')}</AppText>
            </PressableScale>
          </View>
        ) : (
          <View className="mt-5 gap-3">
            <View className="flex-row items-center justify-center gap-1.5">
              <AppText className="font-gilroy-medium text-[13px] text-muted">{t('Remember your password?')}</AppText>
              <PressableScale
                onPress={() => {
                  haptics.selection();
                  navigate.back();
                }}
                accessibilityLabel={t('Log In')}
                hitSlop={8}
              >
                <AppText className="font-gilroy-bold text-[13px] text-primary dark:text-dark-text">{t('Log In')}</AppText>
              </PressableScale>
            </View>
            {step === 'email' ? (
              <View className="flex-row items-center justify-center gap-1.5">
                <AppText className="font-gilroy-medium text-[13px] text-muted">{t("Don't have an account?")}</AppText>
                <PressableScale
                  onPress={() => {
                    haptics.selection();
                    navigate.replace('register');
                  }}
                  accessibilityLabel={t('Sign up')}
                  hitSlop={8}
                >
                  <AppText className="font-gilroy-bold text-[13px] text-primary dark:text-dark-text">{t('Sign up')}</AppText>
                </PressableScale>
              </View>
            ) : null}
          </View>
        )}
      </KeyboardAwareScrollView>
    </Screen>
  );
}
