import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as WebBrowser from 'expo-web-browser';
import { Building2, Check, Eye, EyeOff, Lock, Mail, MailCheck } from 'lucide-react-native';

import { cn } from '@/lib/cn';
import { WEB_ORIGIN } from '@/lib/constants';
import { extractApiError } from '@/lib/apiError';
import { navigate } from '@/lib/nav';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  useRegisterMutation,
  useResendVerifyEmailMutation,
  useVerifyEmailMutation,
  type VerificationResponse,
} from '@/store/api/authApi';
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
import { Logo } from '@/components/brand';
import { OTP_LENGTH, OtpBoxes } from '@/components/auth/OtpBoxes';
import { ResendCode } from '@/components/auth/ResendCode';
import { SocialSignIn } from '@/components/auth/SocialSignIn';

type AccountType = 'person' | 'organization';
type Step = 'form' | 'verify';
type FieldName = 'email' | 'password' | 'first_name' | 'last_name' | 'organization_name';
type FieldErrors = Partial<Record<FieldName, string>>;

const ICON_MUTED = '#8a8d93';
const ICON_ACCENT = '#15dd7d';
const FIELD_NAMES: FieldName[] = ['email', 'password', 'first_name', 'last_name', 'organization_name'];

function fieldErrorsOf(errors: Record<string, string[]> | undefined): FieldErrors {
  const result: FieldErrors = {};
  if (!errors) return result;
  for (const name of FIELD_NAMES) {
    const message = errors[name]?.[0];
    if (message) result[name] = message;
  }
  return result;
}

function isSuccess(response: VerificationResponse): boolean {
  return response.status === 200 || response.status === 201;
}

function CheckRow({
  checked,
  onToggle,
  error,
  children,
}: {
  checked: boolean;
  onToggle: () => void;
  error?: string;
  children: ReactNode;
}) {
  const isDark = useColorScheme() === 'dark';
  return (
    <View className="gap-1">
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
              : error
                ? 'border-danger bg-app-surface dark:bg-dark-surface'
                : 'border-app-border bg-app-surface dark:border-dark-border dark:bg-dark-surface',
          )}
        >
          {checked ? <Check size={13} color={isDark ? '#2b3a44' : '#ffffff'} /> : null}
        </View>
        <View className="flex-1">{children}</View>
      </PressableScale>
      {error ? <AppText className="font-gilroy-medium text-xs text-danger dark:text-danger">{error}</AppText> : null}
    </View>
  );
}

function LegalLink({ label, path }: { label: string; path: string }) {
  return (
    <AppText
      onPress={() => {
        haptics.selection();
        void WebBrowser.openBrowserAsync(`${WEB_ORIGIN}${path}`);
      }}
      accessibilityRole="link"
      className="font-gilroy-semibold text-primary-light underline dark:text-accent"
    >
      {label}
    </AppText>
  );
}

