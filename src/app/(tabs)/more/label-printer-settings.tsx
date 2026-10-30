import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Printer as PrinterIcon } from 'lucide-react-native';

import { AppText, EmptyState, GlassButton, GlassHeader, GlassInput, Screen, Skeleton } from '@/components/ui';
import { PanelCard } from '@/components/dashboard/dashboardParts';
import {
  CONTINUOUS_WIDTHS,
  DIE_CUT_SIZES,
  ORIENTATIONS,
  ROTATIONS,
  mediaMismatch,
  type PrinterForm,
} from '@/components/printing/layoutForm';
import { printingErrorText } from '@/components/printing/printingLogic';
import { ErrorText, Notice, SelectField } from '@/components/printing/printingParts';
import { useScreenPadding } from '@/hooks/useScreenPadding';
import { useToast } from '@/hooks/useToast';
import { extractApiError } from '@/lib/apiError';
import { navigate } from '@/lib/nav';
import { useGetPrintersQuery, useUpdatePrinterMutation, type Printer } from '@/store/api/printingApi';

const MARGINS = ['margin_left_mm', 'margin_right_mm', 'margin_top_mm', 'margin_bottom_mm'] as const;

const toNullableNumber = (value: string) => (value === '' ? null : Number(value));
const text = (value: number | null | undefined) => (value == null ? '' : String(value));
const isOrientation = (value: string): value is PrinterForm['orientation'] => ORIENTATIONS.some((entry) => entry === value);
const isKind = (value: string): value is PrinterForm['override_kind'] => value === '' || value === 'DIE_CUT' || value === 'CONTINUOUS';

const formOf = (printer: Printer): PrinterForm => ({
  name: printer.name ?? '',
  override_kind: printer.override_kind ?? '',
  override_width_mm: text(printer.override_width_mm),
  override_height_mm: text(printer.override_height_mm),
  orientation: printer.orientation ?? 'AUTO',
  rotation_deg: printer.rotation_deg ?? 0,
  margin_left_mm: text(printer.margin_left_mm ?? 0),
  margin_right_mm: text(printer.margin_right_mm ?? 0),
  margin_top_mm: text(printer.margin_top_mm ?? 0),
  margin_bottom_mm: text(printer.margin_bottom_mm ?? 0),
});

