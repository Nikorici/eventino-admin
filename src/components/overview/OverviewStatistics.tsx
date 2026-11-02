import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Banknote, CheckCircle2, CreditCard, Gift, LayoutDashboard, Ticket, Users, Wallet } from 'lucide-react-native';

import {
  AnalyticsChart,
  CountCard,
  DashboardStatsSkeleton,
  IntervalSelector,
  RevenueCard,
  type IntervalKey,
} from '@/components/dashboard/DashboardStats';
import { SectionTitle } from '@/components/dashboard/dashboardParts';
import { EmptyState } from '@/components/ui';
import type { OrganizerRecentStats } from '@/store/api/organizerApi';

import { CurrencySelector } from './CurrencySelector';
import type { SummaryCurrency } from './useSummaryCurrency';

export function OverviewStatistics({
  stats,
  isLoading,
  isError,
  onRetry,
  summary,
}: {
  stats: OrganizerRecentStats | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  summary: SummaryCurrency;
}) {
  const { t } = useTranslation();
  const [interval, setStatsInterval] = useState<IntervalKey>('all_time');
  const { currency, rates, total } = summary;
  const chartSummary = useMemo(() => ({ currency, rates }), [currency, rates]);
  const currencies = useMemo(() => stats?.event_currencies ?? [], [stats?.event_currencies]);

  const bucket = stats?.[interval];
  const allTime = stats?.all_time;
  const showAllTime = interval !== 'all_time';
  const entry = (byCurrency: Record<string, number> | undefined) => [{ code: currency, amount: total(byCurrency) }];
  const invoiceMap = bucket?.invoice_income_by_currency;
  const allTimeTickets = allTime?.total_tickets ?? 0;
  const freeTickets = allTime?.manual_tickets_count ?? 0;
  const allTimeCaption = t('all time');

  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between gap-2">
        <SectionTitle>{t('Statistics')}</SectionTitle>
        {summary.isMixed ? <CurrencySelector currency={currency} onSelect={summary.chooseCurrency} /> : null}
      </View>

      {isLoading ? (
        <DashboardStatsSkeleton />
      ) : isError ? (
        <EmptyState
          icon={LayoutDashboard}
          title={t('Something went wrong.')}
          message={t('Please try again.')}
          actionLabel={t('Try again')}
          onAction={onRetry}
        />
      ) : (
        <>
          <IntervalSelector value={interval} onChange={setStatsInterval} />
          <View className="flex-row flex-wrap justify-between gap-y-3">
            <RevenueCard
              wide
              icon={Wallet}
              label={t('Total Revenue')}
              entries={entry(bucket?.income_by_currency)}
              allTimeEntries={showAllTime ? entry(allTime?.income_by_currency) : undefined}
            />
            <RevenueCard
              wide
              icon={Banknote}
              label={t('Total Received')}
              entries={entry(bucket?.total_received_by_currency)}
              invoiceByCurrency={invoiceMap && Object.keys(invoiceMap).length ? { [currency]: total(invoiceMap) } : undefined}
              allTimeEntries={showAllTime ? entry(allTime?.total_received_by_currency) : undefined}
              note={t('Without invoices')}
            />
            <CountCard
              icon={Users}
              label={t('Total Users')}
              value={bucket?.new_users ?? 0}
              allTimeValue={showAllTime ? (allTime?.new_users ?? 0) : undefined}
            />
            <CountCard
              icon={CheckCircle2}
              label={t('Tickets sold')}
              value={bucket?.tickets_sold ?? 0}
              allTimeValue={showAllTime ? (allTime?.tickets_sold ?? 0) : undefined}
            />
            <CountCard icon={Ticket} label={t('Total Tickets')} value={allTimeTickets} caption={allTimeCaption} />
            <CountCard
              icon={CreditCard}
              label={t('Paid Tickets')}
              value={Math.max(0, allTimeTickets - freeTickets)}
              caption={allTimeCaption}
            />
            <CountCard icon={Gift} label={t('Free Tickets')} value={freeTickets} caption={allTimeCaption} />
          </View>
          <AnalyticsChart currencies={currencies} summary={chartSummary} />
        </>
      )}
    </View>
  );
}
