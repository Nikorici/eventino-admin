import { useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useTranslation } from 'react-i18next';
import { CircleCheck, CircleX, ReceiptText } from 'lucide-react-native';

import { CARD_BORDER } from '@/components/dashboard/DashboardStats';
import { ToggleRow } from '@/components/merch/merchParts';
import { AppText, EmptyState, GlassButton, GlassHeader, GlassInput, Screen, Skeleton } from '@/components/ui';
import { useScrollInsets } from '@/hooks/useScreenPadding';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useToast } from '@/hooks/useToast';
import { extractApiError } from '@/lib/apiError';
import { cn } from '@/lib/cn';
import { haptics } from '@/lib/haptics';
import { navigate } from '@/lib/nav';
import {
  smartbillErrorMessage,
  useGetSmartBillConnectionQuery,
  useTestSmartBillConnectionMutation,
  useUpdateSmartBillConnectionMutation,
  type SmartBillConnection,
  type SmartBillTestResult,
  type UpdateSmartBillConnectionBody,
} from '@/store/api/smartbillApi';
import { colors } from '@/theme/colors';

interface FormState {
  email: string;
  api_token: string;
  cif: string;
  series_name: string;
  tax_name: string;
  tax_percentage: string;
  auto_send: boolean;
}

function formFromConnection(connection: SmartBillConnection): FormState {
  return {
    email: connection.email ?? '',
    api_token: '',
    cif: connection.cif ?? '',
    series_name: connection.series_name ?? '',
    tax_name: connection.tax_name || 'Normala',
    tax_percentage: String(connection.tax_percentage ?? '21'),
    auto_send: Boolean(connection.auto_send),
  };
}

function FormSkeleton() {
  return (
    <View className="gap-4">
      {Array.from({ length: 6 }, (_, index) => (
        <View key={index} className="gap-1.5">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-12 w-full rounded-[10px]" />
        </View>
      ))}
      <Skeleton className="h-12 w-full rounded-[12px]" />
      <View className="flex-row gap-3">
        <Skeleton className="h-12 flex-1 rounded-full" />
        <Skeleton className="h-12 flex-1 rounded-full" />
      </View>
    </View>
  );
}

