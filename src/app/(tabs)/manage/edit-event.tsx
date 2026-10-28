import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { CalendarX2 } from 'lucide-react-native';

import { haptics } from '@/lib/haptics';
import { navigate } from '@/lib/nav';
import { useScreenPadding } from '@/hooks/useScreenPadding';
import { useSelectedEvent } from '@/hooks/useSelectedEvent';
import { useToast } from '@/hooks/useToast';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { couponsApi, useGetEventCouponsQuery } from '@/store/api/couponsApi';
import {
  useGetCategoriesQuery,
  useUpdateEventMutation,
  type EventMediaOrderEntry,
  type MultipartFile,
} from '@/store/api/eventsApi';
import { useGetMyCompaniesQuery } from '@/store/api/usersApi';
import { EmptyState, GlassHeader, Screen, Skeleton } from '@/components/ui';
import { EventForm, type EventFormSubmit } from '@/components/eventForm/EventForm';
import { buildEventInitialValues } from '@/components/eventForm/eventInitialValues';
import { OwnerContextSection } from '@/components/eventForm/OwnerContextSection';
import { describeEventSubmitError } from '@/components/eventForm/eventFormRules';

export default function EditEventScreen() {
  const { t } = useTranslation();
  const toast = useToast();
  const dispatch = useAppDispatch();
  const padding = useScreenPadding();
  const user = useAppSelector((state) => state.auth.user);
  const { eventId, data: event, isLoading, isError, refetch } = useSelectedEvent();
  const { data: categories, isLoading: categoriesLoading } = useGetCategoriesQuery();
  const coupons = useGetEventCouponsQuery(eventId ?? 0, { skip: eventId == null });
  const { data: companyGroups } = useGetMyCompaniesQuery(undefined, { skip: !user });
  const [updateEvent, { isLoading: updating }] = useUpdateEventMutation();
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);

  const couponsReadable = coupons.isSuccess || Array.isArray(event?.coupons);
  const initialValues = useMemo(
    () => (event ? buildEventInitialValues(event, categories, coupons.isSuccess ? coupons.data : undefined) : undefined),
    [event, categories, coupons.isSuccess, coupons.data],
  );
  const myCompanies = companyGroups?.find((group) => group.user_id === user?.id)?.companies ?? [];

  const handleSubmit = async (payload: EventFormSubmit) => {
    if (!event) return;
    const existingImageIds: number[] = [];
    const newPhotos: MultipartFile[] = [];
    let newVideo: MultipartFile | undefined;
    let hasVideo = false;
    let photoIndex = 0;
    const mediaOrder: EventMediaOrderEntry[] = payload.media.map((item) => {
      if (item.kind === 'video') {
        hasVideo = true;
        if (!item.video.existing) newVideo = { uri: item.video.uri, name: item.video.name, type: item.video.type };
        return { type: 'video' };
      }
      if (item.image.id != null) {
        existingImageIds.push(item.image.id);
        return { type: 'image', existing_image_id: item.image.id };
      }
      newPhotos.push({ uri: item.image.uri, name: item.image.name, type: item.image.type });
      return { type: 'image', photo_index: photoIndex++ };
    });

    try {
      await updateEvent({
        id: event.id,
        company: selectedCompanyId ?? undefined,
        title: payload.title,
        description: payload.description,
        category: payload.category,
        type: payload.type,
        currency: payload.currency,
        start_date: payload.start_date,
        start_time: payload.start_time,
        end_date: payload.end_date || undefined,
        end_time: payload.end_time || undefined,
        time_is_tba: payload.time_is_tba,
        event_location_type: payload.event_location_type,
        location_is_tba: payload.location_is_tba,
        country: payload.country,
        region: payload.region,
        address: payload.address,
        coordinates: payload.coordinates ?? undefined,
        in_draft: payload.inDraft ?? false,
        coupons: couponsReadable ? payload.coupons : undefined,
        newPhotos,
        existingImageIds,
        mediaOrder,
        video: newVideo,
        removeVideo: !hasVideo && Boolean(event.video),
        questions: payload.questions,
        organizers: payload.organizers,
        timelines: payload.timelines,
        ticket_types: payload.tickets.map((ticket) => ({ ...ticket, currency: payload.currency })),
      }).unwrap();
      dispatch(couponsApi.util.invalidateTags([{ type: 'Coupons', id: event.id }]));
      haptics.success();
      toast(t('Your changes have been saved'), 'success');
      navigate.dashboard();
    } catch (error) {
      haptics.error();
      toast(describeEventSubmitError(error, t) ?? t('We could not save your changes. Please try again.'), 'error');
    }
  };

  if (isLoading || categoriesLoading || coupons.isLoading) {
    return (
      <Screen edges={[]}>
        <GlassHeader title={t('Edit event')} onBack={navigate.back} />
        <View className="gap-4 px-5" style={{ paddingTop: padding.top + 4 }}>
          <Skeleton className="h-52 w-full rounded-[14px]" />
          <Skeleton className="h-9 w-3/4 rounded-[10px]" />
          <Skeleton className="h-32 w-full rounded-[12px]" />
          <Skeleton className="h-40 w-full rounded-[18px]" />
        </View>
      </Screen>
    );
  }

  if (isError || !event || !initialValues) {
    return (
      <Screen edges={[]}>
        <GlassHeader title={t('Edit event')} onBack={navigate.back} />
        <View className="flex-1 items-center justify-center px-6">
          <EmptyState
            icon={CalendarX2}
            title={t('Could not load the event. Please refresh and try again.')}
            actionLabel={t('Try again')}
            onAction={() => void refetch()}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={[]}>
      <GlassHeader title={t('Edit event')} onBack={navigate.back} />
      <EventForm
        key={event.id}
        mode="edit"
        initialValues={initialValues}
        submitting={updating}
        onSubmit={(payload) => void handleSubmit(payload)}
        isOrganization={Boolean(user?.is_organization)}
        couponsEditable={couponsReadable}
        submitLabel={t('Save changes')}
        stickySubmit={false}
        contextSection={
          <OwnerContextSection companies={myCompanies} selectedCompanyId={selectedCompanyId} onSelectCompany={setSelectedCompanyId} />
        }
      />
    </Screen>
  );
}
