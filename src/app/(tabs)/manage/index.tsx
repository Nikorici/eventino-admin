import { useTranslation } from 'react-i18next';

import { SectionHub } from '@/components/navigation/SectionHub';
import { SelectedEventBar } from '@/components/navigation/SelectedEventBar';

export default function ManageHubScreen() {
  const { t } = useTranslation();
  return <SectionHub tab="manage" title={t('Manage')} header={<SelectedEventBar />} />;
}
