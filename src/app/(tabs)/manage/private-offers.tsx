import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CreditCard, Link2, Mail, Plus, Tag, X } from 'lucide-react-native';

import { AppText, EmptyState, GlassHeader, PressableScale, Screen } from '@/components/ui';
import { confirmAction } from '@/components/dashboard/dashboardParts';
import { NewOfferSheet } from '@/components/offers/NewOfferSheet';
import { OfferActionButton, OfferCard, OffersSkeleton, copyOfferLink, type OfferTone } from '@/components/offers/offerParts';
import { useScreenPadding } from '@/hooks/useScreenPadding';
import { useSelectedEvent } from '@/hooks/useSelectedEvent';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useToast } from '@/hooks/useToast';
import { extractApiError } from '@/lib/apiError';
import { haptics } from '@/lib/haptics';
import { navigate } from '@/lib/nav';
import { formatMoney } from '@/lib/pricing';
import { offerPaymentsSummary } from '@/lib/privateOffers';
import {
  useCancelOfferMutation,
  useGetEventOffersQuery,
  useSendInstallmentEmailMutation,
  type PrivateOffer,
} from '@/store/api/privateOffersApi';
import { useGetManageTicketTypesQuery } from '@/store/api/ticketTypesApi';
import { colors } from '@/theme/colors';

const STATUS_TONES: Record<string, OfferTone> = {
  ACTIVE: 'success',
  REDEEMED: 'info',
  CANCELLED: 'danger',
  EXPIRED: 'neutral',
};

function OfferPayments({ offer }: { offer: PrivateOffer }) {
  const { t } = useTranslation();
  const payments = offerPaymentsSummary(offer);
  if (payments.kind === 'plan') {
    return (
      <>
        <AppText className="font-gilroy-semibold text-[13px]">
          {payments.paid}/{payments.total} {t('paid')}
        </AppText>
        {payments.next ? (
          <AppText className="font-gilroy-medium text-[11px] text-muted dark:text-dark-muted">
            {t('next')} {payments.next.amount} {offer.currency} · {payments.next.due_date}
          </AppText>
        ) : null}
      </>
    );
  }
  return (
    <AppText className="font-gilroy-medium text-[12px] text-muted dark:text-dark-muted">
      {payments.kind === 'scheduled' ? `${payments.count} ${t('payments scheduled')}` : '—'}
    </AppText>
  );
}

