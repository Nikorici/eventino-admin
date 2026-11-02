import { useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, TextInput, useWindowDimensions, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import * as ImagePicker from 'expo-image-picker';
import { format, isValid, parse } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { Calendar, Clock, Eye, Image as ImageIcon, Lock, Paperclip, RefreshCcw, Send, Ticket, Trash2, Users, X } from 'lucide-react-native';

import { cn } from '@/lib/cn';
import { dateFnsLocale } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { colors } from '@/theme/colors';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useToast } from '@/hooks/useToast';
import {
  useGetEmailPreviewMutation,
  useScheduleGroupEmailMutation,
  useSendEmailToTicketHoldersMutation,
  useUpdateScheduledEmailMutation,
  type GroupEmailAttachment,
  type ScheduledEmail,
} from '@/store/api/messageSubscribersApi';
import { AppText, Chip, GlassButton, GlassInput, PressableScale, SegmentedControl, ToastHost } from '@/components/ui';

import {
  composeEmailHtml,
  DEFAULT_CTA,
  hasEmailBody,
  htmlToText,
  normalizeRadius,
  normalizeUrl,
  parseEmailHtml,
  type CtaButton,
} from './emailHtml';

const HOURS_BEFORE_EVENT_OPTIONS = [1, 3, 8, 24, 48] as const;

export type SendMode = 'now' | 'schedule';
type ScheduleType = 'date_time' | 'event_offset';

export interface ScheduleableEvent {
  id: number;
  name: string;
  startAt: Date;
}

export type ComposeAudience =
  | { kind: 'followers'; recipients: number[]; filterLabels: string[] }
  | { kind: 'ticketTypes'; eventId: number | null; ticketTypeIds: number[]; ticketTypeNames: string[]; recipientCount: number };

export interface ComposeEmailSheetProps {
  audience: ComposeAudience;
  editing: ScheduledEmail | null;
  scheduleableEvents: ScheduleableEvent[];
  initialSendMode: SendMode;
  defaultScheduleEventId: number | null;
  onClose: () => void;
}

interface CtaDraft {
  label: string;
  url: string;
  bg: string;
  color: string;
  radius: string;
}

const BLANK_CTA_DRAFT: CtaDraft = { label: '', url: '', bg: DEFAULT_CTA.bg, color: DEFAULT_CTA.color, radius: '12' };

function ToolChip({
  label,
  icon,
  onPress,
  active,
  disabled,
}: {
  label: string;
  icon: ReactNode;
  onPress: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <PressableScale
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      disabled={disabled}
      accessibilityLabel={label}
      className={cn(
        'h-8 flex-row items-center gap-1.5 rounded-full border px-3',
        active
          ? 'border-primary bg-primary/10 dark:border-white dark:bg-white/20'
          : 'border-app-border bg-app-surface dark:border-dark-border dark:bg-dark-surface',
        disabled && 'opacity-50',
      )}
    >
      {icon}
      <AppText className="font-gilroy-semibold text-[13px] leading-[17px]">{label}</AppText>
    </PressableScale>
  );
}

function RemovableTag({ label, onRemove, removeLabel }: { label: string; onRemove: () => void; removeLabel: string }) {
  return (
    <View className="h-7 max-w-full flex-row items-center gap-1 rounded-full bg-black/[0.04] pl-2.5 pr-1.5 dark:bg-white/10">
      <AppText numberOfLines={1} className="shrink font-gilroy-semibold text-[12px] leading-[16px] text-primary/80 dark:text-dark-text/80">
        {label}
      </AppText>
      <Pressable onPress={onRemove} accessibilityLabel={removeLabel} className="h-[18px] w-[18px] items-center justify-center">
        <X size={12} color={colors.muted} />
      </Pressable>
    </View>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (next: string) => void }) {
  return (
    <View className="flex-1">
      <GlassInput
        label={label}
        value={value}
        onChangeText={onChange}
        autoCapitalize="none"
        autoCorrect={false}
        leftIcon={<View className="h-4 w-4 rounded-full border border-app-border dark:border-dark-border" style={{ backgroundColor: value }} />}
      />
    </View>
  );
}

