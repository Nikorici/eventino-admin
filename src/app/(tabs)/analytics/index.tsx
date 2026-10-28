import { useTranslation } from 'react-i18next';

import { SectionHub } from '@/components/navigation/SectionHub';
import { SelectedEventBar } from '@/components/navigation/SelectedEventBar';

export default function AnalyticsHubScreen() {
  const { t } = useTranslation();
  return <SectionHub tab="analytics" title={t('Analytics')} header={<SelectedEventBar />} />;
}
