import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react-native';

import { cn } from '@/lib/cn';
import { haptics } from '@/lib/haptics';
import { navigate } from '@/lib/nav';
import { colors } from '@/theme/colors';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import {
  useResetPasswordMutation,
  useSendResetCodeMutation,
  useVerifyResetCodeMutation,
} from '@/store/api/authApi';
import {
  AppText,
  GlassButton,
  GlassCard,
  GlassHeader,
  GlassInput,
  PressableScale,
  Screen,
} from '@/components/ui';
import { Logo } from '@/components/brand';

type ResetStep = 'email' | 'otp' | 'password';

const STEP_ORDER: ResetStep[] = ['email', 'otp', 'password'];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function OtpBoxes({
  value,
  onChange,
  editable = true,
  autoFocus,
  onComplete,
}: {
  value: string;
  onChange: (next: string) => void;
  editable?: boolean;
  autoFocus?: boolean;
  onComplete?: (value: string) => void;
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
        onChangeText={(next) => {
          const cleaned = next.replace(/[^0-9]/g, '').slice(0, 6);
          onChange(cleaned);
          if (cleaned.length === 6) onComplete?.(cleaned);
        }}
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

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { loginWithPassword } = useAuth();

  const [sendResetCode, { isLoading: isSending }] = useSendResetCodeMutation();
  const [verifyResetCode, { isLoading: isVerifying }] = useVerifyResetCodeMutation();
  const [resetPassword, { isLoading: isResetting }] = useResetPasswordMutation();

  const [step, setStep] = useState<ResetStep>('email');
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  const headerPad = insets.top + 72;
  const activeIndex = STEP_ORDER.indexOf(step);

  const heroTitle =
    step === 'email'
      ? t('Reset your password')
      : step === 'otp'
        ? t('Check your inbox')
        : t('Create a new password');
  const heroSubtitle =
    step === 'email'
      ? t('Enter your email and we will send you a reset code.')
      : step === 'otp'
        ? t('We sent a 6-digit verification code to your email.')
        : t('Choose a new password to secure your account.');

  const dispatchReset = (target: string) =>
    sendResetCode({ email: target, device: Platform.OS, location: '', date: new Date().toISOString() }).unwrap();

  const handleSendCode = async () => {
    const value = email.trim();
    if (!EMAIL_PATTERN.test(value)) {
      toast(t('Please enter a valid email address'), 'error');
      return;
    }
    try {
      setEmail(value);
      await dispatchReset(value);
      haptics.success();
      setStep('otp');
    } catch {
      toast(t('Something went wrong'), 'error');
    }
  };

  const handleResend = async () => {
    try {
      await dispatchReset(email);
      haptics.success();
      toast(t('Code sent'), 'success');
    } catch {
      toast(t('Something went wrong'), 'error');
    }
  };

  const handleVerify = async (code: string = otpCode) => {
    if (code.length < 6) {
      toast(t('Invalid code'), 'error');
      return;
    }
    try {
      const res = await verifyResetCode({ email, otp_code: code }).unwrap();
      if (res.reset_token) {
        setResetToken(res.reset_token);
        haptics.success();
        setStep('password');
      } else {
        toast(t('Invalid code'), 'error');
      }
    } catch {
      toast(t('Invalid code'), 'error');
    }
  };

  const handleReset = async () => {
    if (newPassword.length < 8) {
      toast(t('Password must be at least 8 characters'), 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast(t('Passwords do not match'), 'error');
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
      haptics.success();
      const result = await loginWithPassword(email, newPassword);
      if (result.ok) navigate.home();
      else navigate.login();
    } catch {
      toast(t('Something went wrong'), 'error');
    } finally {
      setFinalizing(false);
    }
  };

  const passwordsMismatch = confirmPassword.length > 0 && confirmPassword !== newPassword;

  return (
    <Screen edges={[]}>
      <GlassHeader onBack={() => navigate.back()} transparent />
      <KeyboardAwareScrollView
        bottomOffset={24}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: headerPad, paddingBottom: insets.bottom + 48, paddingHorizontal: 24 }}
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
              <AppText className="mt-1 font-gilroy-bold text-[14px] text-primary dark:text-dark-text">
                {email}
              </AppText>
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
                placeholder={t('you@example.com')}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                returnKeyType="send"
                onSubmitEditing={handleSendCode}
                leftIcon={<Mail size={18} color={colors.muted} />}
              />
              <GlassButton
                label={t('Send code')}
                onPress={handleSendCode}
                loading={isSending}
                disabled={email.trim().length === 0}
              />
            </>
          ) : null}

          {step === 'otp' ? (
            <>
              <OtpBoxes
                value={otpCode}
                onChange={setOtpCode}
                editable={!isVerifying}
                autoFocus
                onComplete={(code) => void handleVerify(code)}
              />
              <GlassButton
                label={t('Verify')}
                onPress={() => handleVerify()}
                loading={isVerifying}
                disabled={otpCode.length < 6}
              />
              <View className="flex-row items-center justify-center gap-1.5">
                <AppText className="font-gilroy-medium text-[13px] text-muted">
                  {t('Did not get the code?')}
                </AppText>
                <PressableScale
                  onPress={() => {
                    haptics.selection();
                    void handleResend();
                  }}
                  accessibilityLabel={t('Resend code')}
                  hitSlop={8}
                >
                  <AppText className="font-gilroy-bold text-[13px] text-primary dark:text-dark-text">
                    {t('Resend code')}
                  </AppText>
                </PressableScale>
              </View>
            </>
          ) : null}

          {step === 'password' ? (
            <>
              <GlassInput
                label={t('New password')}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder={t('New password')}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="password-new"
                textContentType="newPassword"
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
                onChangeText={setConfirmPassword}
                placeholder={t('Confirm password')}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                textContentType="newPassword"
                returnKeyType="done"
                onSubmitEditing={handleReset}
                error={passwordsMismatch ? t('Passwords do not match') : undefined}
                leftIcon={<LockKeyhole size={18} color={colors.muted} />}
              />
              <GlassButton
                label={t('Reset password')}
                onPress={handleReset}
                loading={isResetting || finalizing}
                disabled={newPassword.length === 0 || confirmPassword.length === 0}
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
                setStep('email');
              }}
              accessibilityLabel={t('Change email')}
              hitSlop={8}
            >
              <AppText className="font-gilroy-bold text-[13px] text-primary dark:text-dark-text">
                {t('Change email')}
              </AppText>
            </PressableScale>
          </View>
        ) : (
          <View className="mt-5 flex-row items-center justify-center gap-1.5">
            <AppText className="font-gilroy-medium text-[13px] text-muted">
              {t('Remember your password?')}
            </AppText>
            <PressableScale
              onPress={() => {
                haptics.selection();
                navigate.back();
              }}
              accessibilityLabel={t('Log In')}
              hitSlop={8}
            >
              <AppText className="font-gilroy-bold text-[13px] text-primary dark:text-dark-text">
                {t('Log In')}
              </AppText>
            </PressableScale>
          </View>
        )}
      </KeyboardAwareScrollView>
    </Screen>
  );
}