export default function PrivateOffersScreen() {
  const { t } = useTranslation();
  const toast = useToast();
  const padding = useScreenPadding();
  const onPrimary = useThemeColor(colors.white, colors.primary);
  const { eventId, data: event, isLoading: eventLoading, isError: eventError, refetch: refetchEvent } =
    useSelectedEvent();
  const skip = eventId == null;
  const offersQuery = useGetEventOffersQuery(eventId ?? 0, { skip });
  const ticketTypesQuery = useGetManageTicketTypesQuery(eventId ?? 0, { skip });
  const [cancelOffer] = useCancelOfferMutation();
  const [sendInstallmentEmail] = useSendInstallmentEmailMutation();
  const [showNew, setShowNew] = useState(false);
  const [busyOfferId, setBusyOfferId] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const offers = useMemo(() => offersQuery.data ?? [], [offersQuery.data]);
  const ticketTypes = useMemo(
    () => (ticketTypesQuery.data ?? []).filter((type) => type.is_active !== false),
    [ticketTypesQuery.data],
  );

  const copyLink = async (offer: PrivateOffer) => {
    await copyOfferLink(offer.token);
    toast(t('Offer link copied'), 'success');
  };

  const sendEmail = async (offer: PrivateOffer) => {
    setBusyOfferId(offer.id);
    try {
      const result = await sendInstallmentEmail({ offerId: offer.id }).unwrap();
      if (result.sent) toast(result.type === 'intro' ? t('Offer email sent') : t('Payment reminder sent'), 'success');
    } catch (error) {
      const message = extractApiError(error);
      toast(message ? t(message) : t('Something went wrong.'), 'error');
    } finally {
      setBusyOfferId(null);
    }
  };

  const confirmCancel = (offer: PrivateOffer) => {
    if (eventId == null) return;
    confirmAction({
      title: t('Cancel this offer? The payment link will stop working.'),
      cancelLabel: t('Keep offer'),
      confirmLabel: t('Cancel offer'),
      destructive: true,
      onConfirm: () => {
        setBusyOfferId(offer.id);
        cancelOffer({ offerId: offer.id, eventId })
          .unwrap()
          .then(() => toast(t('Offer cancelled'), 'success'))
          .catch((error: unknown) => toast(extractApiError(error) ?? t('Something went wrong.'), 'error'))
          .finally(() => setBusyOfferId(null));
      },
    });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchEvent(), offersQuery.refetch(), ticketTypesQuery.refetch()]);
    } finally {
      setRefreshing(false);
    }
  };

  const renderList = () => {
    if (offersQuery.isLoading) return <OffersSkeleton />;
    if (offersQuery.isError) {
      return (
        <EmptyState
          icon={Tag}
          title={t('Something went wrong.')}
          message={t('Please try again.')}
          actionLabel={t('Try again')}
          onAction={() => void offersQuery.refetch()}
        />
      );
    }
    if (offers.length === 0) return <EmptyState icon={Tag} title={t('No private offers yet.')} />;
    return (
      <View className="gap-3">
        {offers.map((offer) => {
          const active = offer.effective_status === 'ACTIVE';
          const busy = busyOfferId === offer.id;
          return (
            <OfferCard
              key={offer.id}
              title={offer.name}
              subtitle={offer.recipient_email || '—'}
              statusLabel={t(offer.effective_status)}
              tone={STATUS_TONES[offer.effective_status] ?? 'neutral'}
              amount={`${formatMoney(Number(offer.resolved_price) || 0)} ${offer.currency}`}
              aside={<OfferPayments offer={offer} />}
              actions={
                <>
                  <OfferActionButton label={t('Copy link')} icon={Link2} onPress={() => void copyLink(offer)} />
                  {offer.installments.length > 0 && active ? (
                    <OfferActionButton label={t('Send email')} icon={Mail} disabled={busy} onPress={() => void sendEmail(offer)} />
                  ) : null}
                  {active ? (
                    <OfferActionButton label={t('Cancel')} icon={X} danger disabled={busy} onPress={() => confirmCancel(offer)} />
                  ) : null}
                </>
              }
            />
          );
        })}
      </View>
    );
  };

  const renderBody = () => {
    if (eventLoading) return <OffersSkeleton />;
    if (eventError || !event || eventId == null) {
      return (
        <EmptyState
          icon={CreditCard}
          title={t('Unable to load event data.')}
          actionLabel={t('Try again')}
          onAction={() => void refetchEvent()}
        />
      );
    }
    return (
      <View className="gap-4">
        <AppText className="font-gilroy-medium text-[14px] text-muted dark:text-dark-muted">
          {t('Send a personal offer to one client, optionally payable in installments.')}
        </AppText>
        <PressableScale
          onPress={() => {
            haptics.light();
            setShowNew(true);
          }}
          accessibilityLabel={t('New offer')}
          className="h-12 flex-row items-center justify-center gap-2 rounded-[12px] bg-primary dark:bg-white"
        >
          <Plus size={18} color={onPrimary} />
          <AppText className="font-gilroy-semibold text-[15px] text-white dark:text-primary">{t('New offer')}</AppText>
        </PressableScale>
        {renderList()}
      </View>
    );
  };

  return (
    <Screen edges={[]}>
      <GlassHeader title={t('Private offers')} onBack={navigate.back} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: padding.top, paddingBottom: padding.bottom, paddingHorizontal: 16 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={colors.muted}
            progressViewOffset={padding.top}
          />
        }
      >
        {renderBody()}
      </ScrollView>
      {showNew && eventId != null ? (
        <NewOfferSheet
          eventId={eventId}
          ticketTypes={ticketTypes}
          onClose={() => setShowNew(false)}
          onCreated={(withInstallments) => {
            setShowNew(false);
            toast(
              withInstallments ? t('Offer created. The payment plan email was sent to the client.') : t('Offer created.'),
              'success',
            );
          }}
        />
      ) : null}
    </Screen>
  );
}
