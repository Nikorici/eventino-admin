import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Banknote, ChevronDown } from 'lucide-react-native';

import { OptionSheet } from '@/components/dashboard/OptionSheet';
import { Chip } from '@/components/ui';
import { useThemeColor } from '@/hooks/useThemeColor';
import { SUMMARY_CURRENCIES } from '@/lib/currency';
import { colors } from '@/theme/colors';

export function CurrencySelector({ currency, onSelect }: { currency: string; onSelect: (code: string) => void }) {
  const { t } = useTranslation();
  const iconColor = useThemeColor(colors.primary, colors.dark.text);
  const [open, setOpen] = useState(false);
  return (
    <>
      <Chip
        label={currency}
        onPress={() => setOpen(true)}
        icon={<Banknote size={16} color={iconColor} />}
        trailing={<ChevronDown size={14} color={iconColor} />}
      />
      {open ? (
        <OptionSheet
          title={t('Currency')}
          options={SUMMARY_CURRENCIES.map((option) => ({ value: option.code, label: option.code, hint: t(option.name) }))}
          value={currency}
          onSelect={onSelect}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
