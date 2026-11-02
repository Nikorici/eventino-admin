import { ActivityIndicator, Switch, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Link2, Pencil, Trash2 } from 'lucide-react-native';

import { AppText, Badge, PressableScale, Skeleton } from '@/components/ui';
import { CARD_BORDER } from '@/components/dashboard/DashboardStats';
import { useThemeColor } from '@/hooks/useThemeColor';
import { formatEventDay } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { formatMoney } from '@/lib/pricing';
import { pinnedEventDay } from '@/lib/ticketDays';
import type { ManageTicketType } from '@/store/api/ticketTypesApi';
import { colors, currencySymbol } from '@/theme/colors';

function IconAction({
  icon: Icon,
  label,
  destructive,
  busy,
  onPress,
}: {
  icon: typeof Pencil;
  label: string;
  destructive?: boolean;
  busy?: boolean;
  onPress: () => void;
}) {
  const tint = useThemeColor(colors.primary, colors.dark.text);
  return (
    <PressableScale
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      disabled={busy}
      accessibilityLabel={label}
      className="h-9 w-9 items-center justify-center rounded-full bg-black/[0.04] dark:bg-white/10"
    >
      {busy ? <ActivityIndicator size="small" color={colors.muted} /> : <Icon size={16} color={destructive ? colors.danger : tint} />}
    </PressableScale>
  );
}

export function TicketTypeCard({
  ticketType,
  currency,
  pinnableDays,
  toggling,
  deleting,
  onToggleActive,
  onEdit,
  onCopyEmbedLink,
  onDelete,
}: {
  ticketType: ManageTicketType;
  currency: string;
  pinnableDays: string[];
  toggling: boolean;
  deleting: boolean;
  onToggleActive: () => void;
  onEdit: () => void;
  onCopyEmbedLink: () => void;
  onDelete: () => void;
}) {
  const { t, i18n } = useTranslation();
  const cardBorder = useThemeColor(CARD_BORDER, colors.dark.border);
  const switchTrackOn = useThemeColor(colors.primary, colors.accent);
  const switchTrackOff = useThemeColor('#d1d1d6', colors.dark.elevated);
  const trackBg = useThemeColor('#eceef4', colors.dark.elevated);

  const unlimited = ticketType.quantity == null;
  const sold = ticketType.sold_count ?? 0;
  const priceValue = Number(ticketType.price);
  const priceLabel =
    Number.isFinite(priceValue) && priceValue > 0 ? `${currencySymbol(currency)} ${formatMoney(priceValue)}` : t('Free');
  const pct = unlimited || !ticketType.quantity ? 0 : Math.min(100, Math.round((sold / ticketType.quantity) * 100));
  const pinnedDay = pinnedEventDay(ticketType.event_day, pinnableDays);
  const tiers = [...(ticketType.quantity_discounts ?? [])]
    .filter((tier) => tier.min_quantity > 0)
    .sort((a, b) => a.min_quantity - b.min_quantity);

  return (
    <View
      className="gap-2.5 rounded-[12px] border bg-white p-4 dark:bg-dark-surface"
      style={{ borderColor: cardBorder, opacity: ticketType.is_active ? 1 : 0.72 }}
    >
      <View className="flex-row items-center gap-3">
        <View className="flex-1 flex-row items-center gap-2">
          {ticketType.effective_scan_color ? (
            <View
              accessibilityLabel={t('Scan color')}
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: ticketType.effective_scan_color }}
            />
          ) : null}
          <AppText numberOfLines={1} className="shrink font-gilroy-bold text-[16px] leading-[21px]">
            {ticketType.name}
          </AppText>
          {ticketType.is_online ? (
            <Badge label={t('Live')} className="bg-danger/10" textClassName="text-danger" />
          ) : null}
          {pinnedDay ? (
            <Badge
              label={formatEventDay(pinnedDay, i18n.language)}
              className="bg-links/10 dark:bg-white/10"
              textClassName="text-links dark:text-dark-text"
            />
          ) : null}
          <Badge label={priceLabel} className="bg-primary dark:bg-white" textClassName="text-white dark:text-primary" />
        </View>
        <Switch
          value={ticketType.is_active}
          disabled={toggling}
          onValueChange={onToggleActive}
          accessibilityLabel={ticketType.is_active ? t('Deactivate') : t('Activate')}
          trackColor={{ true: switchTrackOn, false: switchTrackOff }}
          thumbColor={colors.white}
        />
      </View>

      <AppText className="font-gilroy-medium text-[12px] text-muted dark:text-dark-muted leading-[16px]">
        {[
          unlimited ? t('Unlimited') : `${t('Limit')}: ${ticketType.quantity}`,
          `${t('Sold')}: ${sold}`,
          ticketType.is_active ? t('Active') : t('Inactive'),
        ].join(' · ')}
      </AppText>

      {unlimited ? null : (
        <View className="gap-1">
          <View className="h-2 w-full overflow-hidden rounded-full" style={{ backgroundColor: trackBg }}>
            <View className="h-full rounded-full bg-primary dark:bg-white" style={{ width: `${pct}%` }} />
          </View>
          <View className="flex-row items-center justify-between">
            <AppText className="font-gilroy-medium text-[11px] text-muted dark:text-dark-muted leading-[14px]">
              {t('Remaining')}: {ticketType.remaining ?? 0}
            </AppText>
            <AppText className="font-gilroy-medium text-[11px] text-muted dark:text-dark-muted leading-[14px]">{pct}%</AppText>
          </View>
        </View>
      )}

      <View className="flex-row items-end justify-between gap-3">
        <View className="flex-1 flex-row flex-wrap gap-1.5">
          {tiers.map((tier) => (
            <View key={tier.min_quantity} className="rounded-full bg-black/5 px-2.5 py-1 dark:bg-white/10">
              <AppText className="font-gilroy-medium text-[11px] leading-[14px]">
                {t('{{count}} Tickets - {{percent}}% discount', { count: tier.min_quantity, percent: tier.percent })}
              </AppText>
            </View>
          ))}
        </View>
        <View className="flex-row gap-2">
          <IconAction icon={Pencil} label={t('Edit ticket type')} onPress={onEdit} />
          {ticketType.is_online ? <IconAction icon={Link2} label={t('Copy embed link')} onPress={onCopyEmbedLink} /> : null}
          <IconAction icon={Trash2} label={t('Delete')} destructive busy={deleting} onPress={onDelete} />
        </View>
      </View>
    </View>
  );
}

export function TicketTypeCardSkeleton() {
  const cardBorder = useThemeColor(CARD_BORDER, colors.dark.border);
  return (
    <View className="gap-2.5 rounded-[12px] border bg-white p-4 dark:bg-dark-surface" style={{ borderColor: cardBorder }}>
      <View className="flex-row items-center justify-between">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-6 w-11" style={{ borderRadius: 14 }} />
      </View>
      <Skeleton className="h-3 w-52" />
      <Skeleton className="h-2 w-full" style={{ borderRadius: 8 }} />
      <View className="flex-row items-center justify-between">
        <Skeleton className="h-3 w-24" />
        <View className="flex-row gap-2">
          <Skeleton className="h-9 w-9 rounded-full" />
          <Skeleton className="h-9 w-9 rounded-full" />
        </View>
      </View>
    </View>
  );
}
