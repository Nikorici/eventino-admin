import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, GlassInput, Skeleton } from '@/components/ui';
import { extractApiError } from '@/lib/apiError';
import {
  useGetLabelDataQuery,
  usePreviewLabelMutation,
  type FreeLabel,
  type LabelOverrides,
} from '@/store/api/printingApi';

import {
  CUSTOM_MAX,
  HIDEABLE,
  QR_VALUE_MAX,
  TEXT_KEYS,
  TEXT_MAX,
  freeLabelChanges,
  freeLabelFrom,
  freeStartingValues,
  labelChanges,
  overridesFrom,
  printingErrorText,
  startingValues,
  type EditorValues,
  type LabelChanges,
  type TextKey,
} from './printingLogic';
import { ErrorText, LabelPreview, SmallButton, Toggle } from './printingParts';

const PREVIEW_DEBOUNCE_MS = 400;

const isTextKey = (key: string): key is TextKey => TEXT_KEYS.some((entry) => entry === key);

export function LabelEditor({
  ticketId,
  eventId,
  templateId,
  printerUuid,
  initialHolderName,
  initialOverrides,
  initialFreeLabel,
  disabled = false,
  onChange,
}: {
  ticketId?: number | null;
  eventId?: number;
  templateId?: number | null;
  printerUuid?: string | null;
  initialHolderName?: string;
  initialOverrides?: LabelOverrides | null;
  initialFreeLabel?: FreeLabel;
  disabled?: boolean;
  onChange: (changes: LabelChanges) => void;
}) {
  const { t } = useTranslation();
  const free = !ticketId;
  const { data, error, isFetching } = useGetLabelDataQuery(
    free ? { eventId, templateId: templateId ?? undefined } : { ticketId: ticketId ?? undefined, templateId: templateId ?? undefined },
    { refetchOnMountOrArgChange: true },
  );
  const [previewLabel] = usePreviewLabelMutation();
  const [start, setStart] = useState<EditorValues | null>(null);
  const [values, setValues] = useState<EditorValues | null>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewSeq = useRef(0);
  const onChangeRef = useRef(onChange);
  const startingRef = useRef({ initialHolderName, initialOverrides, initialFreeLabel });

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!data || isFetching) return;
    const first = free
      ? freeStartingValues(data, startingRef.current.initialFreeLabel)
      : startingValues(data, startingRef.current.initialHolderName, startingRef.current.initialOverrides);
    setStart(first);
    setValues(first);
  }, [data, isFetching, free]);

  useEffect(() => {
    if (!data || !start || !values) {
      onChangeRef.current({});
      return;
    }
    onChangeRef.current(
      free ? freeLabelChanges(start, values, startingRef.current.initialFreeLabel !== undefined) : labelChanges(data, start, values),
    );
  }, [free, data, start, values]);

  useEffect(() => {
    if (!data || !values || !printerUuid) return undefined;
    const timer = setTimeout(() => {
      const requestId = ++previewSeq.current;
      const name = values.name.trim() && values.name !== (data.holder_name ?? '') ? values.name : undefined;
      const template = templateId || data.template_id || undefined;
      const body = free
        ? { event_id: eventId, printer_uuid: printerUuid, template_id: template, free_label: freeLabelFrom(values) }
        : {
            ticket_id: ticketId ?? undefined,
            printer_uuid: printerUuid,
            template_id: template,
            holder_name: name,
            label_overrides: overridesFrom(data, values.texts, values.hidden),
          };
      previewLabel(body)
        .unwrap()
        .then((uri) => {
          if (requestId !== previewSeq.current) return;
          setPreviewUri(uri);
          setPreviewError(null);
        })
        .catch((failure: unknown) => {
          if (requestId !== previewSeq.current) return;
          setPreviewError(printingErrorText(extractApiError(failure), t) || t('Something went wrong. Please try again.'));
        });
    }, PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [free, data, values, printerUuid, ticketId, eventId, templateId, previewLabel, t]);

  if (error) return <ErrorText text={printingErrorText(extractApiError(error), t) || t('Something went wrong. Please try again.')} />;
  if (!data || !values) {
    return (
      <View className="gap-2">
        <AppText className="font-gilroy-medium text-[13px] text-muted">{t('Loading the label...')}</AppText>
        <Skeleton className="h-12 w-full rounded-[10px]" />
      </View>
    );
  }

  const lines = Array.isArray(data.lines) ? data.lines : [];
  const rows = lines.includes('name') ? lines : ['name', ...lines];
  const isShown = (key: string) => !values.hidden.includes(key);
  const qrShown = free ? values.qrOn : isShown('qr');

  const setShown = (key: string, shown: boolean) =>
    setValues((current) =>
      current
        ? {
            ...current,
            hidden: shown
              ? current.hidden.filter((entry) => entry !== key)
              : HIDEABLE.filter((entry) => entry === key || current.hidden.includes(entry)),
          }
        : current,
    );

  const setText = (key: string, text: string) =>
    setValues((current) => {
      if (!current) return current;
      if (key === 'name') return { ...current, name: text };
      return isTextKey(key) ? { ...current, texts: { ...current.texts, [key]: text } } : current;
    });

  const field = (key: string) => {
    const lineName = key === 'name' ? t('Name on the label') : t(`layout_field_${key}`);
    const value = key === 'name' ? values.name : isTextKey(key) ? values.texts[key] : '';
    const max = key === 'custom' ? CUSTOM_MAX : TEXT_MAX;
    return (
      <View key={key} className="gap-1.5">
        <View className="flex-row items-center gap-2">
          <AppText className="flex-1 font-gilroy-medium text-[13px] text-primary/70 dark:text-dark-text/70">
            {lineName}
            {key === 'custom' ? `  ${value.length}/${CUSTOM_MAX}` : ''}
          </AppText>
          {lines.includes(key) ? (
            <Toggle
              value={isShown(key)}
              disabled={disabled}
              accessibilityLabel={t('Show {{line}}', { line: lineName })}
              onChange={(next) => setShown(key, next)}
            />
          ) : null}
        </View>
        <GlassInput
          value={value}
          maxLength={max}
          editable={!disabled && isShown(key)}
          accessibilityLabel={lineName}
          onChangeText={(text) => setText(key, text)}
        />
      </View>
    );
  };

  return (
    <View className="gap-3">
      {rows.map(field)}
      {data.has_qr ? (
        <View className="gap-1.5">
          <View className="flex-row items-center gap-2">
            <AppText className="flex-1 font-gilroy-medium text-[13px] text-primary/70 dark:text-dark-text/70">
              {t('layout_field_qr')}
            </AppText>
            <Toggle
              accessibilityLabel={t('Show {{line}}', { line: t('layout_field_qr') })}
              value={qrShown}
              disabled={disabled}
              onChange={(next) => {
                if (free) setValues((current) => (current ? { ...current, qrOn: next } : current));
                else setShown('qr', next);
              }}
            />
          </View>
          {free && values.qrOn ? (
            <GlassInput
              label={t('QR link or text')}
              value={values.qrValue}
              maxLength={QR_VALUE_MAX}
              editable={!disabled}
              autoCapitalize="none"
              onChangeText={(text) => setValues((current) => (current ? { ...current, qrValue: text } : current))}
            />
          ) : null}
        </View>
      ) : null}
      {free ? null : (
        <View className="self-start">
          <SmallButton label={t('Reset to ticket')} disabled={disabled} onPress={() => setValues(startingValues(data))} />
        </View>
      )}
      <View className="gap-1.5">
        <AppText className="font-gilroy-medium text-[13px] text-primary/70 dark:text-dark-text/70">{t('Label preview')}</AppText>
        {printerUuid ? null : <AppText className="font-gilroy-medium text-[13px] text-muted">{t('Choose a printer to see the preview.')}</AppText>}
        {printerUuid && previewUri ? <LabelPreview uri={previewUri} stale={Boolean(previewError)} label={t('Label preview')} /> : null}
        {printerUuid ? <ErrorText text={previewError} /> : null}
      </View>
    </View>
  );
}
