import { useState } from 'react';
import { ActivityIndicator, RefreshControl, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { ImagePlus, Package, Pencil, Plus, Trash2 } from 'lucide-react-native';

import { confirmAction } from '@/components/dashboard/dashboardParts';
import { AppText, DashedAddButton, EmptyState, GlassHeader, GlassInput, PressableScale, Screen, Skeleton } from '@/components/ui';
import {
  Card,
  INTEGER_PATTERN,
  PRICE_PATTERN,
  SectionLabel,
  StatusBadge,
  ToggleRow,
  money,
} from '@/components/merch/merchParts';
import { ProductInfoForm, type ProductInfoValues } from '@/components/merch/ProductInfoForm';
import { useScreenPadding } from '@/hooks/useScreenPadding';
import { useSelectedEvent } from '@/hooks/useSelectedEvent';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/cn';
import type { MultipartFile } from '@/lib/eventFormBody';
import { haptics } from '@/lib/haptics';
import { navigate } from '@/lib/nav';
import {
  useCreateMerchVariantMutation,
  useDeleteMerchImageMutation,
  useDeleteMerchVariantMutation,
  useGetMerchProductQuery,
  useGetMerchSettingsQuery,
  useUpdateMerchImageMutation,
  useUpdateMerchProductMutation,
  useUpdateMerchVariantMutation,
  useUploadMerchImageMutation,
  type MerchProductDetail,
  type MerchProductImage,
  type MerchProductVariant,
} from '@/store/api/merchApi';
import { colors } from '@/theme/colors';

interface VariantDraft {
  id: number | null;
  name: string;
  price: string;
  stock: string;
  is_active: boolean;
}

interface NativeFormData {
  append(name: string, value: string | MultipartFile): void;
}

const EMPTY_VARIANT: VariantDraft = { id: null, name: '', price: '', stock: '0', is_active: true };

function VariantsSection({ product, currency }: { product: MerchProductDetail; currency: string }) {
  const { t } = useTranslation();
  const toast = useToast();
  const iconTint = useThemeColor(colors.primary, colors.dark.text);
  const rowDivider = useThemeColor('#f0f2f8', colors.dark.border);
  const [draft, setDraft] = useState<VariantDraft | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [createVariant, { isLoading: creating }] = useCreateMerchVariantMutation();
  const [updateVariant, { isLoading: updating }] = useUpdateMerchVariantMutation();
  const [deleteVariant] = useDeleteMerchVariantMutation();

  const patchDraft = (patch: Partial<VariantDraft>) => setDraft((current) => (current ? { ...current, ...patch } : current));

  const startEdit = (variant: MerchProductVariant) => {
    haptics.selection();
    setDraft({
      id: variant.id,
      name: variant.name,
      price: variant.price ?? '',
      stock: String(variant.stock),
      is_active: variant.is_active,
    });
  };

  const submit = async () => {
    if (!draft) return;
    const name = draft.name.trim();
    const price = draft.price.trim();
    const stock = draft.stock.trim() || '0';
    if (!name) return toast(t('Name is required'), 'error');
    if (price && !PRICE_PATTERN.test(price)) return toast(t('Enter a valid price'), 'error');
    if (!INTEGER_PATTERN.test(stock)) return toast(t('Enter a valid stock quantity'), 'error');
    try {
      if (draft.id != null) {
        await updateVariant({
          variantId: draft.id,
          patch: { name, price: price || null, stock: Number(stock), is_active: draft.is_active },
        }).unwrap();
        toast(t('Variant updated'), 'success');
      } else {
        await createVariant({
          product: product.id,
          name,
          sku: '',
          price: price || null,
          stock: Number(stock),
          is_active: draft.is_active,
        }).unwrap();
        toast(t('Variant added'), 'success');
      }
      setDraft(null);
    } catch {
      toast(t('Failed to save variant'), 'error');
    }
  };

  const confirmDelete = async (variant: MerchProductVariant) => {
    setDeletingId(variant.id);
    try {
      await deleteVariant(variant.id).unwrap();
      toast(t('Variant deleted'), 'success');
    } catch {
      toast(t('Failed to delete variant'), 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const remove = (variant: MerchProductVariant) => {
    haptics.medium();
    confirmAction({
      title: t('Delete this variant?'),
      message: t('This action cannot be undone.'),
      confirmLabel: t('Delete'),
      cancelLabel: t('Cancel'),
      destructive: true,
      onConfirm: () => void confirmDelete(variant),
    });
  };

  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between">
        <SectionLabel>{t('Variants')}</SectionLabel>
        {!draft ? (
          <PressableScale
            onPress={() => {
              haptics.light();
              setDraft(EMPTY_VARIANT);
            }}
            accessibilityLabel={t('Add variant')}
            className="h-9 flex-row items-center gap-1.5 rounded-full border border-app-border bg-app-surface px-3 dark:border-dark-border dark:bg-dark-surface"
          >
            <Plus size={15} color={iconTint} />
            <AppText className="font-gilroy-semibold text-[13px]">{t('Add variant')}</AppText>
          </PressableScale>
        ) : null}
      </View>

      {product.variants.length === 0 && !draft ? (
        <AppText className="font-gilroy-medium text-[13px] text-muted">{t('No variants yet.')}</AppText>
      ) : null}

      {product.variants.length > 0 ? (
        <Card className="px-4">
          {product.variants.map((variant, index) => (
            <View
              key={variant.id}
              className={cn('flex-row items-center gap-3 py-3', index > 0 && 'border-t')}
              style={index > 0 ? { borderColor: rowDivider } : undefined}
            >
              <View className="flex-1">
                <View className="flex-row items-center gap-1.5">
                  <AppText numberOfLines={1} className="shrink font-gilroy-semibold text-[14px]">
                    {variant.name}
                  </AppText>
                  {!variant.is_active ? <StatusBadge label={t('Hidden')} color={colors.muted} /> : null}
                </View>
                <AppText className="font-gilroy-medium text-[12px] text-muted">
                  {money(variant.effective_price, currency)} · {t('Stock')}: {variant.stock}
                  {variant.sku ? ` · ${variant.sku}` : ''}
                </AppText>
              </View>
              <PressableScale
                onPress={() => startEdit(variant)}
                accessibilityLabel={t('Edit variant')}
                className="h-9 w-9 items-center justify-center rounded-full bg-black/[0.04] dark:bg-white/10"
              >
                <Pencil size={15} color={iconTint} />
              </PressableScale>
              <PressableScale
                onPress={() => remove(variant)}
                disabled={deletingId === variant.id}
                accessibilityLabel={t('Delete variant')}
                className="h-9 w-9 items-center justify-center rounded-full"
                style={{ backgroundColor: `${colors.danger}18` }}
              >
                {deletingId === variant.id ? (
                  <ActivityIndicator size="small" color={colors.danger} />
                ) : (
                  <Trash2 size={15} color={colors.danger} />
                )}
              </PressableScale>
            </View>
          ))}
        </Card>
      ) : null}

      {draft ? (
        <Card className="gap-3 p-4">
          <AppText className="font-gilroy-semibold text-[14px]">
            {draft.id != null ? t('Edit variant') : t('Add variant')}
          </AppText>
          <GlassInput
            label={t('Name')}
            placeholder="Size M"
            value={draft.name}
            onChangeText={(value) => patchDraft({ name: value })}
          />
          <View className="flex-row gap-3">
            <View className="flex-1">
              <GlassInput
                label={t('Price')}
                placeholder={product.base_price || '0.00'}
                value={draft.price}
                onChangeText={(value) => patchDraft({ price: value })}
                keyboardType="decimal-pad"
              />
            </View>
            <View className="flex-1">
              <GlassInput
                label={t('Stock')}
                placeholder="0"
                value={draft.stock}
                onChangeText={(value) => patchDraft({ stock: value })}
                keyboardType="number-pad"
              />
            </View>
          </View>
          <ToggleRow
            bordered={false}
            label={t('Active')}
            value={draft.is_active}
            onValueChange={(next) => patchDraft({ is_active: next })}
          />
          <View className="flex-row gap-2.5">
            <PressableScale
              onPress={() => {
                haptics.light();
                setDraft(null);
              }}
              accessibilityLabel={t('Cancel')}
              className="h-11 flex-1 items-center justify-center rounded-[12px] border border-app-border bg-app-surface dark:border-dark-border dark:bg-dark-surface"
            >
              <AppText className="font-gilroy-semibold text-[14px]">{t('Cancel')}</AppText>
            </PressableScale>
            <PressableScale
              onPress={() => void submit()}
              disabled={creating || updating}
              accessibilityLabel={t('Save')}
              className="h-11 flex-1 items-center justify-center rounded-[12px] bg-primary dark:bg-white"
            >
              {creating || updating ? (
                <ActivityIndicator color={colors.muted} />
              ) : (
                <AppText className="font-gilroy-semibold text-[14px] text-white dark:text-primary">{t('Save')}</AppText>
              )}
            </PressableScale>
          </View>
        </Card>
      ) : null}
    </View>
  );
}

function ImageTile({ image, productId }: { image: MerchProductImage; productId: number }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [updateImage, { isLoading: setting }] = useUpdateMerchImageMutation();
  const [deleteImage, { isLoading: deleting }] = useDeleteMerchImageMutation();

  const setMain = async () => {
    haptics.selection();
    try {
      await updateImage({ imageId: image.id, productId, is_main: true }).unwrap();
    } catch {
      toast(t('Please try again.'), 'error');
    }
  };

  const remove = async () => {
    haptics.medium();
    try {
      await deleteImage({ imageId: image.id, productId }).unwrap();
    } catch {
      toast(t('Please try again.'), 'error');
    }
  };

  return (
    <View className="w-[31%] gap-1.5">
      <View>
        <Image
          source={{ uri: image.image }}
          contentFit="cover"
          accessibilityLabel={image.alt_text}
          style={{ width: '100%', aspectRatio: 1, borderRadius: 10 }}
        />
        {image.is_main ? (
          <View className="absolute left-1.5 top-1.5 rounded-full bg-primary px-2 py-0.5 dark:bg-white">
            <AppText className="font-gilroy-semibold text-[10px] text-white dark:text-primary">{t('Main')}</AppText>
          </View>
        ) : null}
      </View>
      <View className="flex-row items-center justify-between">
        {!image.is_main ? (
          <PressableScale onPress={() => void setMain()} disabled={setting} accessibilityLabel={t('Set main')}>
            <AppText className="font-gilroy-semibold text-[13px]">{t('Set main')}</AppText>
          </PressableScale>
        ) : (
          <View />
        )}
        <PressableScale
          onPress={() => void remove()}
          disabled={deleting}
          accessibilityLabel={t('Delete')}
          className="h-8 w-8 items-center justify-center rounded-full"
          style={{ backgroundColor: `${colors.danger}18` }}
        >
          {deleting ? <ActivityIndicator size="small" color={colors.danger} /> : <Trash2 size={14} color={colors.danger} />}
        </PressableScale>
      </View>
    </View>
  );
}

function ImagesSection({ product }: { product: MerchProductDetail }) {
  const { t } = useTranslation();
  const toast = useToast();
  const iconTint = useThemeColor(colors.primary, colors.dark.text);
  const [uploadImage] = useUploadMerchImageMutation();
  const [uploading, setUploading] = useState(false);

  const pickImages = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return toast(t('Please try again.'), 'error');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.85,
    });
    if (result.canceled) return;
    setUploading(true);
    try {
      let hasMain = product.images.some((image) => image.is_main);
      for (const asset of result.assets) {
        const form = new FormData() as unknown as NativeFormData;
        form.append('image', {
          uri: asset.uri,
          name: asset.fileName ?? `image-${Date.now()}.jpg`,
          type: asset.mimeType ?? 'image/jpeg',
        });
        form.append('is_main', hasMain ? 'false' : 'true');
        form.append('product', String(product.id));
        await uploadImage({ productId: product.id, form: form as unknown as FormData }).unwrap();
        hasMain = true;
      }
    } catch {
      toast(t('Please try again.'), 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <View className="gap-2">
      <SectionLabel>{t('Images')}</SectionLabel>
      {product.images.length > 0 ? (
        <View className="flex-row flex-wrap gap-[3.5%]" style={{ rowGap: 12 }}>
          {product.images.map((image) => (
            <ImageTile key={image.id} image={image} productId={product.id} />
          ))}
        </View>
      ) : null}
      {uploading ? (
        <View className="h-12 flex-row items-center justify-center gap-2">
          <ActivityIndicator size="small" color={colors.muted} />
          <AppText className="font-gilroy-medium text-[13px] text-muted">{t('Uploading...')}</AppText>
        </View>
      ) : (
        <DashedAddButton
          label={t('Upload images')}
          onPress={() => void pickImages()}
          icon={<ImagePlus size={18} color={iconTint} />}
        />
      )}
    </View>
  );
}

export default function MerchProductScreen() {
  const { t } = useTranslation();
  const toast = useToast();
  const padding = useScreenPadding();
  const { pid } = useLocalSearchParams<{ pid: string }>();
  const productId = Number(pid);
  const { eventId } = useSelectedEvent();
  const productQuery = useGetMerchProductQuery(productId, { skip: !productId });
  const settingsQuery = useGetMerchSettingsQuery(eventId ?? 0, { skip: eventId == null });
  const [updateProduct, { isLoading: saving }] = useUpdateMerchProductMutation();
  const [refreshing, setRefreshing] = useState(false);
  const product = productQuery.data;
  const currency = settingsQuery.data?.currency ?? '';

  const onSave = async (values: ProductInfoValues) => {
    try {
      await updateProduct({ productId, patch: values }).unwrap();
      toast(t('Product updated'), 'success');
    } catch {
      toast(t('Failed to save product'), 'error');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([productQuery.refetch(), settingsQuery.refetch()]);
    } finally {
      setRefreshing(false);
    }
  };

  const renderBody = () => {
    if (productQuery.isLoading) {
      return (
        <View className="gap-3">
          <Skeleton className="h-12 w-full rounded-[10px]" />
          <Skeleton className="h-12 w-full rounded-[10px]" />
          <Skeleton className="h-12 w-full rounded-[10px]" />
          <Skeleton className="h-24 w-full rounded-[10px]" />
        </View>
      );
    }
    if (productQuery.isError || !product) {
      return (
        <EmptyState
          icon={Package}
          title={t('Something went wrong.')}
          message={t('Please try again.')}
          actionLabel={t('Try again')}
          onAction={() => void productQuery.refetch()}
        />
      );
    }
    return (
      <View className="gap-6">
        <ProductInfoForm
          key={product.id}
          initial={{
            name: product.name,
            slug: product.slug,
            base_price: product.base_price,
            description: product.description,
            is_active: product.is_active,
          }}
          saving={saving}
          onSubmit={(values) => void onSave(values)}
        />
        <VariantsSection product={product} currency={currency} />
        <ImagesSection product={product} />
      </View>
    );
  };

  return (
    <Screen edges={[]}>
      <GlassHeader title={t('Edit product')} onBack={navigate.back} />
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
        {renderBody()}
      </KeyboardAwareScrollView>
    </Screen>
  );
}