function PrinterSettingsForm({ printer }: { printer: Printer }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [form, setForm] = useState<PrinterForm>(() => formOf(printer));
  const [saveError, setSaveError] = useState('');
  const [updatePrinter, { isLoading: saving }] = useUpdatePrinterMutation();

  const detected = printer.detected_media_width_mm
    ? `${printer.detected_media_width_mm} x ${printer.detected_media_length_mm} mm`
    : t('unknown');
  const effectiveKind = form.override_kind || printer.detected_media_kind;
  const isContinuous = effectiveKind === 'CONTINUOUS';
  const orientationOptions = isContinuous ? ORIENTATIONS.filter((value) => value !== 'LANDSCAPE') : ORIENTATIONS;

  useEffect(() => {
    if (isContinuous && form.orientation === 'LANDSCAPE') setForm((current) => ({ ...current, orientation: 'AUTO' }));
  }, [isContinuous, form.orientation]);

  const save = async () => {
    setSaveError('');
    try {
      await updatePrinter({
        uuid: printer.uuid,
        values: {
          name: form.name,
          orientation: form.orientation,
          rotation_deg: Number(form.rotation_deg),
          margin_left_mm: toNullableNumber(form.margin_left_mm),
          margin_right_mm: toNullableNumber(form.margin_right_mm),
          margin_top_mm: toNullableNumber(form.margin_top_mm),
          margin_bottom_mm: toNullableNumber(form.margin_bottom_mm),
          override_kind: form.override_kind || null,
          override_width_mm: form.override_kind ? toNullableNumber(form.override_width_mm) : null,
          override_height_mm: form.override_kind === 'DIE_CUT' ? toNullableNumber(form.override_height_mm) : null,
        },
      }).unwrap();
    } catch (failure) {
      setSaveError(printingErrorText(extractApiError(failure), t) || t('Something went wrong. Please try again.'));
      return;
    }
    toast(t('Printer settings saved.'), 'success');
    navigate.back();
  };

  return (
    <View className="gap-4">
      <View className="gap-0.5">
        <AppText className="font-gilroy-bold text-[18px]">{t('Printer settings')}</AppText>
        <AppText className="font-gilroy-medium text-[13px] text-muted">{t('Loaded labels: {{media}}', { media: detected })}</AppText>
      </View>
      <PanelCard className="gap-4 py-4">
        <GlassInput label={t('Name')} value={form.name} onChangeText={(name) => setForm({ ...form, name })} />
        <SelectField
          label={t('Label size')}
          value={form.override_kind}
          onChange={(kind) => {
            if (isKind(kind)) setForm({ ...form, override_kind: kind });
          }}
          options={[
            { value: '', label: t('Use what the printer reports') },
            { value: 'DIE_CUT', label: t('Die-cut labels') },
            { value: 'CONTINUOUS', label: t('Continuous roll') },
          ]}
        />
        {form.override_kind === 'DIE_CUT' ? (
          <SelectField
            accessibilityLabel={t('Choose a size')}
            value={`${form.override_width_mm}x${form.override_height_mm}`}
            onChange={(value) => {
              const [width, height] = value.split('x');
              setForm({ ...form, override_width_mm: width, override_height_mm: height });
            }}
            options={[
              { value: 'x', label: t('Choose a size') },
              ...DIE_CUT_SIZES.map(([width, height]) => ({ value: `${width}x${height}`, label: `${width} x ${height} mm` })),
            ]}
          />
        ) : null}
        {form.override_kind === 'CONTINUOUS' ? (
          <SelectField
            accessibilityLabel={t('Choose a width')}
            value={form.override_width_mm}
            onChange={(width) => setForm({ ...form, override_width_mm: width })}
            options={[
              { value: '', label: t('Choose a width') },
              ...CONTINUOUS_WIDTHS.map((width) => ({ value: String(width), label: `${width} mm` })),
            ]}
          />
        ) : null}
        {mediaMismatch(printer, form) ? (
          <Notice text={t('This size does not match the labels in the printer, so jobs will be refused until the roll matches.')} />
        ) : null}
        <SelectField
          label={t('Orientation')}
          value={form.orientation}
          onChange={(value) => {
            if (isOrientation(value)) setForm({ ...form, orientation: value });
          }}
          options={orientationOptions.map((value) => ({ value, label: t(value) }))}
        />
        <SelectField
          label={t('Rotation')}
          value={String(form.rotation_deg)}
          onChange={(value) => setForm({ ...form, rotation_deg: Number(value) })}
          options={ROTATIONS.map((value) => ({ value: String(value), label: `${value}°` }))}
        />
        <View className="flex-row flex-wrap gap-3">
          {MARGINS.map((field) => (
            <View key={field} className="min-w-[45%] flex-1">
              <GlassInput
                label={t(field)}
                keyboardType="numeric"
                value={form[field]}
                onChangeText={(value) => setForm({ ...form, [field]: value })}
              />
            </View>
          ))}
        </View>
      </PanelCard>
      <ErrorText text={saveError} />
      <View className="flex-row gap-3">
        <View className="flex-1">
          <GlassButton label={t('Cancel')} variant="secondary" onPress={navigate.back} />
        </View>
        <View className="flex-1">
          <GlassButton label={saving ? t('Saving...') : t('Save')} disabled={saving} onPress={() => void save()} />
        </View>
      </View>
    </View>
  );
}

export default function LabelPrinterSettingsScreen() {
  const { t } = useTranslation();
  const padding = useScreenPadding();
  const { uuid } = useLocalSearchParams<{ uuid?: string }>();
  const { data, isLoading, isError, refetch } = useGetPrintersQuery();
  const printer = data?.find((row) => row.uuid === uuid);

  return (
    <Screen edges={[]}>
      <GlassHeader title={t('Printer settings')} onBack={navigate.back} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: padding.top, paddingBottom: padding.bottom, paddingHorizontal: 16 }}
      >
        {printer ? (
          <PrinterSettingsForm key={printer.uuid} printer={printer} />
        ) : isLoading ? (
          <View className="gap-3">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-96 w-full rounded-[12px]" />
          </View>
        ) : (
          <EmptyState
            icon={PrinterIcon}
            title={isError ? t('Something went wrong. Please try again.') : t('No printer has reported in yet.')}
            actionLabel={t('Try again')}
            onAction={() => void refetch()}
          />
        )}
      </ScrollView>
    </Screen>
  );
}
