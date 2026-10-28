import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { ShieldAlert } from 'lucide-react-native';

import { haptics } from '@/lib/haptics';
import { navigate } from '@/lib/nav';
import { useSelectEvent } from '@/hooks/useSelectedEvent';
import { useToast } from '@/hooks/useToast';
import { useAppSelector } from '@/store/hooks';
import { useCreateEventMutation, type MultipartFile } from '@/store/api/eventsApi';
import { useGetMyCompaniesQuery, useGetMyDelegatorsQuery, type OrganizationResult } from '@/store/api/usersApi';
import { EmptyState, GlassHeader, Screen } from '@/components/ui';
import { OrganizerSwitcher } from '@/components/dashboard/OrganizerSwitcher';
import { EventForm, type EventFormSubmit } from '@/components/eventForm/EventForm';
import { OwnerContextSection } from '@/components/eventForm/OwnerContextSection';
import { describeEventSubmitError } from '@/components/eventForm/eventFormRules';

export default function CreateEventScreen() {
  const { t } = useTranslation();
  const toast = useToast();
  const user = useAppSelector((state) => state.auth.user);
  const selectEvent = useSelectEvent();

  const [createEvent, { isLoading: creating }] = useCreateEventMutation();
  const { data: companyGroups } = useGetMyCompaniesQuery(undefined, { skip: !user });
  const { data: delegators } = useGetMyDelegatorsQuery(undefined, { skip: !user });

  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [actingOnBehalfOfId, setActingOnBehalfOfId] = useState<number | null>(null);
  const [ownerOrganization, setOwnerOrganization] = useState<OrganizationResult | null>(null);

  const myCompanies = companyGroups?.find((group) => group.user_id === user?.id)?.companies ?? [];
  const myDelegators = delegators ?? [];
  const isSuperuser = user?.is_superuser === true;

  if (user?.is_email_confirmed === false) {
    return (
      <Screen edges={[]}>
        <GlassHeader title={t('Create an event')} onBack={navigate.back} />
        <View className="flex-1 items-center justify-center px-6">
          <EmptyState
            icon={ShieldAlert}
            title={t('You should have verified account to be able to create events.')}
            actionLabel={t('Back')}
            onAction={navigate.back}
          />
        </View>
      </Screen>
    );
  }

  const handleSubmit = async (payload: EventFormSubmit) => {
    if (!user) return;
    const allowedOwner =
      actingOnBehalfOfId != null &&
      actingOnBehalfOfId !== user.id &&
      (isSuperuser || myDelegators.some((delegator) => delegator.principal_id === actingOnBehalfOfId));
    const ownerId = allowedOwner && actingOnBehalfOfId != null ? actingOnBehalfOfId : user.id;

    const photos: MultipartFile[] = [];
    let video: MultipartFile | undefined;
    payload.media.forEach((item) => {
      if (item.kind === 'image') photos.push({ uri: item.image.uri, name: item.image.name, type: item.image.type });
      else video = { uri: item.video.uri, name: item.video.name, type: item.video.type };
    });

    try {
      const created = await createEvent({
        owner: ownerId,
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
        in_draft: false,
        coupons: payload.coupons,
        photos,
        video,
        questions: payload.questions,
        organizers: payload.organizers,
        timelines: payload.timelines,
        ticket_types: payload.tickets.map((ticket) => ({ ...ticket, currency: payload.currency })),
      }).unwrap();
      haptics.success();
      toast(t('Your event has been created'), 'success');
      if (ownerId === user.id) {
        await selectEvent(created.id);
        navigate.dashboard();
      } else {
        navigate.back();
      }
    } catch (error) {
      haptics.error();
      toast(describeEventSubmitError(error, t) ?? t('We could not create your event. Please try again.'), 'error');
    }
  };

  return (
    <Screen edges={[]}>
      <GlassHeader title={t('Create an event')} onBack={navigate.back} right={<OrganizerSwitcher />} />
      <EventForm
        mode="create"
        submitting={creating}
        onSubmit={(payload) => void handleSubmit(payload)}
        isOrganization={Boolean(user?.is_organization)}
        contextSection={
          <OwnerContextSection
            companies={myCompanies}
            delegators={myDelegators}
            isSuperuser={isSuperuser}
            selectedCompanyId={selectedCompanyId}
            onSelectCompany={setSelectedCompanyId}
            actingOnBehalfOfId={actingOnBehalfOfId}
            onSelectDelegator={(id) => {
              setOwnerOrganization(null);
              setActingOnBehalfOfId(id);
            }}
            ownerOrganization={ownerOrganization}
            onSelectOwnerOrganization={(organization) => {
              setOwnerOrganization(organization);
              setActingOnBehalfOfId(organization?.id ?? null);
            }}
          />
        }
      />
    </Screen>
  );
}
