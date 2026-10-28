import { useTranslation } from 'react-i18next';

import { SectionHub } from '@/components/navigation/SectionHub';
import { SelectedEventBar } from '@/components/navigation/SelectedEventBar';

export default function SalesHubScreen() {
  const { t } = useTranslation();
  return <SectionHub tab="sales" title={t('Sales')} header={<SelectedEventBar />} />;
}
