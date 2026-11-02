import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { Building2, CalendarDays, Check, Tag, Ticket } from 'lucide-react-native';

import { cn } from '@/lib/cn';
import { haptics } from '@/lib/haptics';
import { colors } from '@/theme/colors';
import { useThemeColor } from '@/hooks/useThemeColor';
import { initials } from '@/components/dashboard/dashboardParts';
import { AppText, Skeleton } from '@/components/ui';
import type { MessagingCategory, MessagingEvent, MessagingRecipient, TicketHolderType } from '@/store/api/messageSubscribersApi';

const ACCENT_GREEN = '#34c759';

export function SelectionCheck({ selected }: { selected: boolean }) {
  return (
    <View
      className={cn(
        'h-6 w-6 items-center justify-center rounded-full border',
        selected ? 'border-transparent' : 'border-app-border dark:border-dark-border',
      )}
      style={selected ? { backgroundColor: ACCENT_GREEN } : undefined}
    >
      {selected ? <Check size={14} color={colors.white} /> : null}
    </View>
  );
}

function SelectableRow({
  label,
  selected,
  onToggle,
  leading,
  children,
  trailing,
}: {
  label: string;
  selected: boolean;
  onToggle: () => void;
  leading: ReactNode;
  children: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <Pressable
      onPress={() => {
        haptics.selection();
        onToggle();
      }}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      className="flex-row items-center gap-3 py-3"
    >
      {leading}
      <View className="flex-1">{children}</View>
      {trailing}
      <SelectionCheck selected={selected} />
    </Pressable>
  );
}

function IconTile({ children }: { children: ReactNode }) {
  return (
    <View className="h-10 w-10 items-center justify-center overflow-hidden rounded-[8px] bg-card-sm dark:bg-dark-elevated">{children}</View>
  );
}

function Subtitle({ children }: { children: string }) {
  return (
    <AppText numberOfLines={1} className="font-gilroy-medium text-[12px] leading-[16px] text-muted dark:text-dark-muted">
      {children}
    </AppText>
  );
}

export function FollowerRow({ follower, selected, onToggle }: { follower: MessagingRecipient; selected: boolean; onToggle: () => void }) {
  const { t } = useTranslation();
  const tagTint = useThemeColor('#2b3a44cc', '#f9f9f9cc');
  return (
    <SelectableRow
      label={follower.name}
      selected={selected}
      onToggle={onToggle}
      leading={
        <View className="h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-card-sm dark:bg-dark-elevated">
          {follower.profileImage ? (
            <Image source={{ uri: follower.profileImage }} contentFit="cover" style={{ width: '100%', height: '100%' }} />
          ) : (
            <AppText className="font-gilroy-semibold text-[13px] leading-[17px] text-muted dark:text-dark-muted">{initials(follower.name)}</AppText>
          )}
        </View>
      }
      trailing={
        <View
          accessibilityLabel={`${follower.eventIds.length} ${t('Events')}`}
          className="h-6 flex-row items-center gap-1 rounded-[6px] bg-black/[0.04] px-2 dark:bg-white/10"
        >
          <CalendarDays size={12} color={tagTint} />
          <AppText className="font-gilroy-semibold text-[12px] leading-[16px] text-primary/80 dark:text-dark-text/80">
            {String(follower.eventIds.length)}
          </AppText>
        </View>
      }
    >
      <View className="flex-row items-center gap-1.5">
        {follower.isOrganization ? <Building2 size={13} color={colors.muted} /> : null}
        <AppText numberOfLines={1} className="shrink font-gilroy-semibold text-[14px] leading-[19px]">
          {follower.name}
        </AppText>
      </View>
      {follower.email ? <Subtitle>{follower.email}</Subtitle> : null}
    </SelectableRow>
  );
}

export function EventRow({
  event,
  selected,
  dateLabel,
  onToggle,
}: {
  event: MessagingEvent;
  selected: boolean;
  dateLabel: string;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  return (
    <SelectableRow
      label={event.title}
      selected={selected}
      onToggle={onToggle}
      leading={
        <IconTile>
          {event.image ? (
            <Image source={{ uri: event.image }} contentFit="cover" style={{ width: '100%', height: '100%' }} />
          ) : (
            <CalendarDays size={18} color={colors.muted} />
          )}
        </IconTile>
      }
    >
      <AppText numberOfLines={1} className="font-gilroy-semibold text-[14px] leading-[19px]">
        {event.title}
      </AppText>
      <Subtitle>{[`${event.attendeeCount} ${t('attendees')}`, event.category, dateLabel].filter(Boolean).join(' · ')}</Subtitle>
    </SelectableRow>
  );
}

export function CategoryRow({ category, selected, onToggle }: { category: MessagingCategory; selected: boolean; onToggle: () => void }) {
  const { t } = useTranslation();
  return (
    <SelectableRow
      label={category.name}
      selected={selected}
      onToggle={onToggle}
      leading={
        <IconTile>
          <Tag size={18} color={colors.muted} />
        </IconTile>
      }
    >
      <AppText numberOfLines={1} className="font-gilroy-semibold text-[14px] leading-[19px]">
        {category.name}
      </AppText>
      <Subtitle>
        {`${category.eventCount} ${t(category.eventCount === 1 ? 'event' : 'events')} · ${category.attendeeCount} ${t(
          category.attendeeCount === 1 ? 'attendee' : 'attendees',
        )}`}
      </Subtitle>
    </SelectableRow>
  );
}

export function TicketHolderRow({ ticketType, selected, onToggle }: { ticketType: TicketHolderType; selected: boolean; onToggle: () => void }) {
  const { t } = useTranslation();
  return (
    <SelectableRow
      label={ticketType.name}
      selected={selected}
      onToggle={onToggle}
      leading={
        <IconTile>
          <Ticket size={18} color={colors.muted} />
        </IconTile>
      }
    >
      <AppText numberOfLines={1} className="font-gilroy-semibold text-[14px] leading-[19px]">
        {ticketType.name}
      </AppText>
      <Subtitle>{`${ticketType.holder_count} ${t(ticketType.holder_count !== 1 ? 'holders' : 'holder')}`}</Subtitle>
    </SelectableRow>
  );
}

export function AudienceRowSkeleton() {
  return (
    <View className="flex-row items-center gap-3 py-3">
      <Skeleton className="h-10 w-10 rounded-[8px]" />
      <View className="flex-1 gap-1.5">
        <Skeleton className="h-3.5 w-3/5" />
        <Skeleton className="h-3 w-2/5" />
      </View>
      <Skeleton className="h-6 w-6 rounded-full" />
    </View>
  );
}
