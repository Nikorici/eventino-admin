import { useTranslation } from 'react-i18next';

import { AccountCard } from '@/components/navigation/AccountCard';
import { SectionHub } from '@/components/navigation/SectionHub';

export default function MoreHubScreen() {
  const { t } = useTranslation();
  return <SectionHub tab="more" title={t('More')} header={<AccountCard />} />;
}
