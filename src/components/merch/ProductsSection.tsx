import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { Package, ShoppingBag } from 'lucide-react-native';

import { AppText, EmptyState } from '@/components/ui';
import { useScreenPadding } from '@/hooks/useScreenPadding';
import { useSelectedEvent } from '@/hooks/useSelectedEvent';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useToast } from '@/hooks/useToast';
import { extractClientErrorMessage } from '@/lib/apiError';
import { haptics } from '@/lib/haptics';
import { navigate } from '@/lib/nav';
import {
  useCreateMerchProductMutation,
  useGetMerchOrdersQuery,
  useGetMerchProductsQuery,
  useGetMerchSettingsQuery,
  type MerchProductListItem,
} from '@/store/api/merchApi';
import { colors } from '@/theme/colors';

import { Card, KpiCard, ListSkeleton, StatusBadge, money } from './merchParts';
import { ProductInfoForm, type ProductInfoValues } from './ProductInfoForm';

function ProductCard({ product, currency }: { product: MerchProductListItem; currency: string }) {
  const { t } = useTranslation();
  const placeholderBg = useThemeColor(colors.cardSm, colors.dark.elevated);
  return (
    <Pressable
      onPress={() => {
        haptics.selection();
        navigate.merchProduct(product.id);
      }}
      accessibilityRole="button"
      accessibilityLabel={product.name}
    >
      <Card className="flex-row items-center gap-3 p-3">
        {product.main_image ? (
          <Image
            source={{ uri: product.main_image.image }}
            contentFit="cover"
            accessibilityLabel={product.main_image.alt_text || product.name}
            style={{ width: 56, height: 56, borderRadius: 10 }}
          />
        ) : (
          <View
            className="items-center justify-center rounded-[10px]"
            style={{ width: 56, height: 56, backgroundColor: placeholderBg }}
          >
            <Package size={22} color={colors.muted} />
          </View>
        )}
        <View className="flex-1">
          <AppText numberOfLines={1} className="font-gilroy-semibold text-[15px] leading-5">
            {product.name}
          </AppText>
          <AppText className="font-gilroy-medium text-[13px] leading-[17px] text-muted dark:text-dark-muted">
            {t('from {{price}}', { price: money(product.min_price, currency) })}
          </AppText>
          <View className="mt-1 flex-row gap-1.5">
            {!product.in_stock ? <StatusBadge label={t('Out of stock')} color={colors.danger} /> : null}
            {!product.is_active ? <StatusBadge label={t('Hidden')} color={colors.muted} /> : null}
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

export function ProductsSection({
  createOpen,
  onCreateOpenChange,
}: {
  createOpen: boolean;
  onCreateOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const padding = useScreenPadding();
  const { eventId, data: event, isLoading: eventLoading, isError: eventError, refetch: refetchEvent } =
    useSelectedEvent();
  const [refreshing, setRefreshing] = useState(false);

  const skip = eventId == null;
  const productsQuery = useGetMerchProductsQuery(eventId ?? 0, { skip });
  const ordersQuery = useGetMerchOrdersQuery(eventId ?? 0, { skip });
  const settingsQuery = useGetMerchSettingsQuery(eventId ?? 0, { skip });
  const [createProduct, { isLoading: creating }] = useCreateMerchProductMutation();

  const products = useMemo(() => productsQuery.data ?? [], [productsQuery.data]);
  const currency = settingsQuery.data?.currency ?? '';

  const kpis = useMemo(() => {
    const paid = (ordersQuery.data ?? []).filter((order) => order.payment_status === 'PAID');
    const revenue = paid.reduce((sum, order) => sum + (Number(order.total) || 0), 0);
    const units = paid.reduce((sum, order) => sum + order.items.reduce((acc, item) => acc + item.quantity, 0), 0);
    const pending = paid.filter(
      (order) => order.fulfillment_status !== 'DELIVERED' && order.fulfillment_status !== 'CANCELLED',
    ).length;
    return { revenue, units, pending };
  }, [ordersQuery.data]);

  const openCreate = () => {
    haptics.light();
    onCreateOpenChange(true);
  };

  const onCreate = async (values: ProductInfoValues) => {
    if (eventId == null) return;
    try {
      const created = await createProduct({ event: eventId, ...values }).unwrap();
      toast(t('Product created'), 'success');
      onCreateOpenChange(false);
      navigate.merchProduct(created.id);
    } catch (error) {
      toast(extractClientErrorMessage(error) ?? t('Unable to create product'), 'error');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchEvent(), productsQuery.refetch(), ordersQuery.refetch(), settingsQuery.refetch()]);
    } finally {
      setRefreshing(false);
    }
  };

  const renderBody = () => {
    if (eventLoading || productsQuery.isLoading) return <ListSkeleton />;
    if (eventError || !event) {
      return (
        <EmptyState
          icon={ShoppingBag}
          title={t('Unable to load event data.')}
          actionLabel={t('Try again')}
          onAction={() => void refetchEvent()}
        />
      );
    }
    if (productsQuery.isError) {
      return (
        <EmptyState
          icon={Package}
          title={t('Something went wrong.')}
          message={t('Please try again.')}
          actionLabel={t('Try again')}
          onAction={() => void productsQuery.refetch()}
        />
      );
    }
    return (
      <View className="gap-4">
        <View className="flex-row gap-2.5">
          <KpiCard label={t('Revenue (paid)')} value={money(kpis.revenue, currency)} />
          <KpiCard label={t('Units sold')} value={String(kpis.units)} />
          <KpiCard label={t('Pending fulfillment')} value={String(kpis.pending)} />
        </View>
        {products.length === 0 ? (
          <EmptyState
            icon={Package}
            title={t('No products yet — add your first one.')}
            actionLabel={t('Add product')}
            onAction={openCreate}
          />
        ) : (
          <View className="gap-2.5">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} currency={currency} />
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: 4, paddingBottom: padding.bottom, paddingHorizontal: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.muted} />
        }
      >
        {renderBody()}
      </ScrollView>

      {createOpen ? (
        <ProductInfoForm
          saving={creating}
          onSubmit={(values) => void onCreate(values)}
          sheet={{ title: t('Add product'), onClose: () => onCreateOpenChange(false) }}
        />
      ) : null}
    </>
  );
}