export default function RegisterScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { loginWithPassword } = useAuth();
  const toast = useToast();
  const [registerMutation, { isLoading: isRegistering }] = useRegisterMutation();
  const [verifyEmail, { isLoading: isVerifying }] = useVerifyEmailMutation();
  const [resendVerifyEmail] = useResendVerifyEmailMutation();

  const [accountType, setAccountType] = useState<AccountType>('person');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [step, setStep] = useState<Step>('form');
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyError, setPrivacyError] = useState('');
  const [termsError, setTermsError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [socialPending, setSocialPending] = useState(false);

  const busy = isRegistering || finishing || socialPending;

  const clearFieldError = (name: FieldName) => {
    if (fieldErrors[name]) setFieldErrors((current) => ({ ...current, [name]: undefined }));
  };

  const handleRegister = async () => {
    setPrivacyError('');
    setTermsError('');
    setFieldErrors({});
    if (!privacyAccepted) {
      haptics.error();
      setPrivacyError(t('Please confirm that you have read and agree with our Privacy Policy.'));
      return;
    }
    if (!termsAccepted) {
      haptics.error();
      setTermsError(t('Please confirm that you have read and agree with our Terms of Use.'));
      return;
    }
    if (accountType === 'organization' && !organizationName.trim()) {
      haptics.error();
      setFieldErrors({ organization_name: t('Organisation name is required!') });
      return;
    }
    const namesMissing = accountType === 'person' && (!firstName.trim() || !lastName.trim());
    if (namesMissing || !email.trim() || !password) {
      haptics.error();
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
      if (!isSuccess(res)) {
        haptics.error();
        setFieldErrors(fieldErrorsOf(res.errors));
        toast(res.message ?? t('Registration failed'), 'error');
        return;
      }
      haptics.success();
      setOtpCode('');
      setOtpError('');
      setStep('verify');
      toast(t('We sent a code to your email'), 'success');
    } catch (error) {
      haptics.error();
      toast(extractApiError(error) ?? t('Registration failed'), 'error');
    }
  };

  const handleVerify = async (code: string = otpCode) => {
    if (code.length !== OTP_LENGTH) {
      toast(t('Enter the 6-digit code'), 'error');
      return;
    }
    setOtpError('');
    try {
      haptics.medium();
      const res = await verifyEmail({ email: email.trim(), otp_code: code }).unwrap();
      if (!isSuccess(res)) {
        haptics.error();
        setOtpError(t('Invalid code'));
        toast(t('Invalid code'), 'error');
        return;
      }
      setFinishing(true);
      const result = await loginWithPassword(email.trim(), password);
      setFinishing(false);
      if (result.ok) {
        haptics.success();
        toast(t('Account created successfully!'), 'success');
        navigate.home();
      } else {
        navigate.replace('login');
      }
    } catch (error) {
      setFinishing(false);
      haptics.error();
      const message = extractApiError(error) ?? t('Invalid code');
      setOtpError(message);
      toast(message, 'error');
    }
  };

  const handleResend = async () => {
    try {
      const res = await resendVerifyEmail({ email: email.trim() }).unwrap();
      if (!isSuccess(res)) {
        toast(res.message ?? t('Could not send the code'), 'error');
        return;
      }
      haptics.success();
      toast(t('Code sent'), 'success');
    } catch (error) {
      toast(extractApiError(error) ?? t('Could not send the code'), 'error');
    }
  };

  const nameFields =
    accountType === 'person' ? (
      <View className="flex-row gap-3">
        <GlassInput
          containerClassName="flex-1"
          label={t('First name')}
          value={firstName}
          onChangeText={(value) => {
            setFirstName(value);
            clearFieldError('first_name');
          }}
          placeholder={t('First name')}
          textContentType="givenName"
          autoComplete="name-given"
          error={fieldErrors.first_name}
        />
        <GlassInput
          containerClassName="flex-1"
          label={t('Last name')}
          value={lastName}
          onChangeText={(value) => {
            setLastName(value);
            clearFieldError('last_name');
          }}
          placeholder={t('Last name')}
          textContentType="familyName"
          autoComplete="name-family"
          error={fieldErrors.last_name}
        />
      </View>
    ) : (
      <GlassInput
        label={t('Organization name')}
        value={organizationName}
        onChangeText={(value) => {
          setOrganizationName(value);
          clearFieldError('organization_name');
        }}
        placeholder={t('Organization name')}
        textContentType="organizationName"
        error={fieldErrors.organization_name}
        leftIcon={<Building2 size={18} color={ICON_MUTED} />}
      />
    );

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
                {step === 'form' ? t('Create an account') : t('Verify your email')}
              </AppText>
              <AppText className="max-w-[320px] text-center font-gilroy-medium text-[15px] leading-[22px] text-muted">
                {step === 'form' ? t('Create your account, it takes less than a minute') : t('We sent a code to your email')}
              </AppText>
            </View>
          </View>

          {step === 'form' ? (
            <GlassCard>
              <View className="gap-4 p-5">
                <SegmentedControl
                  value={accountType}
                  onChange={(value) => {
                    setAccountType(value);
                    setFieldErrors({});
                  }}
                  options={[
                    { value: 'person', label: t('Person') },
                    { value: 'organization', label: t('Organization') },
                  ]}
                />

                {nameFields}

                <GlassInput
                  label={t('Email')}
                  value={email}
                  onChangeText={(value) => {
                    setEmail(value);
                    clearFieldError('email');
                  }}
                  placeholder={t('you@email.com')}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  error={fieldErrors.email}
                  leftIcon={<Mail size={18} color={ICON_MUTED} />}
                />

                <GlassInput
                  label={t('Password')}
                  value={password}
                  onChangeText={(value) => {
                    setPassword(value);
                    clearFieldError('password');
                  }}
                  placeholder={t('at least 8 characters')}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="new-password"
                  textContentType="newPassword"
                  returnKeyType="go"
                  onSubmitEditing={() => void handleRegister()}
                  error={fieldErrors.password}
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
                      {showPassword ? <EyeOff size={18} color={ICON_MUTED} /> : <Eye size={18} color={ICON_MUTED} />}
                    </PressableScale>
                  }
                />

                <View className="gap-3 pt-1">
                  <CheckRow
                    checked={privacyAccepted}
                    error={privacyError}
                    onToggle={() => {
                      setPrivacyAccepted((value) => !value);
                      setPrivacyError('');
                    }}
                  >
                    <AppText className="font-gilroy-medium text-[13px] leading-[19px] text-primary/70 dark:text-dark-text/70">
                      {t('I agree and accept')} <LegalLink label={t('Privacy Policy')} path="/privacy-policy" />
                    </AppText>
                  </CheckRow>
                  <CheckRow
                    checked={termsAccepted}
                    error={termsError}
                    onToggle={() => {
                      setTermsAccepted((value) => !value);
                      setTermsError('');
                    }}
                  >
                    <AppText className="font-gilroy-medium text-[13px] leading-[19px] text-primary/70 dark:text-dark-text/70">
                      {t('I agree and accept')} <LegalLink label={t('Terms of Use')} path="/terms-of-use" />
                    </AppText>
                  </CheckRow>
                </View>

                <GlassButton
                  label={t('Create an account')}
                  onPress={() => void handleRegister()}
                  loading={isRegistering}
                  disabled={busy}
                  className="mt-1"
                />

                <SocialSignIn
                  mode="register"
                  disabled={busy}
                  onPendingChange={setSocialPending}
                  onSignedIn={() => navigate.home()}
                />
              </View>
            </GlassCard>
          ) : (
            <GlassCard>
              <View className="gap-5 p-5">
                <View className="items-center gap-3">
                  <View className="h-16 w-16 items-center justify-center rounded-full bg-accent/15">
                    <MailCheck size={28} color={ICON_ACCENT} />
                  </View>
                  <AppText className="font-gilroy-semibold text-base text-primary dark:text-dark-text">{email.trim()}</AppText>
                </View>

                <OtpBoxes
                  value={otpCode}
                  onChange={(next) => {
                    setOtpCode(next);
                    if (otpError) setOtpError('');
                  }}
                  onComplete={(code) => void handleVerify(code)}
                  editable={!busy && !isVerifying}
                  autoFocus
                  error={otpError}
                />

                <GlassButton
                  label={t('Verify')}
                  onPress={() => void handleVerify()}
                  loading={isVerifying || finishing}
                  disabled={otpCode.length !== OTP_LENGTH || busy}
                />

                <ResendCode onResend={handleResend} />

                <PressableScale
                  onPress={() => {
                    haptics.selection();
                    setOtpCode('');
                    setOtpError('');
                    setStep('form');
                  }}
                  accessibilityLabel={t('Use a different email')}
                  className="items-center"
                  hitSlop={6}
                >
                  <AppText className="font-gilroy-semibold text-[13px] text-primary-light dark:text-dark-text/70">
                    {t('Use a different email')}
                  </AppText>
                </PressableScale>
              </View>
            </GlassCard>
          )}

          <View className="flex-row items-center justify-center gap-1.5">
            <AppText className="font-gilroy-medium text-[13px] text-muted">{t('Already have an account?')}</AppText>
            <PressableScale
              onPress={() => {
                haptics.selection();
                navigate.back();
              }}
              accessibilityLabel={t('Log In')}
              hitSlop={6}
            >
              <AppText className="font-gilroy-semibold text-[13px] text-primary dark:text-dark-text">{t('Log In')}</AppText>
            </PressableScale>
          </View>
        </View>
      </KeyboardAwareScrollView>
    </Screen>
  );
}
