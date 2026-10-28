import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { format, isValid, parse } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { Calendar, Clock, Lock, Send, Users, X } from 'lucide-react-native';

import { cn } from '@/lib/cn';
import { dateFnsLocale } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { colors } from '@/theme/colors';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useToast } from '@/hooks/useToast';
import {
  useScheduleGroupEmailMutation,
  useUpdateScheduledEmailMutation,
  type ScheduledEmail,
} from '@/store/api/messageSubscribersApi';
import { AppText, Chip, GlassButton, GlassInput, PressableScale, SegmentedControl, ToastHost } from '@/components/ui';

const HOURS_BEFORE_EVENT_OPTIONS = [1, 3, 8, 24, 48] as const;

type SendMode = 'now' | 'schedule';
type ScheduleType = 'date_time' | 'event_offset';

export interface ScheduleableEvent {
  id: number;
  name: string;
  startAt: Date;
}

export interface ComposeEmailSheetProps {
  recipients: number[];
  filterLabels: string[];
  editing: ScheduledEmail | null;
  scheduleableEvents: ScheduleableEvent[];
  onClose: () => void;
}

function DeliveryDateTimeField({
  value,
  mode,
  onChange,
  placeholder,
}: {
  value: string;
  mode: 'date' | 'time';
  onChange: (next: string) => void;
  placeholder: string;
}) {
  return (
    <View className="flex-1">
      <GlassInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        keyboardType="numbers-and-punctuation"
        autoCapitalize="none"
        autoCorrect={false}
        leftIcon={mode === 'date' ? <Calendar size={16} color={colors.muted} /> : <Clock size={16} color={colors.muted} />}
      />
    </View>
  );
}

