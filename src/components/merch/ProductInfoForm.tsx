import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { GlassInput } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import type { MerchProductPatch } from '@/store/api/merchApi';

import { MultilineInput, PRICE_PATTERN, PrimaryButton, ToggleRow } from './merchParts';

export interface ProductInfoValues {
  name: string;
  slug: string;
  base_price: string;
  description: string;
  is_active: boolean;
}

const EMPTY_PRODUCT: ProductInfoValues = { name: '', slug: '', base_price: '0.00', description: '', is_active: false };

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function ProductInfoForm({
  initial,
  saving,
  onSubmit,
}: {
  initial?: MerchProductPatch;
  saving: boolean;
  onSubmit: (values: ProductInfoValues) => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const isNew = !initial;
  const [form, setForm] = useState<ProductInfoValues>({ ...EMPTY_PRODUCT, ...initial });
  const [slugTouched, setSlugTouched] = useState(!isNew);

  const update = <K extends keyof ProductInfoValues>(key: K, value: ProductInfoValues[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = () => {
    const values = {
      ...form,
      name: form.name.trim(),
      slug: form.slug.trim(),
      base_price: form.base_price.trim(),
      description: form.description.trim(),
    };
    if (!values.name) return toast(t('Name is required'), 'error');
    if (!values.slug) return toast(t('Slug is required'), 'error');
    if (!PRICE_PATTERN.test(values.base_price)) return toast(t('Enter a valid price'), 'error');
    onSubmit(values);
  };

  return (
    <View className="gap-4">
      <GlassInput
        label={t('Name')}
        placeholder={t('e.g. Eventino Hoodie')}
        value={form.name}
        onChangeText={(value) => {
          update('name', value);
          if (!slugTouched) update('slug', slugify(value));
        }}
      />
      <GlassInput
        label={t('Slug')}
        placeholder={t('e.g. eventino-hoodie')}
        value={form.slug}
        onChangeText={(value) => {
          setSlugTouched(true);
          update('slug', value);
        }}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <GlassInput
        label={t('Base price')}
        placeholder={t('e.g. 35.00')}
        value={form.base_price}
        onChangeText={(value) => update('base_price', value)}
        keyboardType="decimal-pad"
      />
      <MultilineInput
        label={t('Description')}
        placeholder={t('Describe the product')}
        value={form.description}
        onChangeText={(value) => update('description', value)}
      />
      <ToggleRow
        label={t('Visible to customers')}
        value={form.is_active}
        onValueChange={(next) => update('is_active', next)}
      />
      <PrimaryButton label={t('Save')} onPress={submit} loading={saving} />
    </View>
  );
}
