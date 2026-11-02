import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, Switch, TextInput, useWindowDimensions, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { skipToken } from '@reduxjs/toolkit/query/react';
import { useTranslation } from 'react-i18next';
import { Building2, Check, ChevronDown, Download, FileText, Lock, Receipt, ScrollText, Search, type LucideIcon } from 'lucide-react-native';

import { PDF_SHARE, PanelCard, RowDivider, useFileAction } from '@/components/dashboard/dashboardParts';
import { CARD_BORDER } from '@/components/dashboard/DashboardStats';
import { PrimaryButton, SheetModal } from '@/components/merch/merchParts';
import {
  AppText,
  EmptyState,
  GlassButton,
  GlassHeader,
  GlassInput,
  KeyboardPadding,
  PressableScale,
  Screen,
  SegmentedControl,
  Skeleton,
  SlideUp,
  ToastHost,
} from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useScrollInsets } from '@/hooks/useScreenPadding';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useToast } from '@/hooks/useToast';
import { extractApiError } from '@/lib/apiError';
import { cn } from '@/lib/cn';
import { downloadAuthedFile } from '@/lib/downloads';
import { formatEventDay } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { navigate } from '@/lib/nav';
import {
  fiscalizationDownloadEndpoint,
  useGetFiscalizationEventsQuery,
  useGetFiscalizationProfileQuery,
  useUpdateFiscalizationCompanyMutation,
  type CommissionPayer,
  type FiscalizationCompany,
  type FiscalizationEvent,
  type FiscalizationProfile,
} from '@/store/api/fiscalizareApi';
import { ticketTypesApi, useUpdateManageTicketTypeMutation, type ManageTicketType } from '@/store/api/ticketTypesApi';
import { colors } from '@/theme/colors';

type DocumentKey = 'formular' | 'tax' | 'proces';

interface FiscalDocument {
  key: DocumentKey;
  title: string;
  icon: LucideIcon;
  path: (eventId: number) => string;
  filename: string;
  needsQuantities: boolean;
}

interface QuantityPrompt {
  doc: FiscalDocument;
  eventId: number;
  ticketTypes: ManageTicketType[];
}

const EMPTY_FORM: FiscalizationCompany = {
  company_name: '',
  company_cui: '',
  company_registration_number: '',
  company_address: '',
  company_email: '',
  company_phone: '',
  company_pays_tva: true,
  company_iban: '',
  commission_paid_by: 'ORGANIZER',
};

