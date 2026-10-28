import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Modal, Pressable, View } from 'react-native';
import { Building2, Search, UserRound, X } from 'lucide-react-native';

import { cn } from '@/lib/cn';
import { haptics } from '@/lib/haptics';
import { colors } from '@/theme/colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useDebounce } from '@/hooks/useDebounce';
import {
  useLazyGetOrganizationsQuery,
  type AccountDelegator,
  type CompanySummary,
  type OrganizationResult,
} from '@/store/api/usersApi';
import { AppText, Chip, DashedAddButton, EmptyState, GlassInput, PressableScale, ToastHost } from '@/components/ui';
import { UserAvatar, followUserName } from '@/components/social/UserRow';

function delegatorDisplayName(delegator: AccountDelegator): string {
  if (delegator.is_organization && delegator.organization_name) return delegator.organization_name;
  const name = `${delegator.first_name} ${delegator.last_name}`.trim();
  return name || delegator.email;
}

interface OwnerOrganizationPickerProps {
  selected: OrganizationResult | null;
  onSelect: (organization: OrganizationResult | null) => void;
}

function OwnerOrganizationPicker({ selected, onSelect }: OwnerOrganizationPickerProps) {
  const { t } = useTranslation();
  const isDark = useColorScheme() === 'dark';
  const mutedIcon = isDark ? colors.dark.textSecondary : colors.muted;
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const debounced = useDebounce(search, 300);
  const [fetchOrganizations, { data, isFetching }] = useLazyGetOrganizationsQuery();

  useEffect(() => {
    if (open) void fetchOrganizations({ query: debounced.trim(), page: 1 });
  }, [open, debounced, fetchOrganizations]);

  const results = data?.results ?? [];

  return (
    <View className="gap-3">
      <AppText className="font-gilroy-medium text-[13px] text-muted dark:text-dark-muted">
        {t('Select the organizer this event will be published under.')}
      </AppText>
      {selected ? (
        <View className="flex-row items-center gap-3 rounded-[12px] border border-app-border bg-app-bg px-3 py-2.5 dark:border-dark-border dark:bg-dark-bg">
          <UserAvatar uri={selected.profile_image} name={followUserName(selected)} size={36} />
          <AppText numberOfLines={1} className="flex-1 font-gilroy-semibold text-[14px]">
            {followUserName(selected)}
          </AppText>
          <PressableScale onPress={() => onSelect(null)} accessibilityLabel={t('Remove')} hitSlop={8}>
            <AppText className="font-gilroy-semibold text-[13px] text-danger">{t('Remove')}</AppText>
          </PressableScale>
        </View>
      ) : (
        <AppText className="font-gilroy-medium text-[13px] text-primary/70 dark:text-dark-text/70">
          {t('No organizer selected — the event will be created under your account')}
        </AppText>
      )}
      <DashedAddButton
        label={selected ? t('Change Organizer') : t('Select Organizer')}
        onPress={() => {
          setSearch('');
          setOpen(true);
        }}
      />

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable onPress={() => setOpen(false)} className="flex-1 justify-end bg-black/40">
          <Pressable onPress={(event) => event.stopPropagation()} className="h-[80%] rounded-t-[20px] bg-app-bg pt-3 dark:bg-dark-surface">
            <View className="mb-2 flex-row items-center justify-between px-5">
              <AppText className="font-gilroy-bold text-[17px]">{t('Select Organizer')}</AppText>
              <PressableScale
                onPress={() => setOpen(false)}
                accessibilityLabel={t('Done')}
                className="h-9 w-9 items-center justify-center rounded-full bg-black/[0.05] dark:bg-white/10"
              >
                <X size={17} color={mutedIcon} />
              </PressableScale>
            </View>
            <View className="px-5 pb-3">
              <GlassInput
                placeholder={t('Search users or organizations...')}
                value={search}
                onChangeText={setSearch}
                autoCapitalize="none"
                leftIcon={<Search size={16} color={mutedIcon} />}
              />
            </View>
            {isFetching && results.length === 0 ? (
              <ActivityIndicator className="mt-8" color={mutedIcon} />
            ) : (
              <FlatList
                data={results}
                keyExtractor={(item) => String(item.id)}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 8 }}
                ListEmptyComponent={<EmptyState icon={UserRound} title={t('No users found')} />}
                renderItem={({ item }) => {
                  const active = selected?.id === item.id;
                  return (
                    <View className="flex-row items-center gap-3 rounded-[12px] border border-app-border bg-app-surface px-3 py-2.5 dark:border-dark-border dark:bg-dark-bg">
                      <UserAvatar uri={item.profile_image} name={followUserName(item)} size={40} />
                      <View className="flex-1">
                        <AppText numberOfLines={1} className="font-gilroy-semibold text-[14px]">
                          {followUserName(item)}
                        </AppText>
                        {item.is_organization ? (
                          <View className="mt-1 flex-row items-center gap-1">
                            <Building2 size={12} color={mutedIcon} />
                            <AppText className="font-gilroy-medium text-[11px] text-muted dark:text-dark-muted">{t('Organization')}</AppText>
                          </View>
                        ) : null}
                      </View>
                      <PressableScale
                        onPress={() => {
                          haptics.selection();
                          onSelect(item);
                          setOpen(false);
                        }}
                        disabled={active}
                        accessibilityLabel={active ? t('Selected') : t('Select')}
                        className={cn('h-8 justify-center rounded-full px-3.5', active ? 'bg-black/[0.06] dark:bg-white/10' : 'bg-primary dark:bg-white')}
                      >
                        <AppText className={cn('font-gilroy-semibold text-[13px]', active ? 'text-muted' : 'text-white dark:text-dark-bg')}>
                          {active ? t('Selected') : t('Select')}
                        </AppText>
                      </PressableScale>
                    </View>
                  );
                }}
              />
            )}
          </Pressable>
        </Pressable>
        <ToastHost />
      </Modal>
    </View>
  );
}

