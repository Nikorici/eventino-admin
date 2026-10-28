import { useTranslation } from 'react-i18next';
import { TextInput, View } from 'react-native';
import { X } from 'lucide-react-native';

import { haptics } from '@/lib/haptics';
import { colors } from '@/theme/colors';
import { AppText, PressableScale } from '@/components/ui';

import { MAX_QUANTITY_DISCOUNT_TIERS, nextQuantityDiscountRow, type QuantityDiscountRow } from './eventFormRules';

function TierInput({
  value,
  onChangeText,
  accessibilityLabel,
}: {
  value: string;
  onChangeText: (text: string) => void;
  accessibilityLabel: string;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={(text) => onChangeText(text.replace(/[^0-9]/g, ''))}
      keyboardType="number-pad"
      maxLength={3}
      accessibilityLabel={accessibilityLabel}
      className="h-11 w-14 rounded-[10px] border border-app-border bg-app-surface text-center font-gilroy text-[16px] text-primary dark:border-dark-border dark:bg-dark-surface dark:text-dark-text"
    />
  );
}

export interface QuantityDiscountTiersEditorProps {
  value: QuantityDiscountRow[];
  onChange: (rows: QuantityDiscountRow[]) => void;
  error?: string;
}

export function QuantityDiscountTiersEditor({ value, onChange, error }: QuantityDiscountTiersEditorProps) {
  const { t } = useTranslation();

  const updateRow = (index: number, patch: Partial<QuantityDiscountRow>) =>
    onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const removeRow = (index: number) => {
    haptics.selection();
    onChange(value.filter((_, i) => i !== index));
  };

  const addRow = () => {
    haptics.selection();
    onChange([...value, nextQuantityDiscountRow(value)]);
  };

  return (
    <View className="gap-2">
      {value.map((row, index) => (
        <View key={index} className="flex-row items-center gap-2">
          <View className="flex-1 flex-row flex-wrap items-center gap-2">
            <View className="flex-row items-center gap-2">
              <TierInput
                value={row.min_quantity}
                onChangeText={(text) => updateRow(index, { min_quantity: text })}
                accessibilityLabel={t('Minimum number of tickets')}
              />
              <AppText className="font-gilroy-medium text-[12px] text-muted dark:text-dark-muted">{t('or more tickets')}</AppText>
            </View>
            <View className="flex-row items-center gap-2">
              <TierInput
                value={row.percent}
                onChangeText={(text) => updateRow(index, { percent: text })}
                accessibilityLabel={t('Discount percent')}
              />
              <AppText className="font-gilroy-medium text-[12px] text-muted dark:text-dark-muted">{t('% off each')}</AppText>
            </View>
          </View>
          <PressableScale
            onPress={() => removeRow(index)}
            accessibilityLabel={t('Remove discount tier')}
            className="h-8 w-8 items-center justify-center rounded-full bg-danger/10"
          >
            <X size={14} color={colors.danger} />
          </PressableScale>
        </View>
      ))}
      {value.length < MAX_QUANTITY_DISCOUNT_TIERS ? (
        <PressableScale onPress={addRow} accessibilityLabel={t('+ Add discount tier')} className="self-start py-1">
          <AppText className="font-gilroy-semibold text-[13px] text-links dark:text-dark-text">{t('+ Add discount tier')}</AppText>
        </PressableScale>
      ) : null}
      {error ? <AppText className="font-gilroy-medium text-xs text-danger">{error}</AppText> : null}
    </View>
  );
}