function initialScheduleParts(editing: ScheduledEmail | null): { date: string; time: string } {
  if (!editing?.scheduled_for) return { date: '', time: '' };
  const parsed = new Date(editing.scheduled_for);
  if (Number.isNaN(parsed.getTime())) return { date: '', time: '' };
  return { date: format(parsed, 'yyyy-MM-dd'), time: format(parsed, 'HH:mm') };
}

export function ComposeEmailSheet({
  audience,
  editing,
  scheduleableEvents,
  initialSendMode,
  defaultScheduleEventId,
  onClose,
}: ComposeEmailSheetProps) {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const isEditing = Boolean(editing);
  const submitTint = useThemeColor(colors.white, colors.primary);
  const iconTint = useThemeColor(colors.primary, colors.dark.text);
  const { height: windowHeight } = useWindowDimensions();

  const initialParts = useMemo(() => parseEmailHtml(editing?.message ?? ''), [editing]);
  const initialHtml = useMemo(() => composeEmailHtml(initialParts), [initialParts]);
  const initialSchedule = useMemo(() => initialScheduleParts(editing), [editing]);

  const [subject, setSubject] = useState(editing?.subject ?? '');
  const [text, setText] = useState(initialParts.text);
  const [buttons, setButtons] = useState<CtaButton[]>(initialParts.buttons);
  const [images, setImages] = useState<string[]>(initialParts.images);
  const [attachments, setAttachments] = useState<GroupEmailAttachment[]>(editing?.attachments ?? []);
  const [sendMode, setSendMode] = useState<SendMode>(isEditing ? 'schedule' : initialSendMode);
  const [scheduleType, setScheduleType] = useState<ScheduleType>('date_time');
  const [scheduledDate, setScheduledDate] = useState(initialSchedule.date);
  const [scheduledTime, setScheduledTime] = useState(initialSchedule.time);
  const [scheduledEventId, setScheduledEventId] = useState<number | null>(
    scheduleableEvents.some((event) => event.id === defaultScheduleEventId) ? defaultScheduleEventId : null,
  );
  const [scheduledHoursBefore, setScheduledHoursBefore] = useState<number>(24);
  const [ctaOpen, setCtaOpen] = useState(false);
  const [ctaDraft, setCtaDraft] = useState<CtaDraft>(BLANK_CTA_DRAFT);
  const [ctaError, setCtaError] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewSignature, setPreviewSignature] = useState('');
  const [previewError, setPreviewError] = useState('');

  const [scheduleGroupEmail, { isLoading: scheduling }] = useScheduleGroupEmailMutation();
  const [updateScheduledEmail, { isLoading: updating }] = useUpdateScheduledEmailMutation();
  const [sendToTicketHolders, { isLoading: sendingToHolders }] = useSendEmailToTicketHoldersMutation();
  const [getEmailPreview, { isLoading: previewLoading }] = useGetEmailPreviewMutation();
  const sending = scheduling || updating || sendingToHolders;

  const parts = { text, buttons, images };
  const composedHtml = composeEmailHtml(parts);
  const messageHtml = editing && composedHtml === initialHtml ? editing.message : composedHtml;
  const signature = `${subject.trim()}|||${messageHtml}`;
  const previewStale = previewOpen && previewHtml !== '' && signature !== previewSignature;
  const canPreview = subject.trim().length > 0 && hasEmailBody(parts);

  const recipientCount = editing
    ? editing.recipient_count
    : audience.kind === 'followers'
      ? audience.recipients.length
      : audience.recipientCount;
  const offsetEnabled = !isEditing && scheduleableEvents.length > 0;
  const missingSchedule =
    sendMode === 'schedule' &&
    ((scheduleType === 'date_time' || !offsetEnabled ? !scheduledDate || !scheduledTime : scheduledEventId == null));
  const submitDisabled = !subject.trim() || missingSchedule;

  const selectedScheduleEvent = useMemo(
    () => scheduleableEvents.find((event) => event.id === scheduledEventId) ?? null,
    [scheduleableEvents, scheduledEventId],
  );

  const relativeScheduledAt = useMemo(() => {
    if (!selectedScheduleEvent) return null;
    return new Date(selectedScheduleEvent.startAt.getTime() - scheduledHoursBefore * 60 * 60 * 1000);
  }, [selectedScheduleEvent, scheduledHoursBefore]);

  const formatDateTime = (date: Date) => format(date, 'd MMM yyyy, HH:mm', { locale: dateFnsLocale(i18n.language) });

  const recipientsLabel = (() => {
    if (editing) return t('{{count}} recipients (locked)', { count: recipientCount });
    if (audience.kind === 'ticketTypes') {
      if (audience.ticketTypeIds.length === 0) return t('No recipients selected');
      return `${t('{{count}} recipients', { count: recipientCount })} · ${audience.ticketTypeNames.join(', ')}`;
    }
    if (recipientCount === 0) return t('No recipients selected');
    if (audience.filterLabels.length > 0) return `${t('{{count}} recipients', { count: recipientCount })} · ${audience.filterLabels.join(', ')}`;
    return t('{{count}} recipients', { count: recipientCount });
  })();

  const generatePreview = async () => {
    setPreviewError('');
    try {
      const response = await getEmailPreview({ subject: subject.trim(), message: messageHtml }).unwrap();
      if (!response.html) throw new Error('empty preview');
      setPreviewHtml(response.html);
      setPreviewSignature(signature);
    } catch {
      setPreviewHtml('');
      setPreviewError(t('Unable to generate preview. Please try again.'));
    }
  };

  const togglePreview = () => {
    if (previewOpen) {
      setPreviewOpen(false);
      setPreviewHtml('');
      setPreviewSignature('');
      setPreviewError('');
      return;
    }
    if (!subject.trim()) {
      setPreviewError(t('Subject is required to preview the email.'));
      return;
    }
    if (!hasEmailBody(parts)) {
      setPreviewError(t('Message body is required to preview the email.'));
      return;
    }
    setPreviewOpen(true);
    void generatePreview();
  };

  const pickAttachments = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      toast(t('Please try again.'), 'error');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      base64: true,
      quality: 0.85,
    });
    if (result.canceled) return;
    const picked = result.assets.map((asset, index) => {
      const contentType = asset.mimeType ?? 'image/jpeg';
      return {
        name: asset.fileName ?? `image-${Date.now()}-${index + 1}.jpg`,
        content: asset.base64 ? `data:${contentType};base64,${asset.base64}` : asset.uri,
        content_type: contentType,
      };
    });
    setAttachments((previous) => [...previous, ...picked]);
  };

  const insertCta = () => {
    const label = ctaDraft.label.trim();
    const url = ctaDraft.url.trim();
    if (!label || !url) {
      setCtaError(t('Add button text and URL.'));
      return;
    }
    setCtaError('');
    setButtons((previous) => [
      ...previous,
      {
        ...DEFAULT_CTA,
        label,
        url: normalizeUrl(url),
        bg: ctaDraft.bg.trim() || DEFAULT_CTA.bg,
        color: ctaDraft.color.trim() || DEFAULT_CTA.color,
        radius: normalizeRadius(ctaDraft.radius),
      },
    ]);
    setCtaDraft((draft) => ({ ...draft, label: '', url: '' }));
  };

  const resolveScheduledFor = (): Date | null => {
    if (sendMode !== 'schedule') return new Date();
    if (scheduleType === 'event_offset' && offsetEnabled) {
      if (scheduledEventId == null) {
        toast(t('Select an event for relative scheduling.'), 'error');
        return null;
      }
      const chosen = scheduleableEvents.find((event) => event.id === scheduledEventId);
      if (!chosen) {
        toast(t('Selected event could not be found.'), 'error');
        return null;
      }
      const at = new Date(chosen.startAt.getTime() - scheduledHoursBefore * 60 * 60 * 1000);
      if (at <= new Date()) {
        toast(t('The selected offset results in a past time. Choose another option.'), 'error');
        return null;
      }
      return at;
    }
    if (!scheduledDate || !scheduledTime) {
      toast(t('Select a date and time to schedule.'), 'error');
      return null;
    }
    const parsed = parse(`${scheduledDate} ${scheduledTime}`, 'yyyy-MM-dd HH:mm', new Date());
    if (!isValid(parsed)) {
      toast(t('Invalid date or time.'), 'error');
      return null;
    }
    if (parsed <= new Date()) {
      toast(t('Scheduled time must be in the future.'), 'error');
      return null;
    }
    return parsed;
  };

  const submit = async () => {
    haptics.light();
    if (!subject.trim()) {
      toast(t('Subject is required.'), 'error');
      return;
    }
    if (!editing && audience.kind === 'ticketTypes') {
      if (audience.eventId == null) {
        toast(t('Please select an event first.'), 'error');
        return;
      }
      if (audience.ticketTypeIds.length === 0) {
        toast(t('Please select at least one ticket type.'), 'error');
        return;
      }
    }
    if (!editing && audience.kind === 'followers' && audience.recipients.length === 0) {
      toast(t('No recipients found. Please select subscribers, events, or categories.'), 'error');
      return;
    }
    const scheduledFor = resolveScheduledFor();
    if (!scheduledFor) return;
    const scheduledForIso = scheduledFor.toISOString().replace('Z', '+00:00');
    const isScheduled = sendMode === 'schedule';

    try {
      if (editing) {
        await updateScheduledEmail({
          id: editing.id,
          subject: subject.trim(),
          message: messageHtml,
          scheduled_for: scheduledForIso,
          attachments,
        }).unwrap();
        haptics.success();
        toast(t('Schedule updated for {{count}} recipients', { count: recipientCount }), 'success');
      } else if (audience.kind === 'ticketTypes' && audience.eventId != null) {
        const result = await sendToTicketHolders({
          event_id: audience.eventId,
          ticket_type_ids: audience.ticketTypeIds,
          subject: subject.trim(),
          message: messageHtml,
          attachments,
          scheduled_for: isScheduled ? scheduledForIso : '',
        }).unwrap();
        const sentCount = result.total_recipients || recipientCount;
        haptics.success();
        toast(
          isScheduled
            ? t('Email scheduled for {{count}} recipients', { count: sentCount })
            : t('Email sent to {{count}} recipients', { count: sentCount }),
          'success',
        );
      } else if (audience.kind === 'followers') {
        await scheduleGroupEmail({
          recipients: audience.recipients,
          subject: subject.trim(),
          message: messageHtml,
          scheduled_for: scheduledForIso,
          attachments,
        }).unwrap();
        haptics.success();
        toast(
          isScheduled
            ? t('Email scheduled for {{count}} recipients', { count: recipientCount })
            : t('Email sent to {{count}} recipients', { count: recipientCount }),
          'success',
        );
      }
      onClose();
    } catch {
      haptics.error();
      toast(
        isScheduled ? t('Unable to schedule email. Please try again.') : t('Authentication failed or server error. Please try again.'),
        'error',
      );
    }
  };

  const submitLabel = sendMode === 'schedule' ? (isEditing ? t('Update Schedule') : t('Schedule email')) : t('Send email');

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <Pressable className="flex-1" onPress={onClose} accessibilityLabel={t('Close')} />
        <KeyboardAvoidingView behavior="padding">
          <View className="rounded-t-[24px] bg-app-bg px-5 pb-10 pt-4 dark:bg-dark-bg" style={{ maxHeight: windowHeight - 108 }}>
            <View className="mb-4 flex-row items-center justify-between">
              <AppText className="flex-1 pr-3 font-gilroy-bold text-[20px] leading-[26px]">
                {isEditing ? t('Edit Scheduled Email') : t('New Message')}
              </AppText>
              <Pressable
                onPress={onClose}
                accessibilityLabel={t('Close')}
                className="h-9 w-9 items-center justify-center rounded-full bg-black/[0.04] dark:bg-white/10"
              >
                <X size={18} color={colors.muted} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View className="gap-4 pb-2">
                <View className="flex-row items-center gap-2 rounded-[10px] border border-app-border bg-app-surface px-3 py-2.5 dark:border-dark-border dark:bg-dark-surface">
                  {isEditing ? (
                    <Lock size={15} color={colors.muted} />
                  ) : audience.kind === 'ticketTypes' ? (
                    <Ticket size={15} color={colors.muted} />
                  ) : (
                    <Users size={15} color={colors.muted} />
                  )}
                  <AppText className="font-gilroy-semibold text-[13px] leading-[17px] text-muted dark:text-dark-muted">{t('To')}</AppText>
                  <AppText numberOfLines={1} className="flex-1 font-gilroy-medium text-[13px] leading-[17px]">
                    {recipientsLabel}
                  </AppText>
                </View>

                <GlassInput
                  label={t('Subject')}
                  placeholder={t('Email subject')}
                  value={subject}
                  onChangeText={setSubject}
                  editable={!sending}
                />

                <View className="gap-1.5">
                  <AppText className="font-gilroy-medium text-[13px] leading-[17px] text-primary/70 dark:text-dark-text/70">{t('Message')}</AppText>
                  <View className="rounded-[10px] border border-app-border bg-app-surface px-3 py-3 dark:border-dark-border dark:bg-dark-surface">
                    <TextInput
                      placeholder={t('Write your message...')}
                      placeholderTextColor={colors.muted}
                      value={text}
                      onChangeText={setText}
                      editable={!sending}
                      multiline
                      textAlignVertical="top"
                      accessibilityLabel={t('Message')}
                      className="min-h-[110px] font-gilroy text-base leading-[22px] text-primary dark:text-dark-text"
                    />
                  </View>
                </View>

                <View className="gap-2">
                  <View className="flex-row flex-wrap gap-2">
                    <ToolChip
                      label={t('Attach')}
                      icon={<Paperclip size={14} color={iconTint} />}
                      onPress={() => {
                        void pickAttachments();
                      }}
                      disabled={sending}
                    />
                    <ToolChip
                      label={t('Button')}
                      active={ctaOpen}
                      icon={
                        <View className="rounded-[4px] bg-black/[0.04] px-1 py-px dark:bg-white/10">
                          <AppText className="font-gilroy-extrabold text-[10px] leading-[13px]">CTA</AppText>
                        </View>
                      }
                      onPress={() => setCtaOpen((open) => !open)}
                      disabled={sending}
                    />
                    <ToolChip
                      label={previewOpen ? t('Hide Preview') : t('Preview Email')}
                      active={previewOpen}
                      icon={<Eye size={14} color={iconTint} />}
                      onPress={togglePreview}
                      disabled={sending || previewLoading || (!previewOpen && !canPreview)}
                    />
                    {images.length > 0 ? (
                      <View className="h-8 flex-row items-center gap-1.5 rounded-full border border-app-border bg-app-surface pl-3 pr-1 dark:border-dark-border dark:bg-dark-surface">
                        <ImageIcon size={14} color={iconTint} />
                        <AppText className="font-gilroy-semibold text-[13px] leading-[17px]">
                          {`${images.length} ${t(images.length === 1 ? 'image' : 'images')}`}
                        </AppText>
                        <Pressable
                          onPress={() => setImages([])}
                          disabled={sending}
                          accessibilityLabel={t('Remove all images')}
                          className="h-6 w-6 items-center justify-center"
                        >
                          <Trash2 size={12} color={colors.danger} />
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                  {attachments.length > 0 || buttons.length > 0 ? (
                    <View className="flex-row flex-wrap gap-2">
                      {attachments.map((file, index) => (
                        <RemovableTag
                          key={`${file.name}-${index}`}
                          label={file.name}
                          removeLabel={t('Remove attachment')}
                          onRemove={() => setAttachments((previous) => previous.filter((_, itemIndex) => itemIndex !== index))}
                        />
                      ))}
                      {buttons.map((button, index) => (
                        <RemovableTag
                          key={`${button.url}-${index}`}
                          label={`CTA · ${button.label}`}
                          removeLabel={t('Remove')}
                          onRemove={() => setButtons((previous) => previous.filter((_, itemIndex) => itemIndex !== index))}
                        />
                      ))}
                    </View>
                  ) : null}
                </View>

                {ctaOpen ? (
                  <View className="gap-3 rounded-[12px] border border-app-border bg-app-surface p-3 dark:border-dark-border dark:bg-dark-surface">
                    <GlassInput
                      label={t('Button text')}
                      placeholder={t('E.g. View Details')}
                      value={ctaDraft.label}
                      onChangeText={(label) => setCtaDraft((draft) => ({ ...draft, label }))}
                    />
                    <GlassInput
                      label={t('Link URL')}
                      placeholder="https://..."
                      value={ctaDraft.url}
                      onChangeText={(url) => setCtaDraft((draft) => ({ ...draft, url }))}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="url"
                    />
                    <View className="flex-row gap-2">
                      <ColorField label={t('BG')} value={ctaDraft.bg} onChange={(bg) => setCtaDraft((draft) => ({ ...draft, bg }))} />
                      <ColorField label={t('Text')} value={ctaDraft.color} onChange={(color) => setCtaDraft((draft) => ({ ...draft, color }))} />
                      <View className="w-[72px]">
                        <GlassInput
                          label={t('Radius')}
                          value={ctaDraft.radius}
                          onChangeText={(radius) => setCtaDraft((draft) => ({ ...draft, radius }))}
                          autoCapitalize="none"
                        />
                      </View>
                    </View>
                    {ctaError ? <AppText className="font-gilroy-medium text-[12px] leading-[16px] text-danger dark:text-danger">{ctaError}</AppText> : null}
                    <GlassButton label={t('Insert')} variant="secondary" size="sm" onPress={insertCta} />
                  </View>
                ) : null}

                {previewError ? <AppText className="font-gilroy-medium text-[13px] leading-[17px] text-danger dark:text-danger">{previewError}</AppText> : null}

                {previewOpen ? (
                  <View className="gap-3 rounded-[12px] border border-app-border bg-app-surface p-3 dark:border-dark-border dark:bg-dark-surface">
                    <View className="flex-row items-center justify-between gap-2">
                      <View className="flex-row items-center gap-1.5">
                        <Eye size={16} color={iconTint} />
                        <AppText className="font-gilroy-semibold text-[14px] leading-[19px]">{t('Email Preview')}</AppText>
                      </View>
                      {previewStale ? (
                        <ToolChip
                          label={t('Refresh Preview')}
                          icon={<RefreshCcw size={14} color={iconTint} />}
                          onPress={() => {
                            void generatePreview();
                          }}
                          disabled={previewLoading}
                        />
                      ) : null}
                    </View>
                    {previewLoading ? (
                      <View className="flex-row items-center gap-2 py-4">
                        <ActivityIndicator size="small" color={colors.muted} />
                        <AppText className="font-gilroy-medium text-[13px] leading-[17px] text-muted dark:text-dark-muted">{t('Generating preview...')}</AppText>
                      </View>
                    ) : previewHtml ? (
                      <View className="gap-2">
                        {previewStale ? (
                          <AppText className="font-gilroy-medium text-[12px] leading-[16px] text-muted dark:text-dark-muted">
                            {t('Content changed. Refresh to sync the preview.')}
                          </AppText>
                        ) : null}
                        <View className="rounded-[10px] bg-white p-3 dark:bg-dark-elevated">
                          <AppText className="font-gilroy text-[14px] leading-[20px]">{htmlToText(previewHtml)}</AppText>
                        </View>
                      </View>
                    ) : (
                      <AppText className="py-2 font-gilroy-medium text-[13px] leading-[17px] text-muted dark:text-dark-muted">
                        {t('Generate a preview to see the final layout')}
                      </AppText>
                    )}
                  </View>
                ) : null}

                {isEditing ? null : (
                  <View className="gap-2">
                    <AppText className="font-gilroy-semibold text-[14px] leading-[19px]">{t('Delivery')}</AppText>
                    <SegmentedControl<SendMode>
                      value={sendMode}
                      onChange={setSendMode}
                      options={[
                        { value: 'now', label: t('Send now') },
                        { value: 'schedule', label: t('Schedule for later') },
                      ]}
                    />
                  </View>
                )}

                {sendMode === 'schedule' ? (
                  <View className="gap-3">
                    {offsetEnabled ? (
                      <SegmentedControl<ScheduleType>
                        value={scheduleType}
                        onChange={setScheduleType}
                        options={[
                          { value: 'date_time', label: t('Date & Time') },
                          { value: 'event_offset', label: t('Before Event') },
                        ]}
                      />
                    ) : null}

                    {scheduleType === 'date_time' || !offsetEnabled ? (
                      <View className="flex-row gap-3">
                        <View className="flex-1">
                          <GlassInput
                            value={scheduledDate}
                            onChangeText={setScheduledDate}
                            placeholder="YYYY-MM-DD"
                            accessibilityLabel={t('Date')}
                            keyboardType="numbers-and-punctuation"
                            autoCapitalize="none"
                            autoCorrect={false}
                            leftIcon={
                              <View className="shrink-0">
                                <Calendar size={16} color={colors.muted} />
                              </View>
                            }
                          />
                        </View>
                        <View className="flex-1">
                          <GlassInput
                            value={scheduledTime}
                            onChangeText={setScheduledTime}
                            placeholder="HH:MM"
                            accessibilityLabel={t('Time')}
                            keyboardType="numbers-and-punctuation"
                            autoCapitalize="none"
                            autoCorrect={false}
                            leftIcon={
                              <View className="shrink-0">
                                <Clock size={16} color={colors.muted} />
                              </View>
                            }
                          />
                        </View>
                      </View>
                    ) : (
                      <View className="gap-3">
                        <AppText className="font-gilroy-medium text-[13px] leading-[17px] text-primary/70 dark:text-dark-text/70">{t('Event')}</AppText>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                          {scheduleableEvents.map((event) => (
                            <Chip
                              key={event.id}
                              label={event.name}
                              selected={scheduledEventId === event.id}
                              onPress={() => setScheduledEventId(event.id)}
                            />
                          ))}
                        </ScrollView>
                        <AppText className="font-gilroy-medium text-[13px] leading-[17px] text-primary/70 dark:text-dark-text/70">{t('Send')}</AppText>
                        <View className="flex-row flex-wrap gap-2">
                          {HOURS_BEFORE_EVENT_OPTIONS.map((hours) => (
                            <Chip
                              key={hours}
                              label={t('{{count}}h before event', { count: hours })}
                              selected={scheduledHoursBefore === hours}
                              onPress={() => setScheduledHoursBefore(hours)}
                            />
                          ))}
                        </View>
                        {relativeScheduledAt ? (
                          <AppText className="font-gilroy-medium text-[12px] leading-[16px] text-muted dark:text-dark-muted">
                            {t('Will send at {{time}}', { time: formatDateTime(relativeScheduledAt) })}
                          </AppText>
                        ) : null}
                      </View>
                    )}
                  </View>
                ) : null}
              </View>
            </ScrollView>

            <View className="mt-4">
              <PressableScale
                onPress={() => {
                  void submit();
                }}
                disabled={sending || submitDisabled}
                accessibilityLabel={submitLabel}
                className={cn(
                  'h-[52px] w-full flex-row items-center justify-center gap-2 rounded-[12px] bg-primary dark:bg-white',
                  (sending || submitDisabled) && 'opacity-50',
                )}
              >
                {sending ? (
                  <ActivityIndicator color={submitTint} />
                ) : sendMode === 'schedule' ? (
                  <Clock size={18} color={submitTint} />
                ) : (
                  <Send size={18} color={submitTint} />
                )}
                <AppText className="font-gilroy-bold text-[16px] leading-[21px] text-white dark:text-primary">
                  {sending ? t('Sending...') : submitLabel}
                </AppText>
              </PressableScale>
              <View className="mt-2">
                <GlassButton label={t('Cancel')} variant="secondary" onPress={onClose} disabled={sending} />
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
      <ToastHost />
    </Modal>
  );
}