function formFromProfile(profile: FiscalizationProfile): FiscalizationCompany {
  return {
    company_name: profile.company_name ?? '',
    company_cui: profile.company_cui ?? '',
    company_registration_number: profile.company_registration_number ?? '',
    company_address: profile.company_address ?? '',
    company_email: profile.company_email ?? '',
    company_phone: profile.company_phone ?? '',
    company_pays_tva: profile.company_pays_tva ?? true,
    company_iban: profile.company_iban ?? '',
    commission_paid_by: profile.commission_paid_by === 'BUYER' ? 'BUYER' : 'ORGANIZER',
  };
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function isValidPhone(phone: string): boolean {
  return /^0[67]\d{8}$/.test(phone.replace(/\s/g, ''));
}

function isValidIban(iban: string): boolean {
  const value = iban.replace(/\s+/g, '').toUpperCase();
  if (value.length < 15 || value.length > 34) return false;
  const moved = value.slice(4) + value.slice(0, 4);
  const converted = moved.replace(/[A-Z]/g, (ch) => String(ch.charCodeAt(0) - 55));
  let total = '';
  for (let i = 0; i < converted.length; i += 6) {
    total = (BigInt(total + converted.slice(i, i + 6)) % 97n).toString();
  }
  return BigInt(total) % 97n === 1n;
}

function eventLabel(event: FiscalizationEvent): string {
  return event.title?.trim() || event.slug || '';
}

function eventMeta(event: FiscalizationEvent, lang: string): string {
  const day = event.start_date ? formatEventDay(event.start_date, lang) : '';
  const country = event.country?.trim() ?? '';
  if (day && country) return `${day} · ${country}`;
  return day || country;
}

function commissionLabel(value: number | string | null | undefined): string {
  const parsed = Number(value ?? 0);
  const safe = Number.isFinite(parsed) ? parsed : 0;
  return `${safe.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}%`;
}

function minimumQuantity(ticketType: ManageTicketType): number {
  return Math.max(1, ticketType.sold_count || 0);
}

function EventPickerSheet({
  events,
  selectedId,
  lang,
  onSelect,
  onClose,
}: {
  events: FiscalizationEvent[];
  selectedId: number | null;
  lang: string;
  onSelect: (event: FiscalizationEvent) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const checkColor = useThemeColor(colors.primary, colors.dark.text);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return events;
    return events.filter(
      (event) => eventLabel(event).toLowerCase().includes(needle) || (event.country ?? '').toLowerCase().includes(needle),
    );
  }, [events, query]);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <KeyboardPadding>
        <View className="flex-1 justify-end bg-black/40" style={{ paddingTop: insets.top + 8 }}>
          <Pressable className="flex-1" onPress={onClose} accessibilityLabel={t('Close')} />
          <SlideUp>
            <View
              className="shrink rounded-t-[20px] bg-app-bg pt-3 dark:bg-dark-bg"
              style={{ maxHeight: height * 0.72, paddingBottom: Math.max(insets.bottom, 32) }}
            >
              <View className="mb-2 h-1 w-10 self-center rounded-full bg-black/15 dark:bg-white/20" />
              <AppText className="px-5 pb-2 font-gilroy-bold text-[18px] leading-[24px]">{t('Select an event')}</AppText>
              <View className="mx-5 mb-2 h-11 flex-row items-center gap-2 rounded-[10px] border border-app-border bg-app-surface px-3 dark:border-dark-border dark:bg-dark-surface">
                <Search size={17} color={colors.muted} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder={t('Search events by name or country')}
                  placeholderTextColor={colors.muted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  accessibilityLabel={t('Search events by name or country')}
                  textAlignVertical="center"
                  style={{ includeFontPadding: false }}
                  className="h-11 flex-1 font-gilroy text-[16px] text-primary dark:text-dark-text"
                />
              </View>
              <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}>
                {filtered.length === 0 ? (
                  <AppText className="px-5 py-6 font-gilroy-medium text-[14px] text-muted dark:text-dark-muted">{t('No events found')}</AppText>
                ) : (
                  filtered.map((event) => (
                    <PressableScale
                      key={event.id}
                      onPress={() => {
                        haptics.selection();
                        onSelect(event);
                      }}
                      accessibilityLabel={eventLabel(event)}
                      className="w-full flex-row items-center justify-between px-5 py-3"
                    >
                      <View className="flex-1 pr-3">
                        <AppText numberOfLines={1} className="font-gilroy-semibold text-[15px]">
                          {eventLabel(event)}
                        </AppText>
                        <AppText numberOfLines={1} className="font-gilroy-medium text-[12px] text-muted dark:text-dark-muted">
                          {eventMeta(event, lang)}
                        </AppText>
                      </View>
                      {event.id === selectedId ? <Check size={18} color={checkColor} /> : <View className="h-[18px] w-[18px]" />}
                    </PressableScale>
                  ))
                )}
              </ScrollView>
            </View>
          </SlideUp>
        </View>
      </KeyboardPadding>
      <ToastHost />
    </Modal>
  );
}

