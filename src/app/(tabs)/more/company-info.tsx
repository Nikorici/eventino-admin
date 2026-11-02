import { useCallback, useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useTranslation } from 'react-i18next';
import { Building2 } from 'lucide-react-native';

import { AppText, EmptyState, GlassButton, GlassHeader, GlassInput, Screen, Skeleton } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useScreenPadding } from '@/hooks/useScreenPadding';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useToast } from '@/hooks/useToast';
import { navigate } from '@/lib/nav';
import {
  useGetCompanyProfileQuery,
  useUpdateCompanyProfileMutation,
  type CompanyProfile,
} from '@/store/api/companyApi';
import { colors } from '@/theme/colors';

function CompanyForm({ userId, profile }: { userId: number; profile: CompanyProfile }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [updateCompany, { isLoading: saving }] = useUpdateCompanyProfileMutation();
  const [companyName, setCompanyName] = useState(profile.company_name ?? '');
  const [companyCui, setCompanyCui] = useState(profile.company_cui ?? '');

  const onSave = async () => {
    try {
      await updateCompany({ userId, company: { company_name: companyName, company_cui: companyCui } }).unwrap();
      toast(t('Company information updated successfully!'), 'success');
    } catch {
      toast(t('Failed to update company information. Please try again.'), 'error');
    }
  };

  const onCancel = () => {
    setCompanyName(profile.company_name ?? '');
    setCompanyCui(profile.company_cui ?? '');
  };

  return (
    <View className="gap-4">
      <GlassInput
        label={t('Company Name')}
        placeholder="Acme Corporation SRL"
        value={companyName}
        onChangeText={setCompanyName}
        autoCapitalize="words"
      />
      <GlassInput
        label={t('CUI')}
        placeholder="RO12345678"
        value={companyCui}
        onChangeText={setCompanyCui}
        autoCapitalize="characters"
        autoCorrect={false}
      />
      <View className="mt-2 gap-3">
        <GlassButton
          label={saving ? t('Saving...') : t('Save Changes')}
          onPress={() => void onSave()}
          loading={saving}
        />
        <GlassButton label={t('Cancel')} variant="secondary" onPress={onCancel} disabled={saving} />
      </View>
    </View>
  );
}

function CompanyFormSkeleton() {
  return (
    <View className="gap-4">
      {[0, 1].map((index) => (
        <View key={index} className="gap-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-12 w-full rounded-[14px]" />
        </View>
      ))}
      <View className="mt-2 gap-3">
        <Skeleton className="h-12 w-full rounded-full" />
        <Skeleton className="h-12 w-full rounded-full" />
      </View>
    </View>
  );
}

export default function CompanyInfoScreen() {
  const { t } = useTranslation();
  const padding = useScreenPadding();
  const { user } = useAuth();
  const iconColor = useThemeColor(colors.primary, colors.dark.text);
  const spinnerColor = useThemeColor(colors.primary, colors.dark.text);
  const userId = user?.id;
  const { data, isLoading, isError, refetch } = useGetCompanyProfileQuery(userId ?? 0, { skip: userId == null });
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  return (
    <Screen edges={[]}>
      <GlassHeader title={t('Company Information')} onBack={navigate.back} />
      <KeyboardAwareScrollView
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: padding.top, paddingBottom: padding.bottom, paddingHorizontal: 16 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={spinnerColor}
            colors={[spinnerColor]}
            progressViewOffset={padding.top}
          />
        }
      >
        <View className="gap-4">
          <View className="flex-row items-center gap-3">
            <View className="h-9 w-9 items-center justify-center rounded-[9px] bg-black/[0.04] dark:bg-white/10">
              <Building2 size={18} color={iconColor} />
            </View>
            <AppText className="flex-1 font-gilroy-medium text-[15px] text-primary/70 dark:text-dark-text/70">
              {t('Manage your company details')}
            </AppText>
          </View>
          {isLoading || userId == null ? (
            <CompanyFormSkeleton />
          ) : isError || !data ? (
            <EmptyState
              icon={Building2}
              title={t('Something went wrong.')}
              message={t('Please try again.')}
              actionLabel={t('Try again')}
              onAction={() => void refetch()}
            />
          ) : (
            <CompanyForm key={`${data.company_name ?? ''}|${data.company_cui ?? ''}`} userId={userId} profile={data} />
          )}
        </View>
      </KeyboardAwareScrollView>
    </Screen>
  );
}
