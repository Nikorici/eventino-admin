import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp } from 'lucide-react-native';

import { AppText, GlassButton, GlassHeader, GlassInput, PressableScale, Screen, Skeleton } from '@/components/ui';
import { PanelCard } from '@/components/dashboard/dashboardParts';
import {
  ALIGNMENTS,
  CUSTOM_TEXT_MAX,
  LOGO_PLACEMENTS,
  PRESETS,
  PRESET_KEYS,
  QR_POSITIONS,
  QR_SOURCES,
  TEXT_SIZES,
  changePreset,
  emptyLayoutForm,
  formFromLayout,
  isTextField,
  layoutFromForm,
  lineSize,
  moveLine,
  type LayoutForm,
} from '@/components/printing/layoutForm';
import { computerState, printerLabel, printingErrorText } from '@/components/printing/printingLogic';
import { ChoiceRow, ErrorText, LabelPreview, SelectField, SmallButton, Toggle, ToggleRow } from '@/components/printing/printingParts';
import { useScreenPadding } from '@/hooks/useScreenPadding';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useToast } from '@/hooks/useToast';
import { extractApiError } from '@/lib/apiError';
import { haptics } from '@/lib/haptics';
import { navigate } from '@/lib/nav';
import { useGetOrganizerEventsQuery } from '@/store/api/organizerApi';
import {
  useCreateLabelTemplateMutation,
  useDeleteTemplateLogoMutation,
  useGetLabelTemplatesQuery,
  useGetPrintAgentsQuery,
  useGetPrintersQuery,
  useGetTemplateLogoQuery,
  usePreviewLayoutMutation,
  useUpdateLabelTemplateMutation,
  useUploadTemplateLogoMutation,
  type LabelTemplate,
  type LogoFile,
  type TextSize,
} from '@/store/api/printingApi';
import { colors } from '@/theme/colors';

const PREVIEW_DEBOUNCE_MS = 400;
const LOGO_MAX_BYTES = 200 * 1024;
const LOGO_TYPES = ['image/png', 'image/jpeg'];

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <PanelCard className="gap-3 py-4">
      <AppText className="font-gilroy-bold text-[16px]">{title}</AppText>
      {children}
    </PanelCard>
  );
}

function Label({ children }: { children: string }) {
  return <AppText className="font-gilroy-medium text-[13px] text-primary/70 dark:text-dark-text/70">{children}</AppText>;
}

function ArrowButton({ up, disabled, label, onPress }: { up: boolean; disabled: boolean; label: string; onPress: () => void }) {
  const tint = useThemeColor(colors.primary, colors.dark.text);
  const Icon = up ? ChevronUp : ChevronDown;
  return (
    <PressableScale
      disabled={disabled}
      accessibilityLabel={label}
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      className={`h-8 w-8 items-center justify-center rounded-full bg-black/[0.05] dark:bg-white/10 ${disabled ? 'opacity-30' : ''}`}
    >
      <Icon size={16} color={tint} />
    </PressableScale>
  );
}