export interface OwnerContextSectionProps {
  companies: CompanySummary[];
  selectedCompanyId: number | null;
  onSelectCompany: (id: number | null) => void;
  delegators?: AccountDelegator[];
  actingOnBehalfOfId?: number | null;
  onSelectDelegator?: (id: number | null) => void;
  isSuperuser?: boolean;
  ownerOrganization?: OrganizationResult | null;
  onSelectOwnerOrganization?: (organization: OrganizationResult | null) => void;
}

export function OwnerContextSection({
  companies,
  selectedCompanyId,
  onSelectCompany,
  delegators = [],
  actingOnBehalfOfId = null,
  onSelectDelegator,
  isSuperuser = false,
  ownerOrganization = null,
  onSelectOwnerOrganization,
}: OwnerContextSectionProps) {
  const { t } = useTranslation();
  const showCompanies = companies.length > 1;
  const showDelegators = onSelectDelegator != null && delegators.length > 0;
  const showOwner = onSelectOwnerOrganization != null && isSuperuser;
  if (!showCompanies && !showDelegators && !showOwner) return null;

  return (
    <View className="mt-5 gap-5">
      {showCompanies ? (
        <View className="gap-2">
          <AppText className="font-gilroy-bold text-[17px]">{t('Company (SRL)')}</AppText>
          <View className="flex-row flex-wrap gap-2">
            <Chip label={t('— use default —')} selected={selectedCompanyId == null} onPress={() => onSelectCompany(null)} />
            {companies.map((company) => (
              <Chip
                key={company.id}
                label={company.is_default ? `${company.name} (${t('default')})` : company.name}
                selected={selectedCompanyId === company.id}
                onPress={() => onSelectCompany(company.id)}
              />
            ))}
          </View>
        </View>
      ) : null}
      {showDelegators && onSelectDelegator ? (
        <View className="gap-2">
          <AppText className="font-gilroy-bold text-[17px]">{t('Acting on behalf of')}</AppText>
          <View className="flex-row flex-wrap gap-2">
            <Chip label={t('Myself')} selected={actingOnBehalfOfId == null} onPress={() => onSelectDelegator(null)} />
            {delegators.map((delegator) => (
              <Chip
                key={delegator.principal_id}
                label={delegatorDisplayName(delegator)}
                selected={actingOnBehalfOfId === delegator.principal_id}
                onPress={() => onSelectDelegator(delegator.principal_id)}
              />
            ))}
          </View>
        </View>
      ) : null}
      {showOwner && onSelectOwnerOrganization ? (
        <View className="gap-2">
          <AppText className="font-gilroy-bold text-[17px]">{t('Publish as organizer')}</AppText>
          <OwnerOrganizationPicker selected={ownerOrganization} onSelect={onSelectOwnerOrganization} />
        </View>
      ) : null}
    </View>
  );
}
