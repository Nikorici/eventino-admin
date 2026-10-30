import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useTranslation } from 'react-i18next';
import { Megaphone } from 'lucide-react-native';

import { navigate } from '@/lib/nav';
import { colors } from '@/theme/colors';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useScreenPadding } from '@/hooks/useScreenPadding';
import { useSelectedEvent } from '@/hooks/useSelectedEvent';
import { useToast } from '@/hooks/useToast';
import { useAppSelector } from '@/store/hooks';
import { useGetMarketingPixelsQuery } from '@/store/api/organizerApi';
import { useUpdateUserMutation } from '@/store/api/usersApi';
import { CARD_BORDER } from '@/components/dashboard/DashboardStats';
import { MetaIcon, TikTokIcon } from '@/components/traffic/PixelIcons';
import { AppText, EmptyState, GlassButton, GlassHeader, GlassInput, Screen, Skeleton } from '@/components/ui';

const META_PIXEL_PATTERN = /^\d{6,20}$/;
const TIKTOK_PIXEL_PATTERN = /^[A-Za-z0-9]{6,40}$/;

export default function MarketingTrackingScreen() {
  const { t } = useTranslation();
  const toast = useToast();
  const padding = useScreenPadding();
  const cardBorder = useThemeColor(CARD_BORDER, colors.dark.border);
  const metaTint = useThemeColor(colors.primary, colors.dark.text);
  const userId = useAppSelector((state) => state.auth.user?.id ?? null);
  const { data: event } = useSelectedEvent();
  const pixels = useGetMarketingPixelsQuery(userId ?? 0, { skip: userId == null });
  const [updateUser, { isLoading: saving }] = useUpdateUserMutation();
  const [metaPixel, setMetaPixel] = useState('');
  const [tiktokPixel, setTiktokPixel] = useState('');

  useEffect(() => {
    if (!pixels.data) return;
    setMetaPixel(pixels.data.meta_pixel_id ?? '');
    setTiktokPixel(pixels.data.tiktok_pixel_id ?? '');
  }, [pixels.data]);

  const onSave = useCallback(async () => {
    if (userId == null) {
      toast(t('Failed to update marketing tracking settings. Please try again.'), 'error');
      return;
    }
    const meta = metaPixel.trim();
    const tiktok = tiktokPixel.trim();
    if (meta !== '' && !META_PIXEL_PATTERN.test(meta)) {
      toast(t('Meta Pixel ID must be 6–20 digits'), 'error');
      return;
    }
    if (tiktok !== '' && !TIKTOK_PIXEL_PATTERN.test(tiktok)) {
      toast(t('TikTok Pixel ID must be 6–40 alphanumeric characters'), 'error');
      return;
    }
    const formData = new FormData();
    formData.append('meta_pixel_id', meta);
    formData.append('tiktok_pixel_id', tiktok);
    try {
      await updateUser({ id: userId, formData }).unwrap();
      toast(t('Marketing tracking settings updated successfully'), 'success');
    } catch {
      toast(t('Failed to update marketing tracking settings. Please try again.'), 'error');
    }
  }, [metaPixel, tiktokPixel, updateUser, userId, toast, t]);

  return (
    <Screen edges={[]}>
      <GlassHeader title={t('Marketing & Tracking')} onBack={navigate.back} />
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingTop: padding.top, paddingBottom: padding.bottom, paddingHorizontal: 16 }}
          refreshControl={
            <RefreshControl
              refreshing={pixels.isFetching && !pixels.isLoading}
              onRefresh={() => void pixels.refetch()}
              tintColor={colors.muted}
            />
          }
        >
          <View className="gap-3">
            <AppText className="font-gilroy-medium text-[13px] text-muted dark:text-dark-muted">
              {t('Connect Meta and TikTok pixels to track conversions across all your events')}
            </AppText>
            {pixels.isLoading || userId == null ? (
              <View className="gap-4 rounded-[12px] border bg-white p-4 dark:bg-dark-surface" style={{ borderColor: cardBorder }}>
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-12 w-full rounded-[10px]" />
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-12 w-full rounded-[10px]" />
              </View>
            ) : pixels.isError ? (
              <EmptyState
                icon={Megaphone}
                title={t('Something went wrong.')}
                message={t('Please try again.')}
                actionLabel={t('Try again')}
                onAction={() => void pixels.refetch()}
              />
            ) : (
              <>
                <View className="gap-4 rounded-[12px] border bg-white p-4 dark:bg-dark-surface" style={{ borderColor: cardBorder }}>
                  <View className="gap-1.5">
                    <GlassInput
                      label={t('Meta Pixel ID')}
                      value={metaPixel}
                      onChangeText={setMetaPixel}
                      keyboardType="number-pad"
                      autoCapitalize="none"
                      autoCorrect={false}
                      placeholder="123456789012345"
                      leftIcon={<MetaIcon color={metaTint} />}
                    />
                    <AppText className="font-gilroy-medium text-[11px] text-muted dark:text-dark-muted">
                      {t('Find this in Meta Events Manager → Data Sources. Numeric ID only — paste just the digits, not the full snippet.')}
                    </AppText>
                  </View>
                  <View className="gap-1.5">
                    <GlassInput
                      label={t('TikTok Pixel ID')}
                      value={tiktokPixel}
                      onChangeText={setTiktokPixel}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      placeholder="C4ABCDEFGHIJKLMNOP"
                      leftIcon={<TikTokIcon />}
                    />
                    <AppText className="font-gilroy-medium text-[11px] text-muted dark:text-dark-muted">
                      {t('Find this in TikTok Events Manager → Web Events. Pixel code only (e.g. C4ABCDEFGHIJKLMNOP).')}
                    </AppText>
                  </View>
                  <AppText className="font-gilroy-medium text-[12px] text-muted dark:text-dark-muted">
                    {t('Pixels apply automatically to every event you organize. Standard events fired: PageView, ViewContent, InitiateCheckout, Purchase / CompletePayment.')}
                  </AppText>
                </View>
                <GlassButton
                  label={t('Save Changes')}
                  onPress={() => void onSave()}
                  loading={saving}
                  disabled={saving || Boolean(event?.is_cancelled)}
                  fullWidth
                  className="mt-2"
                />
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
