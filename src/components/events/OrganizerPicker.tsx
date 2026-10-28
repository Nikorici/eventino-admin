import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Modal, Pressable, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Image } from 'expo-image';
import { Search, UserRound, X } from 'lucide-react-native';

import { haptics } from '@/lib/haptics';
import { colors } from '@/theme/colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useDebounce } from '@/hooks/useDebounce';
import { useLazyGetOrganizationsQuery, type OrganizationResult } from '@/store/api/usersApi';
import { AppText, DashedAddButton, EmptyState, GlassInput, PressableScale, Skeleton } from '@/components/ui';

export interface SelectedOrganizer {
  id: number;
  first_name: string;
  last_name: string;
  organization_name: string | null;
  profile_image: string | null;
}

export function organizerDisplayName(organizer: SelectedOrganizer): string {
  return organizer.organization_name?.trim() || `${organizer.first_name} ${organizer.last_name}`.trim();
}

function Avatar({ uri, name }: { uri: string | null; name: string }) {
  const initial = name.charAt(0).toUpperCase();
  return (
    <View className="h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/10">
      {uri ? (
        <Image source={{ uri }} contentFit="cover" transition={100} style={{ width: '100%', height: '100%' }} />
      ) : initial ? (
        <AppText className="font-gilroy-bold text-[15px] text-muted dark:text-dark-muted">{initial}</AppText>
      ) : (
        <UserRound size={16} color={colors.muted} />
      )}
    </View>
  );
}

export interface OrganizerPickerProps {
  selected: SelectedOrganizer[];
  onChange: (organizers: SelectedOrganizer[]) => void;
  excludeUserId?: number;
}

export function OrganizerPicker({ selected, onChange, excludeUserId }: OrganizerPickerProps) {
  const { t } = useTranslation();
  const isDark = useColorScheme() === 'dark';
  const mutedIcon = isDark ? colors.dark.textSecondary : colors.muted;

  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [results, setResults] = useState<OrganizationResult[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchOrganizations] = useLazyGetOrganizationsQuery();

  const loadPage = useCallback(
    async (query: string, pageToLoad: number) => {
      setLoading(true);
      try {
        const data = await fetchOrganizations({ query, page: pageToLoad }).unwrap();
        setResults((prev) => (pageToLoad === 1 ? data.results : [...prev, ...data.results]));
        setHasMore(Boolean(data.next));
        setPage(pageToLoad);
      } catch {
        if (pageToLoad === 1) setResults([]);
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    },
    [fetchOrganizations],
  );

  useEffect(() => {
    if (!modalOpen) return;
    setResults([]);
    void loadPage(debouncedSearch.trim(), 1);
  }, [debouncedSearch, modalOpen, loadPage]);

  const openModal = () => {
    haptics.selection();
    setSearch('');
    setResults([]);
    setModalOpen(true);
  };

  const addOrganizer = (candidate: OrganizationResult) => {
    if (selected.some((organizer) => organizer.id === candidate.id)) return;
    haptics.success();
    onChange([
      ...selected,
      {
        id: candidate.id,
        first_name: candidate.first_name,
        last_name: candidate.last_name,
        organization_name: candidate.organization_name,
        profile_image: candidate.profile_image,
      },
    ]);
  };

  const removeOrganizer = (id: number) => {
    haptics.selection();
    onChange(selected.filter((organizer) => organizer.id !== id));
  };

  const visibleResults = results.filter(
    (candidate) => candidate.id !== excludeUserId && !selected.some((organizer) => organizer.id === candidate.id),
  );

  return (
    <View className="gap-3">
      {selected.length === 0 ? (
        <AppText className="font-gilroy-medium text-[13px] text-muted dark:text-dark-muted">{t('No organizers added yet')}</AppText>
      ) : (
        <View className="gap-2">
          {selected.map((organizer) => (
            <View
              key={organizer.id}
              className="flex-row items-center gap-3 rounded-[12px] border border-app-border bg-app-surface px-3 py-2.5 dark:border-dark-border dark:bg-dark-surface"
            >
              <Avatar uri={organizer.profile_image} name={organizerDisplayName(organizer)} />
              <AppText numberOfLines={1} className="flex-1 font-gilroy-semibold text-[14px]">
                {organizerDisplayName(organizer)}
              </AppText>
              <PressableScale
                onPress={() => removeOrganizer(organizer.id)}
                accessibilityLabel={t('Remove')}
                className="h-8 w-8 items-center justify-center rounded-full bg-danger/10"
              >
                <X size={15} color={colors.danger} />
              </PressableScale>
            </View>
          ))}
        </View>
      )}

      <DashedAddButton label={t('Add Organizer')} onPress={openModal} />

      <Modal visible={modalOpen} transparent animationType="fade" onRequestClose={() => setModalOpen(false)}>
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          <Pressable onPress={() => setModalOpen(false)} className="flex-1 justify-end bg-black/40">
            <Pressable onPress={(event) => event.stopPropagation()} className="h-[80%] rounded-t-[20px] bg-app-bg pt-3 dark:bg-dark-surface">
              <View className="mb-2 flex-row items-center justify-between px-5">
                <AppText className="font-gilroy-bold text-[17px]">{t('Add Organizers')}</AppText>
                <PressableScale
                  onPress={() => setModalOpen(false)}
                  accessibilityLabel={t('Cancel')}
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
              <FlatList
                data={visibleResults}
                keyExtractor={(item) => String(item.id)}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 10 }}
                onEndReachedThreshold={0.4}
                onEndReached={() => {
                  if (!loading && hasMore) void loadPage(debouncedSearch.trim(), page + 1);
                }}
                ListEmptyComponent={
                  loading ? (
                    <View className="gap-2.5">
                      <Skeleton className="h-14 w-full rounded-[12px]" />
                      <Skeleton className="h-14 w-full rounded-[12px]" />
                      <Skeleton className="h-14 w-full rounded-[12px]" />
                    </View>
                  ) : (
                    <EmptyState icon={UserRound} title={t('No results found')} />
                  )
                }
                renderItem={({ item }) => {
                  const name = organizerDisplayName(item);
                  return (
                    <View className="flex-row items-center gap-3 rounded-[12px] border border-app-border bg-app-surface px-3 py-2.5 dark:border-dark-border dark:bg-dark-surface">
                      <Avatar uri={item.profile_image} name={name} />
                      <AppText numberOfLines={1} className="flex-1 font-gilroy-semibold text-[14px]">
                        {name}
                      </AppText>
                      <PressableScale
                        onPress={() => addOrganizer(item)}
                        accessibilityLabel={t('Add')}
                        className="rounded-full bg-primary px-4 py-2 dark:bg-white"
                      >
                        <AppText className="font-gilroy-semibold text-[13px] text-white dark:text-dark-bg">{t('Add')}</AppText>
                      </PressableScale>
                    </View>
                  );
                }}
              />
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