export default function SmartBillScreen() {
  const { t } = useTranslation();
  const scroll = useScrollInsets();
  const toast = useToast();
  const cardBorder = useThemeColor(CARD_BORDER, colors.dark.border);

  const connectionQuery = useGetSmartBillConnectionQuery();
  const [updateConnection, { isLoading: saving }] = useUpdateSmartBillConnectionMutation();
  const [testConnection, { isLoading: testing }] = useTestSmartBillConnectionMutation();

  const connection = connectionQuery.data;
  const hasToken = Boolean(connection?.has_token);

  const [edited, setEdited] = useState<FormState | null>(null);
  const [testResult, setTestResult] = useState<SmartBillTestResult | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const form = edited ?? (connection ? formFromConnection(connection) : null);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    if (form) setEdited({ ...form, [key]: value });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await connectionQuery.refetch();
      setEdited(null);
      setTestResult(null);
    } finally {
      setRefreshing(false);
    }
  };

  const onSave = async () => {
    if (!form) return;
    const email = form.email.trim();
    const cif = form.cif.trim();
    const seriesName = form.series_name.trim();
    if (!email || !cif || !seriesName) {
      toast(t('Please fill in all required fields.'), 'error');
      return;
    }
    haptics.selection();
    const body: UpdateSmartBillConnectionBody = {
      email,
      cif,
      series_name: seriesName,
      auto_send: form.auto_send,
      tax_name: form.tax_name,
    };
    const percentage = Number(form.tax_percentage);
    if (form.tax_percentage.trim() && Number.isFinite(percentage)) body.tax_percentage = percentage;
    if (form.api_token) body.api_token = form.api_token;
    try {
      await updateConnection(body).unwrap();
      setEdited({ ...form, api_token: '' });
      toast(t('SmartBill settings saved.'), 'success');
    } catch (error) {
      toast(extractApiError(error) ?? t('Failed to save SmartBill settings.'), 'error');
    }
  };

  const onTest = async () => {
    haptics.selection();
    setTestResult(null);
    try {
      setTestResult(await testConnection().unwrap());
    } catch (error) {
      setTestResult({ ok: false, message: smartbillErrorMessage(error) ?? t('Test failed.') });
    }
  };

  const renderForm = () => {
    if (connectionQuery.isError && !connection) {
      return (
        <EmptyState
          icon={ReceiptText}
          title={t('Something went wrong.')}
          message={t('Please try again.')}
          actionLabel={t('Try again')}
          onAction={() => void connectionQuery.refetch()}
        />
      );
    }
    if (!form) return <FormSkeleton />;
    return (
      <View className="gap-4">
        <GlassInput
          label={t('SmartBill account email')}
          value={form.email}
          onChangeText={(value) => setField('email', value)}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <GlassInput
          label={t('API token')}
          value={form.api_token}
          onChangeText={(value) => setField('api_token', value)}
          placeholder={hasToken ? t('Configured — leave blank to keep') : ''}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
        />
        <GlassInput
          label={t('CIF')}
          value={form.cif}
          onChangeText={(value) => setField('cif', value)}
          autoCapitalize="characters"
          autoCorrect={false}
        />
        <GlassInput
          label={t('Invoice series')}
          value={form.series_name}
          onChangeText={(value) => setField('series_name', value)}
          autoCapitalize="characters"
          autoCorrect={false}
        />
        <GlassInput
          label={t('VAT rate name')}
          value={form.tax_name}
          onChangeText={(value) => setField('tax_name', value)}
          placeholder="Normala"
          autoCorrect={false}
        />
        <GlassInput
          label={t('VAT percentage')}
          value={form.tax_percentage}
          onChangeText={(value) => setField('tax_percentage', value)}
          keyboardType="number-pad"
        />
        <AppText className="font-gilroy-medium text-[12px] text-muted dark:text-dark-muted">
          {t('Must match a VAT rate (cotă TVA) configured in your SmartBill account.')}
        </AppText>

        <ToggleRow
          label={t('Auto-send invoice on paid order')}
          value={form.auto_send}
          onValueChange={(value) => setField('auto_send', value)}
          spacious
        />

        {testResult ? (
          <View
            accessibilityLiveRegion="polite"
            className={cn(
              'flex-row items-center gap-2.5 rounded-[12px] px-4 py-3',
              testResult.ok ? 'bg-success/15' : 'bg-danger/15',
            )}
          >
            {testResult.ok ? (
              <CircleCheck size={18} color={colors.success} />
            ) : (
              <CircleX size={18} color={colors.danger} />
            )}
            <AppText className="flex-1 font-gilroy-medium text-[14px]">
              {testResult.message || (testResult.ok ? t('Connection successful.') : t('Test failed.'))}
            </AppText>
          </View>
        ) : null}

        <View className="flex-row gap-3">
          <View className="flex-1">
            <GlassButton label={t('Test connection')} variant="secondary" loading={testing} onPress={() => void onTest()} />
          </View>
          <View className="flex-1">
            <GlassButton label={t('Save')} loading={saving} onPress={() => void onSave()} />
          </View>
        </View>
      </View>
    );
  };

  return (
    <Screen edges={[]}>
      <GlassHeader title={t('SmartBill Integration')} onBack={navigate.back} />
      <KeyboardAwareScrollView
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        {...scroll.scrollProps}
        contentContainerStyle={{ paddingTop: scroll.paddingTop, paddingBottom: scroll.paddingBottom, paddingHorizontal: 16 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={colors.muted}
            progressViewOffset={scroll.refreshOffset}
          />
        }
      >
        <View className="gap-6">
          <View
            className="flex-row items-center gap-3 rounded-[14px] border bg-white p-4 dark:bg-dark-surface"
            style={{ borderColor: cardBorder }}
          >
            <View className="h-10 w-10 items-center justify-center rounded-full bg-black/[0.04] dark:bg-white/10">
              <ReceiptText size={20} color={colors.accent} />
            </View>
            <View className="flex-1 gap-1">
              <AppText className="font-gilroy-bold text-[16px]">{t('SmartBill Integration')}</AppText>
              <AppText className="font-gilroy-medium text-[13px] text-muted dark:text-dark-muted">
                {t('Configure your SmartBill invoicing settings')}
              </AppText>
            </View>
          </View>
          {renderForm()}
        </View>
      </KeyboardAwareScrollView>
    </Screen>
  );
}