function QuantitySheet({
  prompt,
  onClose,
  onSaved,
}: {
  prompt: QuantityPrompt;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [updateTicketType] = useUpdateManageTicketTypeMutation();
  const [values, setValues] = useState<Record<number, string>>(() =>
    Object.fromEntries(prompt.ticketTypes.map((ticketType) => [ticketType.id, ''])),
  );
  const [saving, setSaving] = useState(false);

  const isValid = prompt.ticketTypes.every((ticketType) => {
    const value = Number(values[ticketType.id]);
    return Number.isInteger(value) && value >= minimumQuantity(ticketType);
  });

  const onSave = async () => {
    if (!isValid || saving) return;
    setSaving(true);
    try {
      await Promise.all(
        prompt.ticketTypes.map((ticketType) =>
          updateTicketType({
            ticketTypeId: ticketType.id,
            eventId: prompt.eventId,
            body: { quantity: Number(values[ticketType.id]) },
          }).unwrap(),
        ),
      );
      onSaved();
    } catch {
      toast(t("Couldn't save the number of tickets. Please try again."), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SheetModal
      visible
      onClose={onClose}
      title={t('Fill in the number of tickets')}
      footer={<PrimaryButton label={t('Save and download')} onPress={() => void onSave()} loading={saving} disabled={!isValid} />}
    >
      <AppText className="mb-4 font-gilroy-medium text-[13px] leading-5 text-muted dark:text-dark-muted">
        {t(
          "For the series on the documents, each ticket type needs a number of tickets. The number you enter also becomes the ticket's sales limit.",
        )}
      </AppText>
      <PanelCard>
        {prompt.ticketTypes.map((ticketType, index) => (
          <RowDivider key={ticketType.id} index={index}>
            <View className="flex-row items-center gap-3 py-3">
              <View className="flex-1">
                <AppText numberOfLines={2} className="font-gilroy-semibold text-[14px]">
                  {ticketType.name}
                </AppText>
                <AppText className="font-gilroy-medium text-[12px] text-muted dark:text-dark-muted">{`${t('Sold')}: ${ticketType.sold_count || 0}`}</AppText>
              </View>
              <View className="w-[120px]">
                <GlassInput
                  value={values[ticketType.id] ?? ''}
                  onChangeText={(value) => setValues((current) => ({ ...current, [ticketType.id]: value }))}
                  placeholder={`min. ${minimumQuantity(ticketType)}`}
                  keyboardType="number-pad"
                  accessibilityLabel={ticketType.name}
                />
              </View>
            </View>
          </RowDivider>
        ))}
      </PanelCard>
    </SheetModal>
  );
}

function DocumentRow({
  doc,
  disabled,
  busy,
  onPress,
}: {
  doc: FiscalDocument;
  disabled: boolean;
  busy: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const cardBorder = useThemeColor(CARD_BORDER, colors.dark.border);
  const iconTint = useThemeColor(colors.primary, colors.dark.text);
  const downloadTint = useThemeColor(colors.white, colors.primary);
  const Icon = doc.icon;

  return (
    <View
      className="flex-row items-center gap-3 rounded-[12px] border bg-white p-4 dark:bg-dark-surface"
      style={{ borderColor: cardBorder }}
    >
      <View className="h-10 w-10 items-center justify-center rounded-full bg-black/[0.04] dark:bg-white/10">
        <Icon size={18} color={iconTint} />
      </View>
      <AppText numberOfLines={2} className="flex-1 font-gilroy-semibold text-[14px]">
        {doc.title}
      </AppText>
      <PressableScale
        onPress={onPress}
        disabled={disabled || busy}
        accessibilityLabel={`${t('Download')} ${doc.title}`}
        className={cn(
          'h-10 flex-row items-center gap-1.5 rounded-full bg-primary px-4 dark:bg-white',
          (disabled || busy) && 'opacity-40',
        )}
      >
        <Download size={15} color={downloadTint} />
        <AppText className="font-gilroy-semibold text-[13px] text-white dark:text-primary">
          {busy ? t('Downloading...') : t('Download')}
        </AppText>
      </PressableScale>
    </View>
  );
}

function FormSkeleton() {
  return (
    <View className="gap-4">
      {Array.from({ length: 7 }, (_, index) => (
        <View key={index} className="gap-1.5">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-12 w-full rounded-[10px]" />
        </View>
      ))}
      <Skeleton className="h-12 w-full rounded-[12px]" />
      <Skeleton className="h-36 w-full rounded-[12px]" />
    </View>
  );
}

export default function FiscalizareScreen() {
  const { t, i18n } = useTranslation();
  const scroll = useScrollInsets();
  const toast = useToast();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const cardBorder = useThemeColor(CARD_BORDER, colors.dark.border);
  const switchTrackOff = useThemeColor(colors.border, colors.dark.border);

  const eventsQuery = useGetFiscalizationEventsQuery();
  const profileQuery = useGetFiscalizationProfileQuery(userId ?? skipToken);
  const [saveCompany, { isLoading: isSaving }] = useUpdateFiscalizationCompanyMutation();
  const [loadTicketTypes] = ticketTypesApi.endpoints.getManageTicketTypes.useLazyQuery();
  const { busyKey, run } = useFileAction();

  const events = useMemo(() => eventsQuery.data ?? [], [eventsQuery.data]);
  const profile = profileQuery.data;

  const [form, setForm] = useState<FiscalizationCompany>(EMPTY_FORM);
  const [isDirty, setIsDirty] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [checkingKey, setCheckingKey] = useState<DocumentKey | null>(null);
  const [quantityPrompt, setQuantityPrompt] = useState<QuantityPrompt | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current || !profile) return;
    hydratedRef.current = true;
    setForm(formFromProfile(profile));
    setIsDirty(false);
  }, [profile]);

  const selectedEvent = events.find((event) => event.id === selectedEventId) ?? events[0] ?? null;

  const updateField = useCallback(<K extends keyof FiscalizationCompany>(key: K, value: FiscalizationCompany[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setIsDirty(true);
  }, []);

  const isCompanyComplete = Boolean(
    form.company_name.trim() &&
      form.company_cui.trim() &&
      form.company_address.trim() &&
      form.company_email.trim() &&
      form.company_phone.trim() &&
      form.company_iban.trim(),
  );
  const canDownload = Boolean(selectedEvent) && isCompanyComplete && !isDirty;

  const documents: FiscalDocument[] = [
    {
      key: 'formular',
      title: t('Ticket registration forms'),
      icon: FileText,
      path: fiscalizationDownloadEndpoint.formular,
      filename: 'formular_inregistrare_bilete.pdf',
      needsQuantities: true,
    },
    {
      key: 'tax',
      title: t('Entertainment tax declaration'),
      icon: ScrollText,
      path: fiscalizationDownloadEndpoint.taxDeclaration,
      filename: 'declaratie_impozit_spectacole.pdf',
      needsQuantities: false,
    },
    {
      key: 'proces',
      title: t('Report (proces-verbal)'),
      icon: Receipt,
      path: fiscalizationDownloadEndpoint.procesVerbal,
      filename: 'proces_verbal.pdf',
      needsQuantities: true,
    },
  ];

  const onSave = async () => {
    if (userId == null) return;
    haptics.selection();
    if (!isValidEmail(form.company_email)) {
      toast(t('Please enter a valid email address.'), 'error');
      return;
    }
    if (!isValidPhone(form.company_phone)) {
      toast(t('Please enter a valid phone number.'), 'error');
      return;
    }
    if (!isValidIban(form.company_iban)) {
      toast(t('Please enter a valid IBAN.'), 'error');
      return;
    }
    try {
      await saveCompany({
        id: userId,
        company: { ...form, company_phone: form.company_phone.replace(/\s/g, '') },
      }).unwrap();
      setIsDirty(false);
      toast(t('Company information updated successfully.'), 'success');
    } catch (error) {
      toast(extractApiError(error) ?? t('Failed to update company information. Please try again.'), 'error');
    }
  };

  const startDownload = (doc: FiscalDocument, eventId: number) =>
    void run(
      doc.key,
      (token) => downloadAuthedFile(doc.path(eventId), token, doc.filename),
      { ...PDF_SHARE, dialogTitle: t('Download') },
      { error: t('Failed to download the document. Please try again.') },
    );

  const onDownload = async (doc: FiscalDocument) => {
    if (!selectedEvent) {
      toast(t('Please select an event first.'), 'error');
      return;
    }
    if (busyKey || checkingKey) return;
    const eventId = selectedEvent.id;
    if (doc.needsQuantities) {
      setCheckingKey(doc.key);
      const ticketTypes = await loadTicketTypes(eventId)
        .unwrap()
        .catch((): ManageTicketType[] => []);
      setCheckingKey(null);
      const missing = ticketTypes.filter((ticketType) => ticketType.quantity === null);
      if (missing.length > 0) {
        setQuantityPrompt({ doc, eventId, ticketTypes: missing });
        return;
      }
    }
    startDownload(doc, eventId);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const [, profileResult] = await Promise.all([
        eventsQuery.refetch(),
        userId != null ? profileQuery.refetch() : Promise.resolve(null),
      ]);
      if (profileResult?.data && !isDirty) setForm(formFromProfile(profileResult.data));
    } finally {
      setRefreshing(false);
    }
  };

  const loadFailed = (eventsQuery.isError && !eventsQuery.data) || (profileQuery.isError && !profileQuery.data);
  const profileLoading = userId == null || profileQuery.isLoading;

  const renderEventSelector = () => {
    if (eventsQuery.isLoading) return <Skeleton className="h-[74px] w-full rounded-[12px]" />;
    if (events.length === 0) {
      return (
        <View className="rounded-[12px] border bg-white p-4 dark:bg-dark-surface" style={{ borderColor: cardBorder }}>
          <AppText className="font-gilroy-medium text-[13px] text-muted dark:text-dark-muted">
            {t('No events available for fiscalization yet.')}
          </AppText>
        </View>
      );
    }
    return (
      <PressableScale
        onPress={() => {
          haptics.light();
          setPickerOpen(true);
        }}
        accessibilityLabel={selectedEvent ? `${t('Selected event')}: ${eventLabel(selectedEvent)}` : t('Select an event')}
        className="flex-row items-center justify-between rounded-[12px] border bg-white p-4 dark:bg-dark-surface"
        style={{ borderColor: cardBorder }}
      >
        <View className="flex-1 pr-3">
          <AppText numberOfLines={1} className="font-gilroy-semibold text-[15px]">
            {selectedEvent ? eventLabel(selectedEvent) : t('Select an event')}
          </AppText>
          {selectedEvent ? (
            <AppText numberOfLines={1} className="font-gilroy-medium text-[12px] text-muted dark:text-dark-muted">
              {eventMeta(selectedEvent, i18n.language)}
            </AppText>
          ) : null}
        </View>
        <ChevronDown size={18} color={colors.muted} />
      </PressableScale>
    );
  };

  const renderCompanyForm = () => (
    <View className="gap-4">
      <GlassInput
        label={t('Company name')}
        value={form.company_name}
        onChangeText={(value) => updateField('company_name', value)}
        placeholder="Corporation SRL"
      />
      <GlassInput
        label={t('CUI')}
        value={form.company_cui}
        onChangeText={(value) => updateField('company_cui', value)}
        placeholder="RO12345678"
        autoCapitalize="characters"
      />
      <GlassInput
        label={t('Registration number')}
        value={form.company_registration_number}
        onChangeText={(value) => updateField('company_registration_number', value)}
        placeholder="J29/1234/2020"
      />
      <GlassInput
        label={t('Company address')}
        value={form.company_address}
        onChangeText={(value) => updateField('company_address', value)}
        placeholder="Str. Exemplu nr. 1, Bucuresti"
      />
      <GlassInput
        label={t('Company email')}
        value={form.company_email}
        onChangeText={(value) => updateField('company_email', value)}
        placeholder="contact@company.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
      />
      <GlassInput
        label={t('Company phone')}
        value={form.company_phone}
        onChangeText={(value) => updateField('company_phone', value)}
        placeholder="0712345678"
        keyboardType="phone-pad"
        autoCapitalize="none"
      />
      <GlassInput
        label={t('IBAN')}
        value={form.company_iban}
        onChangeText={(value) => updateField('company_iban', value)}
        placeholder="RO00BANK0000000000000000"
        autoCapitalize="characters"
        autoCorrect={false}
      />

      <View
        className="flex-row items-center justify-between rounded-[12px] border bg-white px-4 py-3 dark:bg-dark-surface"
        style={{ borderColor: cardBorder }}
      >
        <AppText className="font-gilroy-semibold text-[14px]">{t('Company pays VAT')}</AppText>
        <Switch
          value={form.company_pays_tva}
          onValueChange={(value) => {
            haptics.selection();
            updateField('company_pays_tva', value);
          }}
          accessibilityLabel={t('Company pays VAT')}
          trackColor={{ false: switchTrackOff, true: colors.accent }}
          thumbColor={colors.white}
          ios_backgroundColor={switchTrackOff}
        />
      </View>

      <View className="gap-3 rounded-[12px] border bg-white p-4 dark:bg-dark-surface" style={{ borderColor: cardBorder }}>
        <View className="flex-row items-center justify-between">
          <AppText className="flex-1 pr-3 font-gilroy-semibold text-[14px]">{t('Who pays the platform commission')}</AppText>
          <View
            accessible
            accessibilityLabel={`${t('Your Eventino commission')}: ${commissionLabel(profile?.eventino_commission_percent)}`}
            accessibilityHint={t('The percentage is set by your contract and cannot be changed here.')}
            className="flex-row items-center gap-1 rounded-full bg-black/[0.04] px-2.5 py-1 dark:bg-white/10"
          >
            <AppText className="font-gilroy-semibold text-[12px] text-muted dark:text-dark-muted">{t('Your rate')}</AppText>
            <AppText className="font-gilroy-bold text-[12px] text-primary dark:text-dark-text">
              {commissionLabel(profile?.eventino_commission_percent)}
            </AppText>
            <Lock size={11} color={colors.muted} />
          </View>
        </View>
        <AppText className="font-gilroy-medium text-[12px] leading-4 text-muted dark:text-dark-muted">
          {t('Applies to all your events. The commission is retained by the platform according to your contract.')}
        </AppText>
        <SegmentedControl<CommissionPayer>
          value={form.commission_paid_by}
          onChange={(value) => updateField('commission_paid_by', value)}
          options={[
            { value: 'ORGANIZER', label: t('Organizer pays') },
            { value: 'BUYER', label: t('Buyer pays') },
          ]}
        />
        <AppText className="font-gilroy-medium text-[12px] leading-4 text-muted dark:text-dark-muted">
          {form.commission_paid_by === 'ORGANIZER'
            ? t('The commission is deducted from the amount collected by the organizer.')
            : t('The commission is added on top of the price shown to the buyer.')}
        </AppText>
      </View>

      <GlassButton label={t('Save')} onPress={() => void onSave()} loading={isSaving} />
    </View>
  );

  const renderBody = () => {
    if (loadFailed) {
      return (
        <EmptyState
          icon={Receipt}
          title={t('Something went wrong.')}
          message={t('Please try again.')}
          actionLabel={t('Try again')}
          onAction={() => {
            void eventsQuery.refetch();
            if (userId != null) void profileQuery.refetch();
          }}
        />
      );
    }
    return (
      <>
        <AppText className="pb-4 font-gilroy-medium text-[13px] leading-5 text-muted dark:text-dark-muted">
          {t(
            'Fill in your company details, pick an event, then download the Romanian fiscalization documents to file with the local tax authority.',
          )}
        </AppText>

        <View className="pb-2">
          <AppText className="pb-1.5 font-gilroy-medium text-[13px] text-primary/70 dark:text-dark-text/70">
            {t('Selected event')}
          </AppText>
          {renderEventSelector()}
        </View>

        <View className="pt-4">
          <View className="flex-row items-center gap-2 pb-1">
            <Building2 size={18} color={colors.accent} />
            <AppText className="font-gilroy-bold text-[17px]">{t('Company information')}</AppText>
          </View>
          <AppText className="pb-3 font-gilroy-medium text-[13px] leading-5 text-muted dark:text-dark-muted">
            {t('Fill in your company details to generate the fiscalization documents.')}
          </AppText>
          {profileLoading ? <FormSkeleton /> : renderCompanyForm()}
        </View>

        <View className="pt-6">
          <AppText className="pb-1 font-gilroy-bold text-[17px]">{t('Ticket registration')}</AppText>
          <AppText className="pb-3 font-gilroy-medium text-[13px] leading-5 text-muted dark:text-dark-muted">
            {t('These documents must be filed by the event date at the Local Taxes Office for the event location.')}
          </AppText>
          <View className="gap-2.5">
            {documents.map((doc) => (
              <DocumentRow
                key={doc.key}
                doc={doc}
                disabled={!canDownload || profileLoading}
                busy={busyKey === doc.key || checkingKey === doc.key}
                onPress={() => void onDownload(doc)}
              />
            ))}
          </View>
          {!canDownload && !profileLoading && !eventsQuery.isLoading ? (
            <AppText className="pt-3 font-gilroy-medium text-[12px] leading-4 text-danger dark:text-danger">
              {!selectedEvent
                ? t('Please select an event first.')
                : !isCompanyComplete
                  ? t('Please fill in all company information before downloading documents.')
                  : t('Save your company information before downloading documents.')}
            </AppText>
          ) : null}
        </View>
      </>
    );
  };

  return (
    <Screen edges={[]}>
      <GlassHeader title={t('Fiscalizare Bilete')} onBack={navigate.back} />
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
        {renderBody()}
      </KeyboardAwareScrollView>

      {pickerOpen ? (
        <EventPickerSheet
          events={events}
          selectedId={selectedEvent?.id ?? null}
          lang={i18n.language}
          onSelect={(event) => {
            setSelectedEventId(event.id);
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
        />
      ) : null}

      {quantityPrompt ? (
        <QuantitySheet
          prompt={quantityPrompt}
          onClose={() => setQuantityPrompt(null)}
          onSaved={() => {
            const { doc, eventId } = quantityPrompt;
            setQuantityPrompt(null);
            startDownload(doc, eventId);
          }}
        />
      ) : null}
    </Screen>
  );
}