function LayoutEditor({ template }: { template: LabelTemplate | null }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [editingId, setEditingId] = useState<number | null>(template?.id ?? null);
  const [name, setName] = useState(template?.name ?? '');
  const [scopeEventId, setScopeEventId] = useState(template?.event_id ? String(template.event_id) : '');
  const [form, setForm] = useState<LayoutForm>(() => (template?.layout ? formFromLayout(template.layout) : emptyLayoutForm()));
  const [printerUuid, setPrinterUuid] = useState('');
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [hasLogo, setHasLogo] = useState(Boolean(template?.has_logo));
  const [pendingLogo, setPendingLogo] = useState<{ file: LogoFile; dataUrl: string } | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoVersion, setLogoVersion] = useState(0);
  const requestId = useRef(0);

  const { data: eventList } = useGetOrganizerEventsQuery({ page: 1, page_size: 200 });
  const { data: allPrinters } = useGetPrintersQuery();
  const { data: agents } = useGetPrintAgentsQuery();
  const [previewLayout] = usePreviewLayoutMutation();
  const [createTemplate] = useCreateLabelTemplateMutation();
  const [updateTemplate] = useUpdateLabelTemplateMutation();
  const [uploadLogo] = useUploadTemplateLogoMutation();
  const [deleteLogo] = useDeleteTemplateLogoMutation();
  const { data: logoThumb } = useGetTemplateLogoQuery(
    { id: editingId ?? 0, version: logoVersion },
    { skip: !editingId || !hasLogo || Boolean(pendingLogo) },
  );

  const events = eventList?.events ?? [];
  const printers = (allPrinters ?? []).filter(
    (printer) => !printer.archived_at && computerState((agents ?? []).find((agent) => agent.uuid === printer.agent_uuid)) !== 'revoked',
  );

  useEffect(() => {
    if (!printerUuid && printers.length) setPrinterUuid(printers[0].uuid);
  }, [printers, printerUuid]);

  useEffect(() => {
    if (!printerUuid) return undefined;
    const timer = setTimeout(() => {
      const id = ++requestId.current;
      const layout = layoutFromForm(form);
      const logoOptions = !layout.logo ? {} : pendingLogo ? { logo: pendingLogo.dataUrl } : editingId ? { template_id: editingId } : {};
      previewLayout({ printer_uuid: printerUuid, layout, ...logoOptions })
        .unwrap()
        .then((uri) => {
          if (id !== requestId.current) return;
          setPreviewUri(uri);
          setPreviewError(null);
        })
        .catch((failure: unknown) => {
          if (id !== requestId.current) return;
          setPreviewError(printingErrorText(extractApiError(failure), t) || t('Something went wrong. Please try again.'));
        });
    }, PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [form, printerUuid, pendingLogo, editingId, logoVersion, previewLayout, t]);

  const failureText = (failure: unknown) =>
    printingErrorText(extractApiError(failure), t) || t('Something went wrong. Please try again.');

  const sendLogo = async (templateId: number, file: LogoFile) => {
    try {
      await uploadLogo({ id: templateId, file }).unwrap();
    } catch (failure) {
      setLogoError(failureText(failure));
      return false;
    }
    setHasLogo(true);
    setLogoVersion((version) => version + 1);
    return true;
  };

  const pickLogo = async () => {
    setLogoError(null);
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], base64: true, quality: 1 });
    const asset = picked.canceled ? null : picked.assets[0];
    if (!asset) return;
    const type = asset.mimeType ?? (asset.uri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg');
    if (!LOGO_TYPES.includes(type)) {
      setLogoError(t('The logo must be a PNG or JPG file.'));
      return;
    }
    if ((asset.fileSize ?? 0) > LOGO_MAX_BYTES) {
      setLogoError(t('The logo must be 200 KB or smaller.'));
      return;
    }
    const file: LogoFile = { uri: asset.uri, name: asset.fileName ?? `logo.${type === 'image/png' ? 'png' : 'jpg'}`, type };
    const placeLogo = () => setForm((current) => (current.logo ? current : { ...current, logo: 'top' }));
    if (editingId) {
      setLogoBusy(true);
      if (await sendLogo(editingId, file)) placeLogo();
      setLogoBusy(false);
      return;
    }
    setPendingLogo({ file, dataUrl: asset.base64 ? `data:${type};base64,${asset.base64}` : asset.uri });
    placeLogo();
  };

  const removeLogo = async () => {
    setLogoError(null);
    if (pendingLogo) {
      setPendingLogo(null);
      return;
    }
    if (!editingId || !hasLogo) return;
    setLogoBusy(true);
    try {
      await deleteLogo(editingId).unwrap();
      setHasLogo(false);
      setLogoVersion((version) => version + 1);
    } catch (failure) {
      setLogoError(failureText(failure));
    } finally {
      setLogoBusy(false);
    }
  };

  const save = async () => {
    setSaveError(null);
    if (!name.trim()) {
      setSaveError(t('Give the layout a name.'));
      return;
    }
    if (form.fields.custom && !form.customText.trim()) {
      setSaveError(t('Type the text for the custom line.'));
      return;
    }
    setSaving(true);
    try {
      const payload = { name: name.trim(), layout: layoutFromForm(form) };
      const result = editingId
        ? await updateTemplate({ id: editingId, ...payload }).unwrap()
        : await createTemplate({ ...payload, event_id: scopeEventId ? Number(scopeEventId) : null }).unwrap();
      toast(t('Layout saved.'), 'success');
      const savedId = result.id || editingId;
      setEditingId(savedId);
      if (pendingLogo && savedId && (await sendLogo(savedId, pendingLogo.file))) setPendingLogo(null);
    } catch (failure) {
      setSaveError(failureText(failure));
    } finally {
      setSaving(false);
    }
  };

  const allowed = PRESETS[form.preset].allowed;
  const lines = form.order.filter((field) => isTextField(field) && allowed.includes(field));
  const offersQr = allowed.includes('qr');
  const qrOnly = form.preset === 'qr_only';
  const showsLogo = Boolean(pendingLogo) || hasLogo;
  const logoPreview = pendingLogo?.dataUrl ?? logoThumb ?? null;
  const setField = (field: string, value: boolean) => setForm((current) => ({ ...current, fields: { ...current.fields, [field]: value } }));
  const setSize = (field: string, size: TextSize) => setForm((current) => ({ ...current, sizes: { ...current.sizes, [field]: size } }));

  return (
    <View className="gap-4">
      <Group title={t('Content')}>
        <GlassInput label={t('Name')} value={name} onChangeText={setName} />
        <SelectField
          label={t('Use for')}
          value={scopeEventId}
          disabled={Boolean(editingId)}
          onChange={setScopeEventId}
          fallbackLabel={scopeEventId ? t('Event #{{id}}', { id: scopeEventId }) : undefined}
          options={[{ value: '', label: t('All events') }, ...events.map((event) => ({ value: String(event.id), label: event.name }))]}
        />
        {editingId ? (
          <AppText className="font-gilroy-medium text-[12px] text-muted">
            {t('The event is fixed once a layout is saved. Save a new layout to use it elsewhere.')}
          </AppText>
        ) : null}
        <SelectField
          label={t('Preset')}
          value={form.preset}
          onChange={(preset) => setForm(changePreset(form, preset))}
          options={PRESET_KEYS.map((preset) => ({ value: preset, label: t(`layout_preset_${preset}`) }))}
        />
      </Group>

      {lines.length ? (
        <Group title={t('Lines')}>
          {lines.map((field, index) => {
            const lineName = t(`layout_field_${field}`);
            return (
              <View key={field} className="gap-2 border-t border-black/5 pt-3 dark:border-white/10">
                <View className="flex-row items-center gap-2">
                  <Toggle value={Boolean(form.fields[field])} accessibilityLabel={lineName} onChange={(next) => setField(field, next)} />
                  <AppText numberOfLines={1} className="flex-1 font-gilroy-semibold text-[14px]">
                    {lineName}
                  </AppText>
                  <ArrowButton
                    up
                    disabled={index === 0}
                    label={t('Move {{line}} up', { line: lineName })}
                    onPress={() => setForm((current) => moveLine(current, field, -1))}
                  />
                  <ArrowButton
                    up={false}
                    disabled={index === lines.length - 1}
                    label={t('Move {{line}} down', { line: lineName })}
                    onPress={() => setForm((current) => moveLine(current, field, 1))}
                  />
                </View>
                <ChoiceRow<TextSize>
                  value={lineSize(form, field)}
                  disabled={!form.fields[field]}
                  onChange={(size) => setSize(field, size)}
                  options={TEXT_SIZES.map((size) => ({ value: size, label: t(`text_size_${size}`) }))}
                />
                {field === 'custom' ? (
                  <GlassInput
                    accessibilityLabel={t('Custom line text')}
                    placeholder={t('e.g. SPEAKER')}
                    maxLength={CUSTOM_TEXT_MAX}
                    value={form.customText}
                    rightIcon={
                      <AppText className="font-gilroy-medium text-[12px] text-muted">
                        {form.customText.length}/{CUSTOM_TEXT_MAX}
                      </AppText>
                    }
                    onChangeText={(value) =>
                      setForm((current) => ({
                        ...current,
                        customText: value,
                        fields: value.trim() ? { ...current.fields, custom: true } : current.fields,
                      }))
                    }
                  />
                ) : null}
              </View>
            );
          })}
          <Label>{t('Alignment')}</Label>
          <ChoiceRow
            value={form.align}
            onChange={(align) => setForm((current) => ({ ...current, align }))}
            options={ALIGNMENTS.map((align) => ({ value: align, label: t(`align_${align}`) }))}
          />
        </Group>
      ) : null}

      {offersQr ? (
        <Group title={t('QR code')}>
          {!qrOnly ? <ToggleRow label={t('Print a QR code')} value={Boolean(form.fields.qr)} onChange={(next) => setField('qr', next)} /> : null}
          <Label>{t('QR opens')}</Label>
          <ChoiceRow
            value={form.qrSource}
            onChange={(qrSource) => setForm((current) => ({ ...current, qrSource }))}
            options={QR_SOURCES.map((source) => ({ value: source, label: t(`qr_source_${source}`) }))}
          />
          {form.qrSource === 'conecta' ? (
            <AppText className="font-gilroy-medium text-[12px] text-muted">
              {t("Opens the attendee's Conecta profile, or a 'not created yet' page until they make one.")}
            </AppText>
          ) : null}
          {!qrOnly ? (
            <>
              <Label>{t('Position')}</Label>
              <ChoiceRow
                value={form.qrPosition}
                onChange={(qrPosition) => setForm((current) => ({ ...current, qrPosition }))}
                options={QR_POSITIONS.map((position) => ({ value: position, label: t(`qr_position_${position}`) }))}
              />
              <Label>{t('Size')}</Label>
              <ChoiceRow<TextSize>
                value={form.qrSize}
                onChange={(qrSize) => setForm((current) => ({ ...current, qrSize }))}
                options={TEXT_SIZES.map((size) => ({ value: size, label: t(`text_size_${size}`) }))}
              />
            </>
          ) : null}
        </Group>
      ) : null}

      <Group title={t('Logo')}>
        <AppText className="font-gilroy-medium text-[12px] text-muted">{t('PNG or JPG, up to 200 KB.')}</AppText>
        <View className="flex-row items-center gap-3">
          {showsLogo && logoPreview ? (
            <Image source={{ uri: logoPreview }} accessibilityLabel={t('Event logo')} contentFit="contain" style={{ width: 56, height: 56, borderRadius: 8 }} />
          ) : null}
          <SmallButton label={showsLogo ? t('Replace logo') : t('Upload logo')} disabled={logoBusy} onPress={() => void pickLogo()} />
          {showsLogo ? <SmallButton label={t('Remove logo')} disabled={logoBusy} onPress={() => void removeLogo()} /> : null}
        </View>
        {pendingLogo ? (
          <AppText className="font-gilroy-medium text-[12px] text-muted">{t('The logo will be uploaded when you save the layout.')}</AppText>
        ) : null}
        <ErrorText text={logoError} />
        <Label>{t('Placement')}</Label>
        <ChoiceRow
          value={form.logo}
          onChange={(logo) => setForm((current) => ({ ...current, logo }))}
          options={LOGO_PLACEMENTS.map((placement) => ({ value: placement, label: t(`logo_placement_${placement ?? 'none'}`) }))}
        />
      </Group>

      <PanelCard className="gap-3 py-4">
        <SelectField
          label={t('Preview on')}
          value={printerUuid}
          onChange={setPrinterUuid}
          options={printers.map((printer) => ({ value: printer.uuid, label: printerLabel(printer, t, agents ?? []) }))}
        />
        {previewUri ? <LabelPreview uri={previewUri} stale={Boolean(previewError)} label={t('Label preview')} /> : null}
        <ErrorText text={previewError} />
      </PanelCard>

      <ErrorText text={saveError} />
      <GlassButton label={saving ? t('Saving...') : t('Save layout')} disabled={saving} onPress={() => void save()} />
    </View>
  );
}

export default function LabelLayoutScreen() {
  const { t } = useTranslation();
  const padding = useScreenPadding();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const templateId = id ? Number(id) : null;
  const { data: templates, isLoading } = useGetLabelTemplatesQuery(undefined, { skip: templateId == null });
  const template = templateId == null ? null : templates?.find((row) => row.id === templateId) ?? null;
  const waiting = templateId != null && isLoading;

  return (
    <Screen edges={[]}>
      <GlassHeader title={template ? template.name : t('New layout')} onBack={navigate.back} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: padding.top, paddingBottom: padding.bottom, paddingHorizontal: 16 }}
      >
        {waiting ? <Skeleton className="h-96 w-full rounded-[12px]" /> : <LayoutEditor key={template?.id ?? 'new'} template={template} />}
      </ScrollView>
    </Screen>
  );
}
