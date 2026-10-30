import { useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import * as Clipboard from 'expo-clipboard';
import { useTranslation } from 'react-i18next';
import { Check, Copy, Store } from 'lucide-react-native';

import { AppText, Chip, EmptyState, GlassHeader, GlassInput, Screen, Skeleton } from '@/components/ui';
import {
  Card,
  MerchNav,
  MultilineInput,
  PRICE_PATTERN,
  PrimaryButton,
  SecondaryButton,
  SectionLabel,
  ToggleRow,
} from '@/components/merch/merchParts';
import { useScreenPadding } from '@/hooks/useScreenPadding';
import { useSelectedEvent } from '@/hooks/useSelectedEvent';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useToast } from '@/hooks/useToast';
import { haptics } from '@/lib/haptics';
import { navigate } from '@/lib/nav';
import {
  MERCH_CURRENCIES,
  useGetMerchSettingsQuery,
  useUpdateMerchSettingsMutation,
  type MerchSettings,
} from '@/store/api/merchApi';
import { colors } from '@/theme/colors';

function embedSnippet(slug: string): string {
  return (
    `<iframe src="https://eventino.co/embed/store/${slug}" style="width:100%;border:0;" id="eventino-store"></iframe>\n` +
    '<script src="https://eventino.co/embed/store-resize.js" defer></script>'
  );
}

function SettingsForm({ eventId, eventSlug, settings }: { eventId: number; eventSlug: string; settings: MerchSettings }) {
  const { t } = useTranslation();
  const toast = useToast();
  const iconTint = useThemeColor(colors.primary, colors.dark.text);
  const [updateSettings, { isLoading: saving }] = useUpdateMerchSettingsMutation();
  const [storeEnabled, setStoreEnabled] = useState(settings.is_store_enabled);
  const [togglingStore, setTogglingStore] = useState(false);
  const [shippingFee, setShippingFee] = useState(settings.shipping_fee ?? '');
  const [currency, setCurrency] = useState(settings.currency ?? '');
  const [storeIntro, setStoreIntro] = useState(settings.store_intro ?? '');
  const [copied, setCopied] = useState(false);
  const snippet = embedSnippet(eventSlug || '<event-slug>');

  const onToggleStore = async (next: boolean) => {
    setStoreEnabled(next);
    setTogglingStore(true);
    try {
      await updateSettings({ eventId, patch: { is_store_enabled: next } }).unwrap();
    } catch {
      setStoreEnabled(!next);
      toast(t('Failed to save settings'), 'error');
    } finally {
      setTogglingStore(false);
    }
  };

  const onSave = async () => {
    const fee = shippingFee.trim();
    if (fee && !PRICE_PATTERN.test(fee)) return toast(t('Enter a valid shipping fee'), 'error');
    try {
      await updateSettings({
        eventId,
        patch: { shipping_fee: fee || '0', currency, store_intro: storeIntro.trim() },
      }).unwrap();
      toast(t('Settings saved'), 'success');
    } catch {
      toast(t('Failed to save settings'), 'error');
    }
  };

  const onCopy = async () => {
    haptics.light();
    await Clipboard.setStringAsync(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <View className="gap-6">
      <View className="gap-2">
        <SectionLabel>{t('Storefront')}</SectionLabel>
        <ToggleRow
          label={t('Store enabled')}
          hint={togglingStore ? t('Saving...') : t('When on, your storefront accepts orders.')}
          value={storeEnabled}
          disabled={togglingStore}
          onValueChange={(next) => void onToggleStore(next)}
        />
      </View>

      <View className="gap-2">
        <SectionLabel>{t('Checkout')}</SectionLabel>
        <View className="gap-4">
          <View className="gap-1.5">
            <GlassInput
              label={t('Shipping fee (per order)')}
              placeholder="0.00"
              value={shippingFee}
              onChangeText={setShippingFee}
              keyboardType="decimal-pad"
            />
            <AppText className="font-gilroy-medium text-[12px] text-muted">
              {t('Charged once per order, regardless of item quantity.')}
            </AppText>
          </View>
          <View className="gap-2">
            <AppText className="font-gilroy-medium text-[13px] text-primary/70 dark:text-dark-text/70">
              {t('Currency')}
            </AppText>
            <View className="flex-row flex-wrap gap-2">
              {MERCH_CURRENCIES.map((code) => (
                <Chip key={code} label={code} selected={currency === code} onPress={() => setCurrency(code)} />
              ))}
            </View>
          </View>
          <MultilineInput
            label={t('Store intro')}
            placeholder={t('Welcome to our merch store…')}
            value={storeIntro}
            onChangeText={setStoreIntro}
            hint={t('Shown at the top of your storefront.')}
          />
          <PrimaryButton
            label={saving ? t('Saving...') : t('Save changes')}
            onPress={() => void onSave()}
            loading={saving && !togglingStore}
          />
        </View>
      </View>

      <View className="gap-2">
        <SectionLabel>{t('Embed')}</SectionLabel>
        <AppText className="font-gilroy-medium text-[13px] text-primary/70 dark:text-dark-text/70">
          {t('Paste this onto any HTML page on your website.')}
        </AppText>
        <Card className="p-3">
          <AppText selectable className="font-mono text-[12px] leading-[18px]">
            {snippet}
          </AppText>
        </Card>
        <SecondaryButton
          label={copied ? t('Copied') : t('Copy')}
          onPress={() => void onCopy()}
          icon={copied ? <Check size={16} color={iconTint} /> : <Copy size={16} color={iconTint} />}
        />
      </View>
    </View>
  );
}

export default function MerchSettingsScreen() {
  const { t } = useTranslation();
  const padding = useScreenPadding();
  const { eventId, data: event, refetch: refetchEvent } = useSelectedEvent();
  const settingsQuery = useGetMerchSettingsQuery(eventId ?? 0, { skip: eventId == null });
  const [refreshing, setRefreshing] = useState(false);
  const settings = settingsQuery.data;

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([settingsQuery.refetch(), refetchEvent()]);
    } finally {
      setRefreshing(false);
    }
  };

  const renderBody = () => {
    if (settingsQuery.isLoading) {
      return (
        <View className="gap-3">
          <Skeleton className="h-20 w-full rounded-[12px]" />
          <Skeleton className="h-12 w-full rounded-[10px]" />
          <Skeleton className="h-24 w-full rounded-[10px]" />
        </View>
      );
    }
    if (settingsQuery.isError || !settings || eventId == null) {
      return (
        <EmptyState
          icon={Store}
          title={t('Something went wrong.')}
          message={t('Please try again.')}
          actionLabel={t('Try again')}
          onAction={() => void settingsQuery.refetch()}
        />
      );
    }
    return <SettingsForm key={eventId} eventId={eventId} eventSlug={event?.slug ?? ''} settings={settings} />;
  };

  return (
    <Screen edges={[]}>
      <GlassHeader title={t('Merch Store')} onBack={navigate.back} />
      <KeyboardAwareScrollView
        bottomOffset={24}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: padding.top, paddingBottom: padding.bottom, paddingHorizontal: 16 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={colors.muted}
            progressViewOffset={padding.top}
          />
        }
      >
        <View className="gap-4">
          <MerchNav active="settings" />
          <AppText className="font-gilroy-medium text-[13px] text-muted">
            {t("Configure your event's merch storefront")}
          </AppText>
          {renderBody()}
        </View>
      </KeyboardAwareScrollView>
    </Screen>
  );
}
