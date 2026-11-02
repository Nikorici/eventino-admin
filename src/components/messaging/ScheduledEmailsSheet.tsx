import { Modal, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { Clock, Pencil, Trash2, X } from 'lucide-react-native';

import { cn } from '@/lib/cn';
import { dateFnsLocale } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { colors } from '@/theme/colors';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useToast } from '@/hooks/useToast';
import {
  useDeleteScheduledEmailMutation,
  useGetScheduledEmailsQuery,
  type ScheduledEmail,
} from '@/store/api/messageSubscribersApi';
import { AppText, EmptyState, PressableScale, Skeleton, SlideUp, ToastHost } from '@/components/ui';
import { confirmAction } from '@/components/dashboard/dashboardParts';

export interface ScheduledEmailsSheetProps {
  onClose: () => void;
  onEdit: (email: ScheduledEmail) => void;
  onScheduleNew: () => void;
}

function statusTone(status: string): string {
  if (status === 'PENDING') return 'text-warning dark:text-warning';
  if (status === 'SENT' || status === 'COMPLETED') return 'text-success dark:text-success';
  if (status === 'FAILED') return 'text-danger dark:text-danger';
  return 'text-muted dark:text-dark-muted';
}

function ScheduledEmailRow({
  email,
  lang,
  onEdit,
  onDelete,
  deleting,
}: {
  email: ScheduledEmail;
  lang: string;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const { t } = useTranslation();
  const iconColor = useThemeColor(colors.primary, colors.dark.text);
  const isPending = email.status === 'PENDING';
  const scheduledLabel = email.scheduled_for
    ? format(new Date(email.scheduled_for), 'd MMM yyyy, HH:mm', { locale: dateFnsLocale(lang) })
    : '—';

  return (
    <View className="gap-2 rounded-[12px] border border-app-border bg-app-surface p-3.5 dark:border-dark-border dark:bg-dark-surface">
      <View className="flex-row items-start justify-between gap-3">
        <AppText numberOfLines={1} className="flex-1 font-gilroy-semibold text-[15px] leading-[20px]">
          {email.subject || t('No subject')}
        </AppText>
        <AppText className={cn('font-gilroy-semibold text-[12px] leading-[16px] uppercase', statusTone(email.status))}>
          {email.status}
        </AppText>
      </View>
      <View className="flex-row items-center gap-1.5">
        <Clock size={13} color={colors.muted} />
        <AppText className="font-gilroy-medium text-[13px] leading-[17px] text-muted dark:text-dark-muted">
          {`${scheduledLabel} · ${t('{{count}} recipients', { count: email.recipient_count })}`}
        </AppText>
      </View>
      {isPending ? (
        <View className="mt-1 flex-row gap-2">
          <View className="flex-1">
            <PressableScale
              onPress={onEdit}
              accessibilityLabel={t('Edit')}
              className="h-9 w-full flex-row items-center justify-center gap-1.5 rounded-[10px] border border-app-border dark:border-dark-border"
            >
              <Pencil size={15} color={iconColor} />
              <AppText className="font-gilroy-semibold text-[13px] leading-[17px]">{t('Edit')}</AppText>
            </PressableScale>
          </View>
          <View className="flex-1">
            <PressableScale
              onPress={onDelete}
              disabled={deleting}
              accessibilityLabel={t('Delete')}
              className={cn(
                'h-9 w-full flex-row items-center justify-center gap-1.5 rounded-[10px] border border-danger/40',
                deleting && 'opacity-60',
              )}
            >
              <Trash2 size={15} color={colors.danger} />
              <AppText className="font-gilroy-semibold text-[13px] leading-[17px] text-danger dark:text-danger">{t('Delete')}</AppText>
            </PressableScale>
          </View>
        </View>
      ) : null}
    </View>
  );
}

export function ScheduledEmailsSheet({ onClose, onEdit, onScheduleNew }: ScheduledEmailsSheetProps) {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const { height: windowHeight } = useWindowDimensions();
  const { data, isLoading, isError, refetch } = useGetScheduledEmailsQuery(undefined, { refetchOnMountOrArgChange: true });
  const [deleteScheduledEmail, { isLoading: deleting }] = useDeleteScheduledEmailMutation();
  const scheduledEmails = data ?? [];

  const confirmDelete = (email: ScheduledEmail) => {
    confirmAction({
      title: t('Cancel this scheduled email?'),
      message: t('This scheduled email will be permanently removed.'),
      confirmLabel: t('Delete'),
      cancelLabel: t('Keep'),
      destructive: true,
      onConfirm: () => {
        void (async () => {
          try {
            await deleteScheduledEmail(email.id).unwrap();
            haptics.success();
            toast(t('Scheduled email canceled'), 'success');
          } catch {
            haptics.error();
            toast(t('Unable to cancel scheduled email.'), 'error');
          }
        })();
      },
    });
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <Pressable className="flex-1" onPress={onClose} accessibilityLabel={t('Close')} />
        <SlideUp>
        <View className="rounded-t-[24px] bg-app-bg px-5 pb-8 pt-4 dark:bg-dark-bg" style={{ height: windowHeight * 0.7 }}>
          <View className="mb-4 flex-row items-center justify-between">
            <AppText className="font-gilroy-bold text-[20px] leading-[26px]">{t('Scheduled Emails')}</AppText>
            <Pressable
              onPress={onClose}
              accessibilityLabel={t('Close')}
              className="h-9 w-9 items-center justify-center rounded-full bg-black/[0.04] dark:bg-white/10"
            >
              <X size={18} color={colors.muted} />
            </Pressable>
          </View>

          {isLoading ? (
            <View className="gap-3">
              {[0, 1, 2].map((row) => (
                <Skeleton key={row} className="h-[104px] rounded-[12px]" />
              ))}
            </View>
          ) : isError ? (
            <EmptyState
              icon={Clock}
              title={t('Unable to load scheduled emails. Please try again.')}
              actionLabel={t('Retry')}
              onAction={() => {
                void refetch();
              }}
            />
          ) : scheduledEmails.length === 0 ? (
            <EmptyState
              icon={Clock}
              title={t('No scheduled emails yet.')}
              actionLabel={t('Schedule an email')}
              onAction={onScheduleNew}
            />
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 16 }}>
              {scheduledEmails.map((email) => (
                <ScheduledEmailRow
                  key={email.id}
                  email={email}
                  lang={i18n.language}
                  deleting={deleting}
                  onEdit={() => onEdit(email)}
                  onDelete={() => confirmDelete(email)}
                />
              ))}
            </ScrollView>
          )}
        </View>
        </SlideUp>
      </View>
      <ToastHost />
    </Modal>
  );
}