export function ComposeEmailSheet({ recipients, filterLabels, editing, scheduleableEvents, onClose }: ComposeEmailSheetProps) {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const isEditing = Boolean(editing);
  const submitTint = useThemeColor(colors.white, colors.primary);

  const [subject, setSubject] = useState(editing?.subject ?? '');
  const [message, setMessage] = useState(editing?.message ?? '');
  const [sendMode, setSendMode] = useState<SendMode>(isEditing ? 'schedule' : 'now');
  const [scheduleType, setScheduleType] = useState<ScheduleType>('date_time');
  const [scheduledDate, setScheduledDate] = useState(() => {
    if (!editing?.scheduled_for) return '';
    const parsed = new Date(editing.scheduled_for);
    return Number.isNaN(parsed.getTime()) ? '' : format(parsed, 'yyyy-MM-dd');
  });
  const [scheduledTime, setScheduledTime] = useState(() => {
    if (!editing?.scheduled_for) return '';
    const parsed = new Date(editing.scheduled_for);
    return Number.isNaN(parsed.getTime()) ? '' : format(parsed, 'HH:mm');
  });
  const [scheduledEventId, setScheduledEventId] = useState<number | null>(null);
  const [scheduledHoursBefore, setScheduledHoursBefore] = useState<number>(24);

  const [scheduleGroupEmail, { isLoading: scheduling }] = useScheduleGroupEmailMutation();
  const [updateScheduledEmail, { isLoading: updating }] = useUpdateScheduledEmailMutation();
  const sending = scheduling || updating;

  const recipientCount = recipients.length;
  const offsetEnabled = !isEditing && scheduleableEvents.length > 0;

  const selectedScheduleEvent = useMemo(
    () => scheduleableEvents.find((event) => event.id === scheduledEventId) ?? null,
    [scheduleableEvents, scheduledEventId],
  );

  const relativeScheduledAt = useMemo(() => {
    if (!selectedScheduleEvent) return null;
    return new Date(selectedScheduleEvent.startAt.getTime() - scheduledHoursBefore * 60 * 60 * 1000);
  }, [selectedScheduleEvent, scheduledHoursBefore]);

  const formatDateTime = (date: Date) => format(date, 'd MMM yyyy, HH:mm', { locale: dateFnsLocale(i18n.language) });

  const submit = async () => {
    haptics.light();
    if (!subject.trim()) {
      toast(t('Subject is required.'), 'error');
      return;
    }
    if (!isEditing && recipients.length === 0) {
      toast(t('No recipients found. Please select subscribers, events, or categories.'), 'error');
      return;
    }

    let scheduledFor = new Date();
    if (sendMode === 'schedule') {
      if (scheduleType === 'event_offset') {
        if (scheduledEventId == null) {
          toast(t('Select an event for relative scheduling.'), 'error');
          return;
        }
        const chosen = scheduleableEvents.find((event) => event.id === scheduledEventId);
        if (!chosen) {
          toast(t('Selected event could not be found.'), 'error');
          return;
        }
        scheduledFor = new Date(chosen.startAt.getTime() - scheduledHoursBefore * 60 * 60 * 1000);
        if (scheduledFor <= new Date()) {
          toast(t('The selected offset results in a past time. Choose another option.'), 'error');
          return;
        }
      } else {
        if (!scheduledDate || !scheduledTime) {
          toast(t('Select a date and time to schedule.'), 'error');
          return;
        }
        const parsed = parse(`${scheduledDate} ${scheduledTime}`, 'yyyy-MM-dd HH:mm', new Date());
        if (!isValid(parsed)) {
          toast(t('Invalid date or time.'), 'error');
          return;
        }
        if (parsed <= new Date()) {
          toast(t('Scheduled time must be in the future.'), 'error');
          return;
        }
        scheduledFor = parsed;
      }
    }

    const scheduledForIso = scheduledFor.toISOString().replace('Z', '+00:00');

    try {
      if (isEditing && editing) {
        await updateScheduledEmail({
          id: editing.id,
          subject: subject.trim(),
          message: message.trim(),
          scheduled_for: scheduledForIso,
          attachments: [],
        }).unwrap();
        haptics.success();
        toast(t('Schedule updated for {{count}} recipients', { count: recipientCount }), 'success');
      } else {
        await scheduleGroupEmail({
          recipients,
          subject: subject.trim(),
          message: message.trim(),
          scheduled_for: scheduledForIso,
          attachments: [],
        }).unwrap();
        haptics.success();
        toast(
          sendMode === 'schedule'
            ? t('Email scheduled for {{count}} recipients', { count: recipientCount })
            : t('Email sent to {{count}} recipients', { count: recipientCount }),
          'success',
        );
      }
      onClose();
    } catch {
      haptics.error();
      toast(t('Unable to send email. Please try again.'), 'error');
    }
  };

  const submitLabel = sendMode === 'schedule' ? (isEditing ? t('Update Schedule') : t('Schedule email')) : t('Send email');

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <Pressable className="flex-1" onPress={onClose} accessibilityLabel={t('Close')} />
        <KeyboardAvoidingView behavior="padding">
          <View className="max-h-[680px] rounded-t-[24px] bg-app-bg px-5 pb-10 pt-4 dark:bg-dark-bg">
            <View className="mb-4 flex-row items-center justify-between">
              <AppText className="font-gilroy-bold text-[20px]">
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
                  {isEditing ? <Lock size={15} color={colors.muted} /> : <Users size={15} color={colors.muted} />}
                  <AppText className="font-gilroy-semibold text-[13px] text-muted">{t('To')}</AppText>
                  <AppText numberOfLines={1} className="flex-1 font-gilroy-medium text-[13px]">
                    {isEditing
                      ? t('{{count}} recipients (locked)', { count: recipientCount })
                      : filterLabels.length > 0
                        ? `${t('{{count}} recipients', { count: recipientCount })} · ${filterLabels.join(', ')}`
                        : t('{{count}} recipients', { count: recipientCount })}
                  </AppText>
                </View>

                <GlassInput
                  label={t('Subject')}
                  placeholder={t('Email subject')}
                  value={subject}
                  onChangeText={setSubject}
                />

                <View className="gap-1.5">
                  <AppText className="font-gilroy-medium text-[13px] text-primary/70 dark:text-dark-text/70">
                    {t('Message')}
                  </AppText>
                  <View className="rounded-[10px] border border-app-border bg-app-surface px-3 py-2 dark:border-dark-border dark:bg-dark-surface">
                    <TextInput
                      placeholder={t('Write your message...')}
                      placeholderTextColor="#8a8d93"
                      value={message}
                      onChangeText={setMessage}
                      multiline
                      textAlignVertical="top"
                      className="min-h-[120px] font-gilroy text-base text-primary dark:text-dark-text"
                    />
                  </View>
                </View>

                {isEditing ? null : (
                  <View className="gap-2">
                    <AppText className="font-gilroy-semibold text-[14px]">{t('Delivery')}</AppText>
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
                        <DeliveryDateTimeField
                          value={scheduledDate}
                          mode="date"
                          onChange={setScheduledDate}
                          placeholder="YYYY-MM-DD"
                        />
                        <DeliveryDateTimeField
                          value={scheduledTime}
                          mode="time"
                          onChange={setScheduledTime}
                          placeholder="HH:MM"
                        />
                      </View>
                    ) : (
                      <View className="gap-3">
                        <AppText className="font-gilroy-medium text-[13px] text-primary/70 dark:text-dark-text/70">
                          {t('Event')}
                        </AppText>
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          contentContainerStyle={{ gap: 8 }}
                        >
                          {scheduleableEvents.map((event) => (
                            <Chip
                              key={event.id}
                              label={event.name}
                              selected={scheduledEventId === event.id}
                              onPress={() => setScheduledEventId(event.id)}
                            />
                          ))}
                        </ScrollView>
                        <AppText className="font-gilroy-medium text-[13px] text-primary/70 dark:text-dark-text/70">
                          {t('Send')}
                        </AppText>
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
                        {relativeScheduledAt && relativeScheduledAt > new Date() ? (
                          <AppText className="font-gilroy-medium text-[12px] text-muted">
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
                disabled={sending}
                accessibilityLabel={submitLabel}
                className={cn(
                  'h-[52px] w-full flex-row items-center justify-center gap-2 rounded-[12px] bg-primary dark:bg-white',
                  sending && 'opacity-70',
                )}
              >
                {sending ? null : sendMode === 'schedule' ? (
                  <Clock size={18} color={submitTint} />
                ) : (
                  <Send size={18} color={submitTint} />
                )}
                <AppText className="font-gilroy-bold text-[16px] text-white dark:text-primary">
                  {sending ? t('Sending...') : submitLabel}
                </AppText>
              </PressableScale>
              <View className="mt-2">
                <GlassButton label={t('Cancel')} variant="secondary" onPress={onClose} />
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
      <ToastHost />
    </Modal>
  );
}
