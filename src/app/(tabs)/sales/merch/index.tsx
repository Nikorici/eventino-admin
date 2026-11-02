import { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react-native';

import { GlassHeader, PressableScale, Screen } from '@/components/ui';
import { MerchNav, type MerchSection } from '@/components/merch/merchParts';
import { OrdersSection } from '@/components/merch/OrdersSection';
import { ProductsSection } from '@/components/merch/ProductsSection';
import { SettingsSection } from '@/components/merch/SettingsSection';
import { useScreenPadding } from '@/hooks/useScreenPadding';
import { useThemeColor } from '@/hooks/useThemeColor';
import { haptics } from '@/lib/haptics';
import { navigate } from '@/lib/nav';
import { colors } from '@/theme/colors';

export default function MerchScreen() {
  const { t } = useTranslation();
  const padding = useScreenPadding();
  const headerIconTint = useThemeColor(colors.primary, colors.dark.text);
  const { createProduct } = useLocalSearchParams<{ createProduct?: string }>();
  const [section, setSection] = useState<MerchSection>('products');
  const [createOpen, setCreateOpen] = useState(createProduct === '1');

  return (
    <Screen edges={[]}>
      <GlassHeader
        title={t('Merch Store')}
        onBack={navigate.back}
        right={
          section === 'products' ? (
            <PressableScale
              onPress={() => {
                haptics.light();
                setCreateOpen(true);
              }}
              accessibilityLabel={t('Add product')}
              className="h-10 w-10 items-center justify-center rounded-full border border-app-border bg-app-surface dark:border-dark-border dark:bg-dark-surface"
            >
              <Plus size={18} color={headerIconTint} />
            </PressableScale>
          ) : null
        }
      />
      <View className="px-4 pb-3" style={{ paddingTop: padding.top }}>
        <MerchNav active={section} onChange={setSection} />
      </View>
      {section === 'products' ? (
        <ProductsSection createOpen={createOpen} onCreateOpenChange={setCreateOpen} />
      ) : section === 'orders' ? (
        <OrdersSection />
      ) : (
        <SettingsSection />
      )}
    </Screen>
  );
}
