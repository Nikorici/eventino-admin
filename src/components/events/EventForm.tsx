import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { KeyboardAwareScrollView, KeyboardStickyView } from 'react-native-keyboard-controller';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Controller,
  useFieldArray,
  useForm,
  useFormState,
  useWatch,
  type Control,
  type FieldErrors,
  type FieldPath,
  type UseFormSetValue,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  FileText,
  ImagePlus,
  Link2,
  MapPin,
  MessageCircleQuestion,
  Plus,
  Search,
  Tag,
  Ticket as TicketIcon,
  Trash2,
  Users,
  Video,
  X,
  type LucideIcon,
} from 'lucide-react-native';

import { cn } from '@/lib/cn';
import { formatEventDay } from '@/lib/format';
import { eventDaysBetween, pinnedEventDay } from '@/lib/ticketDays';
import { haptics } from '@/lib/haptics';
import { colors } from '@/theme/colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useToast } from '@/hooks/useToast';
import { useAppSelector } from '@/store/hooks';
import {
  useGetCategoriesQuery,
  type EventCouponInput,
  type EventLocationType,
  type EventOrganizerInput,
  type EventQuestionInput,
  type EventTimelineInput,
} from '@/store/api/eventsApi';
import type { Category, EventType } from '@/types/api';
import {
  AppText,
  DashedAddButton,
  EmptyState,
  GlassButton,
  GlassInput,
  GlassSurface,
  PressableScale,
  SegmentedControl,
  Skeleton,
  Stepper,
  ToastHost,
} from '@/components/ui';

import { EventFormDateTimeField } from './EventFormDateTimeField';
import { LocationAutocompleteField } from './LocationAutocompleteField';
import { OrganizerPicker, type SelectedOrganizer } from './OrganizerPicker';
import { QuestionsBuilder, QUESTION_OPTION_TYPES, type EventFormQuestion } from './QuestionsBuilder';
import { TimelineEditor, type EventFormTimelineItem } from './TimelineEditor';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const PRICE_REGEX = /^\d+(\.\d{1,2})?$/;
const QUANTITY_REGEX = /^\d*$/;
const URL_REGEX =
  /^(https?:\/\/)?((([a-z\d]([a-z\d-]*[a-z\d])*)\.)+[a-z]{2,}|((\d{1,3}\.){3}\d{1,3}))(:\d+)?(\/[-a-z\d%_.~+]*)*(\?[;&a-z\d%_.~+=-]*)?(#[-a-z\d_]*)?$/i;

const MAX_IMAGES = 6;
const MAX_IMAGE_DIMENSION = 1920;
const IMAGE_COMPRESSION_QUALITY = 0.8;
const VIDEO_MAX_BYTES = 100 * 1024 * 1024;
const VIDEO_ALLOWED_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

const CURRENCIES = ['RON', 'EUR', 'USD', 'MDL'] as const;
const CURRENCY_SYMBOLS: Record<string, string> = { RON: 'RON', EUR: '€', USD: '$', MDL: 'MDL' };

export type EventFormMode = 'create' | 'edit';

export interface EventFormImage {
  id: number | null;
  uri: string;
  name: string;
  type: string;
}

export interface EventFormVideo {
  uri: string;
  name: string;
  type: string;
  existing: boolean;
}

export type EventFormMediaItem =
  | { kind: 'image'; image: EventFormImage }
  | { kind: 'video'; video: EventFormVideo };

export interface EventFormInitialTicket {
  id?: number;
  name: string;
  price: number;
  quantity: number | null;
  comment: string;
  isFree: boolean;
  saleStartDate: string | null;
  saleEndDate: string | null;
  isActive: boolean;
  qrCodeQuantity: number;
  showRemainingTickets: boolean;
  isTable: boolean;
  eventDay?: string | null;
}

export interface EventFormInitialValues {
  title?: string;
  description?: string;
  category?: number | null;
  type?: EventType;
  currency?: string;
  startDate?: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
  timeTba?: boolean;
  eventLocationType?: EventLocationType;
  locationTba?: boolean;
  country?: string;
  region?: string;
  address?: string;
  coordinates?: { lat: number; long: number } | null;
  inDraft?: boolean;
  media?: EventFormMediaItem[];
  tickets?: EventFormInitialTicket[];
  questions?: EventFormQuestion[];
  timelines?: EventFormTimelineItem[];
  organizers?: SelectedOrganizer[];
  coupons?: EventCouponInput[];
}

export interface EventFormSubmitTicket {
  id?: number;
  name: string;
  price: number;
  quantity: number | null;
  comment: string;
  sale_start_date: string | null;
  sale_end_date: string | null;
  is_active: boolean;
  qr_code_quantity: number;
  show_remaining_tickets: boolean;
  is_table: boolean;
  event_day: string | null;
}

export interface EventFormSubmit {
  title: string;
  description: string;
  category: number;
  type: EventType;
  currency: string;
  start_date: string;
  start_time: string;
  end_date: string;
  end_time: string;
  time_is_tba: boolean;
  event_location_type: EventLocationType;
  location_is_tba: boolean;
  country: string;
  region: string;
  address: string;
  coordinates?: { lat: number; long: number } | null;
  inDraft?: boolean;
  media: EventFormMediaItem[];
  tickets: EventFormSubmitTicket[];
  questions: EventQuestionInput[];
  timelines: EventTimelineInput[];
  organizers: EventOrganizerInput[];
  coupons: EventCouponInput[];
}

export interface EventFormProps {
  mode: EventFormMode;
  initialValues?: EventFormInitialValues;
  submitting: boolean;
  onSubmit: (payload: EventFormSubmit) => void;
  submitLabel?: string;
  headerNotice?: ReactNode;
  contextSection?: ReactNode;
  isOrganization?: boolean;
  couponsEditable?: boolean;
}

const ticketSchema = z.object({
  ticketId: z.number().optional(),
  name: z.string().refine((value) => value.trim().length > 0, { message: 'Ticket name is required' }),
  price: z.string(),
  quantity: z.string(),
  comment: z.string(),
  isFree: z.boolean(),
  saleStartDate: z.string(),
  saleStartTime: z.string(),
  saleEndDate: z.string(),
  saleEndTime: z.string(),
  isActive: z.boolean(),
  qrCodeQuantity: z.number(),
  showRemainingTickets: z.boolean(),
  isTable: z.boolean(),
  eventDay: z.string(),
});

const schema = z
  .object({
    title: z.string().refine((value) => value.trim().length > 0, { message: 'Event title is required' }),
    description: z.string().refine((value) => value.trim().length > 0, { message: 'Description is required' }),
    category: z.number().min(1, 'Please select a category'),
    type: z.enum(['PUBLIC', 'PERSONAL', 'PRIVATE']),
    currency: z.string(),
    startDate: z.string().regex(DATE_REGEX, 'Select a start date'),
    startTime: z.string(),
    endDate: z.string().regex(DATE_REGEX, 'Select an end date'),
    endTime: z.string(),
    timeTba: z.boolean(),
    isOnline: z.boolean(),
    locationTba: z.boolean(),
    country: z.string(),
    region: z.string(),
    address: z.string(),
    tickets: z.array(ticketSchema).min(1, 'Add at least one ticket type'),
  })
  .superRefine((values, ctx) => {
    if (values.isOnline) {
      if (values.address.trim().length === 0) {
        ctx.addIssue({ code: 'custom', path: ['address'], message: 'A meeting link is required' });
      } else if (!URL_REGEX.test(values.address.trim())) {
        ctx.addIssue({ code: 'custom', path: ['address'], message: 'Please enter a valid meeting link' });
      }
    } else if (!values.locationTba) {
      if (values.country.trim().length === 0) {
        ctx.addIssue({ code: 'custom', path: ['country'], message: 'Please select a location from the suggestions' });
      }
      if (values.address.trim().length === 0) {
        ctx.addIssue({ code: 'custom', path: ['address'], message: 'Address is required' });
      }
    } else if (values.country.trim().length === 0) {
      ctx.addIssue({ code: 'custom', path: ['country'], message: 'Country is required' });
    }

    if (!values.timeTba) {
      if (!TIME_REGEX.test(values.startTime)) {
        ctx.addIssue({ code: 'custom', path: ['startTime'], message: 'Select a start time' });
      }
      if (!TIME_REGEX.test(values.endTime)) {
        ctx.addIssue({ code: 'custom', path: ['endTime'], message: 'Select an end time' });
      }
    }

    if (values.startDate && values.endDate) {
      const hasTimes = !values.timeTba && TIME_REGEX.test(values.startTime) && TIME_REGEX.test(values.endTime);
      const start = new Date(`${values.startDate}T${hasTimes ? values.startTime : '00:00'}:00`);
      const end = new Date(`${values.endDate}T${hasTimes ? values.endTime : '00:00'}:00`);
      if (hasTimes ? end <= start : end < start) {
        ctx.addIssue({ code: 'custom', path: ['endTime'], message: 'End must be after the start' });
      }
    }

    values.tickets.forEach((ticket, index) => {
      if (!ticket.isFree && !PRICE_REGEX.test(ticket.price)) {
        ctx.addIssue({ code: 'custom', path: ['tickets', index, 'price'], message: 'Enter a valid price' });
      }
      if (ticket.quantity.trim().length > 0 && !QUANTITY_REGEX.test(ticket.quantity)) {
        ctx.addIssue({ code: 'custom', path: ['tickets', index, 'quantity'], message: 'Enter a valid number' });
      }
      if (ticket.saleStartTime && !ticket.saleStartDate) {
        ctx.addIssue({ code: 'custom', path: ['tickets', index, 'saleStartDate'], message: 'Select a sales start date' });
      }
      if (ticket.saleEndTime && !ticket.saleEndDate) {
        ctx.addIssue({ code: 'custom', path: ['tickets', index, 'saleEndDate'], message: 'Select a sales end date' });
      }
      if (ticket.saleStartDate && ticket.saleEndDate) {
        const saleStart = new Date(`${ticket.saleStartDate}T${ticket.saleStartTime || '00:00'}:00`);
        const saleEnd = new Date(`${ticket.saleEndDate}T${ticket.saleEndTime || '23:59'}:59`);
        if (saleEnd <= saleStart) {
          ctx.addIssue({ code: 'custom', path: ['tickets', index, 'saleEndDate'], message: 'Sales must end after they start' });
        }
      }
    });
  });

type FormValues = z.infer<typeof schema>;

const EVENT_FORM_ERROR_ORDER: (keyof FormValues)[] = [
  'title',
  'description',
  'category',
  'startDate',
  'startTime',
  'endDate',
  'endTime',
  'country',
  'address',
  'region',
];

function firstEventFormError(formErrors: FieldErrors<FormValues>, translate: (key: string) => string): string | undefined {
  for (const key of EVENT_FORM_ERROR_ORDER) {
    const message = formErrors[key]?.message;
    if (typeof message === 'string') return translate(message);
  }
  const ticketErrors = formErrors.tickets;
  if (Array.isArray(ticketErrors)) {
    for (const ticketError of ticketErrors) {
      if (!ticketError) continue;
      for (const field of ['name', 'price', 'quantity', 'saleStartDate', 'saleEndDate'] as const) {
        const message = ticketError[field]?.message;
        if (typeof message === 'string') return translate(message);
      }
    }
  } else if (ticketErrors && typeof ticketErrors.message === 'string') {
    return translate(ticketErrors.message);
  }
  return undefined;
}

const DEFAULT_TICKET: FormValues['tickets'][number] = {
  name: '',
  price: '0',
  quantity: '',
  comment: '',
  isFree: false,
  saleStartDate: '',
  saleStartTime: '',
  saleEndDate: '',
  saleEndTime: '',
  isActive: true,
  qrCodeQuantity: 1,
  showRemainingTickets: false,
  isTable: false,
  eventDay: '',
};

const pad2 = (value: number) => String(value).padStart(2, '0');

function localDatePart(value: string | null): string {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return `${parsed.getFullYear()}-${pad2(parsed.getMonth() + 1)}-${pad2(parsed.getDate())}`;
}

function localTimePart(value: string | null): string {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return `${pad2(parsed.getHours())}:${pad2(parsed.getMinutes())}`;
}

function toAbsoluteIso(date: string, time: string, fallbackTime: string): string | null {
  if (!date) return null;
  const [year, month, day] = date.split('-').map(Number);
  const [hours, minutes] = (time || fallbackTime).split(':').map(Number);
  if (!year || !month || !day) return null;
  const parsed = new Date(year, month - 1, day, hours || 0, minutes || 0, 0, 0);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function toFormValues(initial?: EventFormInitialValues): FormValues {
  return {
    title: initial?.title ?? '',
    description: initial?.description ?? '',
    category: initial?.category ?? 0,
    type: initial?.type ?? 'PUBLIC',
    currency: initial?.currency ?? 'RON',
    startDate: initial?.startDate ?? '',
    startTime: initial?.startTime ?? '',
    endDate: initial?.endDate ?? '',
    endTime: initial?.endTime ?? '',
    timeTba: initial?.timeTba ?? false,
    isOnline: initial?.eventLocationType === 'virtual',
    locationTba: initial?.locationTba ?? false,
    country: initial?.country ?? '',
    region: initial?.region ?? '',
    address: initial?.address ?? '',
    tickets:
      initial?.tickets && initial.tickets.length > 0
        ? initial.tickets.map((ticket) => ({
            ticketId: ticket.id,
            name: ticket.name,
            price: ticket.isFree ? '0' : String(ticket.price),
            quantity: ticket.quantity != null ? String(ticket.quantity) : '',
            comment: ticket.comment,
            isFree: ticket.isFree,
            saleStartDate: localDatePart(ticket.saleStartDate),
            saleStartTime: localTimePart(ticket.saleStartDate),
            saleEndDate: localDatePart(ticket.saleEndDate),
            saleEndTime: localTimePart(ticket.saleEndDate),
            isActive: ticket.isActive,
            qrCodeQuantity: ticket.qrCodeQuantity,
            showRemainingTickets: ticket.showRemainingTickets,
            isTable: ticket.isTable,
            eventDay: ticket.eventDay ?? '',
          }))
        : [DEFAULT_TICKET],
  };
}

function fileNameFromUri(uri: string, fallback: string): string {
  const last = uri.split('/').pop();
  return last && last.length > 0 ? last : fallback;
}

function withJpgExtension(name: string): string {
  const stripped = name.replace(/\.[^.]+$/, '');
  return `${stripped || `image-${Date.now()}`}.jpg`;
}

function videoMimeFromName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith('.webm')) return 'video/webm';
  if (lower.endsWith('.mov')) return 'video/quicktime';
  return 'video/mp4';
}

interface ControlledTextInputProps {
  control: Control<FormValues>;
  name: FieldPath<FormValues>;
  label?: string;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: TextInputProps['keyboardType'];
  autoCapitalize?: TextInputProps['autoCapitalize'];
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  containerClassName?: string;
  editable?: boolean;
}

function ControlledTextInput({
  control,
  name,
  label,
  placeholder,
  multiline,
  keyboardType,
  autoCapitalize,
  leftIcon,
  rightIcon,
  containerClassName,
  editable,
}: ControlledTextInputProps) {
  const { t } = useTranslation();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <GlassInput
          label={label}
          placeholder={placeholder}
          value={typeof field.value === 'string' ? field.value : ''}
          onChangeText={field.onChange}
          onBlur={field.onBlur}
          error={fieldState.error?.message ? t(fieldState.error.message) : undefined}
          leftIcon={leftIcon}
          rightIcon={rightIcon}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          containerClassName={containerClassName}
          editable={editable}
          className={cn(multiline && 'h-full py-1', editable === false && 'opacity-60')}
        />
      )}
    />
  );
}

function SectionTitle({ children, required }: { children: string; required?: boolean }) {
  return (
    <View className="mb-3 flex-row items-center">
      <AppText className="font-gilroy-bold text-[17px]">{children}</AppText>
      {required ? <AppText className="ml-0.5 font-gilroy-bold text-[17px] text-danger">*</AppText> : null}
    </View>
  );
}

interface FormSectionProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  required?: boolean;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

function FormSection({ icon: Icon, title, subtitle, required, action, children, className }: FormSectionProps) {
  const isDark = useColorScheme() === 'dark';
  return (
    <View className={cn('mt-4 rounded-[18px] border border-app-border bg-app-surface p-4 dark:border-dark-border dark:bg-dark-surface', className)}>
      <View className="mb-3.5 flex-row items-center gap-2.5">
        <View className="h-8 w-8 items-center justify-center rounded-full bg-links/10 dark:bg-white/10">
          <Icon size={16} color={isDark ? colors.dark.text : colors.links} />
        </View>
        <View className="flex-1 flex-row items-center">
          <AppText className="font-gilroy-bold text-[16px]">{title}</AppText>
          {required ? <AppText className="ml-0.5 font-gilroy-bold text-[16px] text-danger">*</AppText> : null}
        </View>
        {action}
      </View>
      {subtitle ? <AppText className="-mt-2 mb-3 font-gilroy-medium text-[12px] text-muted dark:text-dark-muted">{subtitle}</AppText> : null}
      {children}
    </View>
  );
}

interface ToggleRowProps {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  icon?: ReactNode;
  disabled?: boolean;
}

function ToggleRow({ label, description, value, onValueChange, icon, disabled }: ToggleRowProps) {
  return (
    <PressableScale
      onPress={() => {
        if (disabled) return;
        haptics.selection();
        onValueChange(!value);
      }}
      disabled={disabled}
      accessibilityLabel={label}
      className={cn(
        'flex-row items-center justify-between rounded-[12px] border px-4 py-3',
        value
          ? 'border-primary bg-app-surface dark:border-white/40 dark:bg-dark-surface'
          : 'border-app-border bg-app-surface dark:border-dark-border dark:bg-dark-surface',
        disabled && 'opacity-60',
      )}
    >
      <View className="flex-1 flex-row items-center gap-2.5 pr-3">
        {icon}
        <View className="flex-1">
          <AppText className="font-gilroy-semibold text-[14px]">{label}</AppText>
          {description ? (
            <AppText className="mt-0.5 font-gilroy-medium text-[12px] text-muted dark:text-dark-muted">{description}</AppText>
          ) : null}
        </View>
      </View>
      <View className={cn('h-[26px] w-[44px] justify-center rounded-full p-[3px]', value ? 'bg-primary dark:bg-white' : 'bg-black/15 dark:bg-white/20')}>
        <View className={cn('h-5 w-5 rounded-full bg-white dark:bg-dark-bg', value && 'self-end')} />
      </View>
    </PressableScale>
  );
}

interface LocationTypeToggleProps {
  value: boolean;
  onChange: (online: boolean) => void;
}

function LocationTypeToggle({ value, onChange }: LocationTypeToggleProps) {
  const { t } = useTranslation();
  const isDark = useColorScheme() === 'dark';
  const activeIcon = isDark ? colors.dark.text : colors.links;
  const inactiveIcon = colors.muted;

  const option = (online: boolean, icon: ReactNode, label: string) => {
    const active = value === online;
    return (
      <View className="flex-1">
        <PressableScale
          onPress={() => {
            haptics.selection();
            onChange(online);
          }}
          accessibilityLabel={label}
          className={cn(
            'h-12 w-full flex-row items-center justify-center gap-2 rounded-[10px] border',
            active
              ? 'border-links/40 bg-links/10 dark:border-white/30 dark:bg-white/10'
              : 'border-transparent bg-black/[0.04] dark:bg-white/[0.06]',
          )}
        >
          {icon}
          <AppText className={cn('font-gilroy-semibold text-[14px]', active ? 'text-links dark:text-dark-text' : 'text-muted dark:text-dark-muted')}>
            {label}
          </AppText>
        </PressableScale>
      </View>
    );
  };

  return (
    <View className="flex-row gap-2.5">
      {option(false, <MapPin size={18} color={value ? inactiveIcon : activeIcon} />, t('Physical Location'))}
      {option(true, <Video size={18} color={value ? activeIcon : inactiveIcon} />, t('Virtual Meeting'))}
    </View>
  );
}

interface MediaStripProps {
  media: EventFormMediaItem[];
  error?: string;
  onAddImages: () => void;
  onAddVideo: () => void;
  onRemove: (index: number) => void;
  onMove: (index: number, direction: -1 | 1) => void;
}

function MediaStrip({ media, error, onAddImages, onAddVideo, onRemove, onMove }: MediaStripProps) {
  const { t } = useTranslation();
  const isDark = useColorScheme() === 'dark';

  const imageCount = media.filter((item) => item.kind === 'image').length;
  const hasVideo = media.some((item) => item.kind === 'video');
  const firstImageIndex = media.findIndex((item) => item.kind === 'image');

  return (
    <View className="gap-2">
      {media.length === 0 ? (
        <PressableScale onPress={onAddImages} accessibilityLabel={t('Upload images')}>
          <View
            className="h-52 w-full items-center justify-center gap-2.5 overflow-hidden rounded-[14px] border-2 border-dashed px-4"
            style={{ borderColor: isDark ? '#5aa9e6' : '#4a90e2' }}
          >
            <LinearGradient colors={isDark ? [colors.dark.surface, colors.dark.elevated] : ['#f8fbff', '#eef4ff']} style={StyleSheet.absoluteFill} />
            <View className="h-14 w-14 items-center justify-center rounded-full" style={{ backgroundColor: 'rgba(97,133,157,0.14)' }}>
              <ImagePlus size={28} color="#61859d" />
            </View>
            <AppText className="font-gilroy-semibold text-[16px] text-primary dark:text-dark-text">{t('Upload images')}</AppText>
            <AppText className="font-gilroy-medium text-[12px] text-muted">{t('PNG, JPG, WEBP - max 10MB each')}</AppText>
          </View>
        </PressableScale>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 12 }}>
          {media.map((item, index) => (
            <View
              key={item.kind === 'image' ? `${item.image.uri}-${index}` : `video-${index}`}
              className="h-40 w-32 overflow-hidden rounded-[14px] border border-app-border dark:border-dark-border"
            >
              {item.kind === 'image' ? (
                <Image source={{ uri: item.image.uri }} contentFit="cover" transition={150} style={{ width: '100%', height: '100%' }} />
              ) : (
                <View className="h-full w-full items-center justify-center gap-1.5 bg-black/80">
                  <Video size={26} color={colors.white} />
                  <AppText className="font-gilroy-semibold text-[11px] text-white">{t('Video')}</AppText>
                </View>
              )}
              {index === firstImageIndex ? (
                <View className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5">
                  <AppText className="font-gilroy-semibold text-[10px] text-white">{t('Cover')}</AppText>
                </View>
              ) : null}
              <View className="absolute right-2 top-2">
                <PressableScale
                  onPress={() => onRemove(index)}
                  accessibilityLabel={t('Remove')}
                  hitSlop={8}
                  className="h-7 w-7 items-center justify-center rounded-full bg-black/60"
                >
                  <X size={14} color={colors.white} />
                </PressableScale>
              </View>
              <View className="absolute inset-x-0 bottom-0 flex-row items-center justify-between bg-black/45 px-2 py-1.5">
                <PressableScale
                  onPress={() => onMove(index, -1)}
                  disabled={index === 0}
                  accessibilityLabel={t('Move left')}
                  className={cn('h-6 w-6 items-center justify-center rounded-full bg-white/20', index === 0 && 'opacity-30')}
                >
                  <ChevronLeft size={14} color={colors.white} />
                </PressableScale>
                <PressableScale
                  onPress={() => onMove(index, 1)}
                  disabled={index === media.length - 1}
                  accessibilityLabel={t('Move right')}
                  className={cn('h-6 w-6 items-center justify-center rounded-full bg-white/20', index === media.length - 1 && 'opacity-30')}
                >
                  <ChevronRight size={14} color={colors.white} />
                </PressableScale>
              </View>
            </View>
          ))}
          {imageCount < MAX_IMAGES ? (
            <PressableScale onPress={onAddImages} accessibilityLabel={t('Add cover image')}>
              <View
                className="h-40 w-32 items-center justify-center gap-1.5 rounded-[14px] border-2 border-dashed"
                style={{ borderColor: isDark ? '#5aa9e6' : '#4a90e2' }}
              >
                <Plus size={22} color={colors.muted} />
                <AppText className="font-gilroy-medium text-[12px] text-muted">{t('Add')}</AppText>
              </View>
            </PressableScale>
          ) : null}
        </ScrollView>
      )}
      {hasVideo ? null : (
        <PressableScale onPress={onAddVideo} accessibilityLabel={t('Add video')} className="flex-row items-center gap-1.5 self-start">
          <Video size={15} color={colors.links} />
          <AppText className="font-gilroy-semibold text-[13px] text-links dark:text-dark-text">{t('Add video')}</AppText>
        </PressableScale>
      )}
      {error ? <AppText className="font-gilroy-medium text-xs text-danger">{error}</AppText> : null}
    </View>
  );
}

interface CurrencyPillProps {
  currency: string;
  onSelect: (code: string) => void;
}

function CurrencyPill({ currency, onSelect }: CurrencyPillProps) {
  const { t } = useTranslation();
  const isDark = useColorScheme() === 'dark';
  const mutedIcon = isDark ? colors.dark.textSecondary : colors.muted;
  const [modalOpen, setModalOpen] = useState(false);

  const openModal = () => {
    haptics.selection();
    setModalOpen(true);
  };

  const handleSelect = (code: string) => {
    haptics.selection();
    onSelect(code);
    setModalOpen(false);
  };

  return (
    <>
      <PressableScale
        onPress={openModal}
        accessibilityLabel={t('Currency')}
        className="flex-row items-center gap-1 rounded-full bg-black/[0.05] px-2.5 py-1 dark:bg-white/10"
      >
        <AppText className="font-gilroy-semibold text-[13px] text-primary dark:text-dark-text">
          {CURRENCY_SYMBOLS[currency] ?? currency}
        </AppText>
        <ChevronDown size={14} color={mutedIcon} />
      </PressableScale>

      <Modal visible={modalOpen} transparent animationType="fade" onRequestClose={() => setModalOpen(false)}>
        <Pressable onPress={() => setModalOpen(false)} className="flex-1 justify-end bg-black/40">
          <Pressable onPress={(event) => event.stopPropagation()} className="rounded-t-[20px] bg-app-bg pb-9 pt-3 dark:bg-dark-surface">
            <View className="mb-2 flex-row items-center justify-between px-5">
              <AppText className="font-gilroy-bold text-[17px]">{t('Currency')}</AppText>
              <PressableScale
                onPress={() => setModalOpen(false)}
                accessibilityLabel={t('Cancel')}
                className="h-9 w-9 items-center justify-center rounded-full bg-black/[0.05] dark:bg-white/10"
              >
                <X size={17} color={mutedIcon} />
              </PressableScale>
            </View>
            <View className="gap-2 px-5 pt-1">
              {CURRENCIES.map((code) => {
                const active = code === currency;
                return (
                  <PressableScale
                    key={code}
                    onPress={() => handleSelect(code)}
                    accessibilityLabel={code}
                    className={cn(
                      'flex-row items-center justify-between rounded-[12px] border px-4 py-3',
                      active
                        ? 'border-primary bg-links/10 dark:border-white/40 dark:bg-white/10'
                        : 'border-app-border bg-app-surface dark:border-dark-border dark:bg-dark-surface',
                    )}
                  >
                    <View className="flex-row items-center gap-3">
                      <AppText className="w-9 font-gilroy-bold text-[16px] text-primary dark:text-dark-text">
                        {CURRENCY_SYMBOLS[code] ?? code}
                      </AppText>
                      <AppText className="font-gilroy-semibold text-[14px]">{code}</AppText>
                    </View>
                    {active ? <Check size={18} color={isDark ? colors.dark.text : colors.links} /> : null}
                  </PressableScale>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
        <ToastHost />
      </Modal>
    </>
  );
}

interface TicketCardProps {
  control: Control<FormValues>;
  setValue: UseFormSetValue<FormValues>;
  index: number;
  currency: string;
  onRemove: () => void;
  showRemove: boolean;
  locked: boolean;
  pinnableDays: string[];
}

function TicketCard({ control, setValue, index, currency, onRemove, showRemove, locked, pinnableDays }: TicketCardProps) {
  const { t, i18n } = useTranslation();
  const isDark = useColorScheme() === 'dark';
  const mutedIcon = isDark ? colors.dark.textSecondary : colors.muted;
  const isFree = Boolean(useWatch({ control, name: `tickets.${index}.isFree` }));
  const isTable = Boolean(useWatch({ control, name: `tickets.${index}.isTable` }));
  const { errors } = useFormState({ control, name: `tickets.${index}` });
  const ticketErrors = errors.tickets?.[index];
  const saleWindowError =
    ticketErrors?.saleStartDate?.message ??
    ticketErrors?.saleStartTime?.message ??
    ticketErrors?.saleEndDate?.message ??
    ticketErrors?.saleEndTime?.message;

  return (
    <View className="gap-3 rounded-2xl border border-app-border bg-app-bg p-4 dark:border-dark-border dark:bg-dark-bg">
      <View className="flex-row items-center justify-between">
        <View className="flex-1 flex-row items-center gap-2 pr-3">
          <AppText className="font-gilroy-semibold text-sm text-primary/70 dark:text-dark-text/70">{`${t('Ticket type')} ${index + 1}`}</AppText>
          {isTable ? (
            <View className="rounded-full bg-links/10 px-2 py-0.5 dark:bg-white/10">
              <AppText className="font-gilroy-semibold text-[10px] text-links dark:text-dark-text">{t('Table')}</AppText>
            </View>
          ) : null}
        </View>
        {showRemove ? (
          <PressableScale
            onPress={onRemove}
            accessibilityLabel={t('Remove')}
            className="h-8 w-8 items-center justify-center rounded-full bg-danger/10"
          >
            <Trash2 size={16} color={colors.danger} />
          </PressableScale>
        ) : null}
      </View>

      <ControlledTextInput
        control={control}
        name={`tickets.${index}.name`}
        label={t('Ticket name')}
        placeholder={t('General admission')}
        autoCapitalize="sentences"
      />

      {locked ? null : (
        <Controller
          control={control}
          name={`tickets.${index}.isFree`}
          render={({ field }) => (
            <ToggleRow
              label={t('Free ticket')}
              description={t('No charge for this ticket type.')}
              value={field.value}
              onValueChange={(next) => {
                field.onChange(next);
                if (next) setValue(`tickets.${index}.price`, '0');
              }}
              icon={<TicketIcon size={16} color={field.value ? colors.primary : colors.muted} />}
            />
          )}
        />
      )}

      <View className="flex-row gap-3">
        {!locked && isFree ? null : (
          <View className="flex-1">
            <ControlledTextInput
              control={control}
              name={`tickets.${index}.price`}
              label={t('Price')}
              placeholder="0"
              keyboardType="decimal-pad"
              editable={!locked}
              rightIcon={<CurrencyPill currency={currency} onSelect={(code) => setValue('currency', code)} />}
            />
          </View>
        )}
        <View className="flex-1">
          <ControlledTextInput
            control={control}
            name={`tickets.${index}.quantity`}
            label={t('Quantity')}
            placeholder={t('Unlimited')}
            keyboardType="number-pad"
          />
        </View>
      </View>

      {locked ? (
        <AppText className="font-gilroy-medium text-[12px] text-muted dark:text-dark-muted">
          {t('To change ticket prices, consider turning off visibility for this ticket and creating a new one instead.')}
        </AppText>
      ) : null}

      <ControlledTextInput
        control={control}
        name={`tickets.${index}.comment`}
        label={t('Description (optional)')}
        placeholder={t('What is included with this ticket')}
        autoCapitalize="sentences"
      />

      <View className="gap-1.5">
        <AppText className="font-gilroy-medium text-[13px] text-primary/70 dark:text-dark-text/70">{t('Sales window (optional)')}</AppText>
        <View className="flex-row gap-2">
          <Controller
            control={control}
            name={`tickets.${index}.saleStartDate`}
            render={({ field }) => (
              <EventFormDateTimeField
                value={field.value}
                mode="date"
                onChange={field.onChange}
                placeholder={t('Sales start')}
                icon={<CalendarDays size={15} color={mutedIcon} />}
                containerClassName="flex-1"
              />
            )}
          />
          <Controller
            control={control}
            name={`tickets.${index}.saleStartTime`}
            render={({ field }) => (
              <EventFormDateTimeField
                value={field.value}
                mode="time"
                onChange={field.onChange}
                placeholder={t('Time')}
                icon={<Clock size={15} color={mutedIcon} />}
                containerClassName="w-28"
              />
            )}
          />
        </View>
        <View className="flex-row gap-2">
          <Controller
            control={control}
            name={`tickets.${index}.saleEndDate`}
            render={({ field }) => (
              <EventFormDateTimeField
                value={field.value}
                mode="date"
                onChange={field.onChange}
                placeholder={t('Sales end')}
                icon={<CalendarDays size={15} color={mutedIcon} />}
                containerClassName="flex-1"
              />
            )}
          />
          <Controller
            control={control}
            name={`tickets.${index}.saleEndTime`}
            render={({ field }) => (
              <EventFormDateTimeField
                value={field.value}
                mode="time"
                onChange={field.onChange}
                placeholder={t('Time')}
                icon={<Clock size={15} color={mutedIcon} />}
                containerClassName="w-28"
              />
            )}
          />
        </View>
        {saleWindowError ? (
          <AppText className="font-gilroy-medium text-xs text-danger">{t(saleWindowError)}</AppText>
        ) : null}
      </View>

      <View className="gap-2.5 border-t border-app-border pt-3 dark:border-dark-border">
        <AppText className="font-gilroy-semibold text-[11px] uppercase tracking-wide text-muted dark:text-dark-muted">
          {t('Advanced')}
        </AppText>
        {locked ? null : (
          <Controller
            control={control}
            name={`tickets.${index}.isActive`}
            render={({ field }) => (
              <ToggleRow
                label={t('Ticket visible')}
                description={t('Turn off to hide this ticket from buyers.')}
                value={field.value}
                onValueChange={field.onChange}
                icon={<Eye size={16} color={field.value ? colors.primary : colors.muted} />}
              />
            )}
          />
        )}
        <Controller
          control={control}
          name={`tickets.${index}.isTable`}
          render={({ field }) => (
            <ToggleRow
              label={t('Table ticket')}
              value={field.value}
              onValueChange={field.onChange}
              icon={<Users size={16} color={field.value ? colors.primary : colors.muted} />}
            />
          )}
        />
        <Controller
          control={control}
          name={`tickets.${index}.showRemainingTickets`}
          render={({ field }) => (
            <ToggleRow
              label={t('Show remaining tickets')}
              description={t('Buyers see how many are left.')}
              value={field.value}
              onValueChange={field.onChange}
            />
          )}
        />
        <Controller
          control={control}
          name={`tickets.${index}.qrCodeQuantity`}
          render={({ field }) => (
            <View className="flex-row items-center justify-between rounded-[12px] border border-app-border bg-app-surface px-4 py-3 dark:border-dark-border dark:bg-dark-surface">
              <View className="flex-1 pr-3">
                <AppText className="font-gilroy-semibold text-[14px]">{t('QR codes per ticket')}</AppText>
                {field.value > 1 ? (
                  <AppText className="mt-0.5 font-gilroy-medium text-[12px] text-muted dark:text-dark-muted">
                    {t('Buy 1 ticket, get {{qrCount}} QR codes', { qrCount: field.value })}
                  </AppText>
                ) : null}
              </View>
              <Stepper value={field.value} onChange={field.onChange} min={1} max={100} />
            </View>
          )}
        />
        {pinnableDays.length > 0 ? (
          <Controller
            control={control}
            name={`tickets.${index}.eventDay`}
            render={({ field }) => (
              <View className="gap-2 rounded-[12px] border border-app-border bg-app-surface px-4 py-3 dark:border-dark-border dark:bg-dark-surface">
                <AppText className="font-gilroy-semibold text-[14px]">{t('Event day')}</AppText>
                <AppText className="font-gilroy-medium text-[12px] text-muted dark:text-dark-muted">
                  {t('Optional. Pick the day this ticket is for and the ticket and email will show that day instead of the first day of the event.')}
                </AppText>
                <View className="flex-row flex-wrap gap-2">
                  {['', ...pinnableDays].map((day, dayIndex) => {
                    const active = (pinnedEventDay(field.value, pinnableDays) ?? '') === day;
                    const label = day ? `${t('Day {{number}}', { number: dayIndex })} · ${formatEventDay(day, i18n.language)}` : t('All days');
                    return (
                      <PressableScale
                        key={day || 'all'}
                        onPress={() => field.onChange(day)}
                        accessibilityLabel={label}
                        className={cn(
                          'h-9 justify-center rounded-full border px-3',
                          active ? 'border-primary bg-primary dark:border-white dark:bg-white' : 'border-app-border bg-white dark:border-dark-border dark:bg-dark-surface',
                        )}
                      >
                        <AppText className={cn('font-gilroy-medium text-[12px]', active ? 'text-white dark:text-primary' : '')}>{label}</AppText>
                      </PressableScale>
                    );
                  })}
                </View>
              </View>
            )}
          />
        ) : null}
      </View>
    </View>
  );
}

function CategorySkeleton() {
  return (
    <View className="flex-row flex-wrap gap-2">
      <Skeleton className="h-9 w-24 rounded-full" />
      <Skeleton className="h-9 w-20 rounded-full" />
      <Skeleton className="h-9 w-28 rounded-full" />
      <Skeleton className="h-9 w-16 rounded-full" />
    </View>
  );
}

interface CategorySelectProps {
  value: number | null;
  onChange: (id: number) => void;
  categories: Category[];
  loading: boolean;
}

function CategorySelect({ value, onChange, categories, loading }: CategorySelectProps) {
  const { t } = useTranslation();
  const isDark = useColorScheme() === 'dark';
  const mutedIcon = isDark ? colors.dark.textSecondary : colors.muted;
  const activeIcon = isDark ? colors.dark.text : colors.links;
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selected = categories.find((category) => category.id === value) ?? null;
  const normalizedSearch = search.trim().toLowerCase();
  const filtered = normalizedSearch
    ? categories.filter((category) => category.name.toLowerCase().includes(normalizedSearch))
    : categories;

  const openModal = () => {
    haptics.selection();
    setSearch('');
    setModalOpen(true);
  };

  const handleSelect = (id: number) => {
    haptics.selection();
    onChange(id);
    setModalOpen(false);
  };

  if (loading) {
    return <CategorySkeleton />;
  }

  return (
    <>
      <PressableScale
        onPress={openModal}
        accessibilityLabel={t('Select a category')}
        className="flex-row items-center justify-between rounded-[12px] border border-app-border bg-app-surface px-4 py-3 dark:border-dark-border dark:bg-dark-surface"
      >
        <AppText
          numberOfLines={1}
          className={cn(
            'flex-1 pr-2 font-gilroy-semibold text-[14px]',
            selected ? 'text-primary dark:text-dark-text' : 'text-muted dark:text-dark-muted',
          )}
        >
          {selected ? selected.name : t('Select a category')}
        </AppText>
        <ChevronDown size={18} color={mutedIcon} />
      </PressableScale>

      <Modal visible={modalOpen} transparent animationType="fade" onRequestClose={() => setModalOpen(false)}>
        <Pressable onPress={() => setModalOpen(false)} className="flex-1 justify-end bg-black/40">
          <Pressable onPress={(event) => event.stopPropagation()} className="h-[80%] rounded-t-[20px] bg-app-bg pt-3 dark:bg-dark-surface">
            <View className="mb-2 flex-row items-center justify-between px-5">
              <AppText className="font-gilroy-bold text-[17px]">{t('Category')}</AppText>
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
                placeholder={t('Search')}
                value={search}
                onChangeText={setSearch}
                autoCapitalize="none"
                leftIcon={<Search size={16} color={mutedIcon} />}
              />
            </View>
            <FlatList
              data={filtered}
              keyExtractor={(item) => String(item.id)}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 8 }}
              ListEmptyComponent={<EmptyState icon={Tag} title={t('No results found')} />}
              renderItem={({ item }) => {
                const active = item.id === value;
                return (
                  <PressableScale
                    onPress={() => handleSelect(item.id)}
                    accessibilityLabel={item.name}
                    className={cn(
                      'flex-row items-center justify-between rounded-[12px] border px-4 py-3',
                      active
                        ? 'border-primary bg-links/10 dark:border-white/40 dark:bg-white/10'
                        : 'border-app-border bg-app-surface dark:border-dark-border dark:bg-dark-surface',
                    )}
                  >
                    <AppText
                      numberOfLines={1}
                      className={cn(
                        'flex-1 pr-2 font-gilroy-semibold text-[14px]',
                        active ? 'text-links dark:text-dark-text' : 'text-primary dark:text-dark-text',
                      )}
                    >
                      {item.name}
                    </AppText>
                    {active ? <Check size={18} color={activeIcon} /> : null}
                  </PressableScale>
                );
              }}
            />
          </Pressable>
        </Pressable>
        <ToastHost />
      </Modal>
    </>
  );
}

interface CouponsBuilderProps {
  coupons: EventCouponInput[];
  onChange: (coupons: EventCouponInput[]) => void;
}

function clampCouponPercent(raw: string): number {
  const digits = raw.replace(/[^0-9]/g, '');
  if (digits.length === 0) return 0;
  return Math.min(100, Math.max(0, Number(digits)));
}

function parseCouponMaxUses(raw: string): number {
  const digits = raw.replace(/[^0-9]/g, '');
  return digits.length === 0 ? 0 : Number(digits);
}

function CouponsBuilder({ coupons, onChange }: CouponsBuilderProps) {
  const { t } = useTranslation();

  const addCoupon = () => {
    haptics.selection();
    onChange([...coupons, { id: null, code: '', discount: 0, max_uses: 0, is_active: true }]);
  };

  const removeCoupon = (index: number) => {
    haptics.selection();
    onChange(coupons.filter((_, i) => i !== index));
  };

  const updateCoupon = (index: number, patch: Partial<EventCouponInput>) => {
    onChange(coupons.map((coupon, i) => (i === index ? { ...coupon, ...patch } : coupon)));
  };

  return (
    <View className="gap-3">
      {coupons.map((coupon, index) => {
        const isExisting = coupon.id != null;
        return (
          <View
            key={isExisting ? `coupon-${coupon.id}` : `coupon-new-${index}`}
            className="gap-3 rounded-2xl border border-app-border bg-app-bg p-4 dark:border-dark-border dark:bg-dark-bg"
          >
            <View className="flex-row items-start justify-between gap-3">
              <View className="flex-1">
                <GlassInput
                  label={t('Coupon code')}
                  placeholder={t('e.g. SUMMER20')}
                  value={coupon.code}
                  onChangeText={(value) => updateCoupon(index, { code: value.toUpperCase() })}
                  autoCapitalize="characters"
                />
              </View>
              <PressableScale
                onPress={() => removeCoupon(index)}
                accessibilityLabel={t('Remove coupon')}
                className="h-8 w-8 items-center justify-center rounded-full bg-danger/10"
              >
                <Trash2 size={16} color={colors.danger} />
              </PressableScale>
            </View>
            <View className="flex-row gap-2">
              <View className="flex-1">
                <GlassInput
                  label={t('Discount %')}
                  placeholder="0"
                  value={coupon.discount > 0 ? String(coupon.discount) : ''}
                  onChangeText={(value) => updateCoupon(index, { discount: clampCouponPercent(value) })}
                  keyboardType="number-pad"
                />
              </View>
              <View className="flex-1">
                <GlassInput
                  label={t('Max uses')}
                  placeholder={t('Unlimited')}
                  value={coupon.max_uses > 0 ? String(coupon.max_uses) : ''}
                  onChangeText={(value) => updateCoupon(index, { max_uses: parseCouponMaxUses(value) })}
                  keyboardType="number-pad"
                />
              </View>
            </View>
            {isExisting ? (
              <ToggleRow
                label={t('Coupon active')}
                description={t('Turn off to disable this code without deleting it.')}
                value={coupon.is_active}
                onValueChange={(next) => updateCoupon(index, { is_active: next })}
                icon={<Tag size={16} color={coupon.is_active ? colors.primary : colors.muted} />}
              />
            ) : null}
          </View>
        );
      })}
      <DashedAddButton label={t('Add coupon')} onPress={addCoupon} />
    </View>
  );
}

export function EventForm({ mode, initialValues, submitting, onSubmit, submitLabel, headerNotice, contextSection, isOrganization, couponsEditable = true }: EventFormProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [submitBarHeight, setSubmitBarHeight] = useState(0);
  const isDark = useColorScheme() === 'dark';
  const toast = useToast();
  const currentUserId = useAppSelector((state) => state.auth.user?.id);

  const { data: categories, isLoading: categoriesLoading } = useGetCategoriesQuery();

  const defaultValues = useMemo(() => toFormValues(initialValues), [initialValues]);

  const isPaidEvent = useMemo(
    () => (initialValues?.tickets ?? []).some((ticket) => ticket.price > 0),
    [initialValues],
  );

  const originalTicketPriceById = useMemo(() => {
    const map = new Map<number, number>();
    (initialValues?.tickets ?? []).forEach((ticket) => {
      if (ticket.id != null) map.set(ticket.id, ticket.price);
    });
    return map;
  }, [initialValues]);

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: 'onTouched',
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'tickets' });
  const isOnline = watch('isOnline');
  const locationTba = watch('locationTba');
  const timeTba = watch('timeTba');
  const pinnableDays = eventDaysBetween(watch('startDate'), watch('endDate'));
  const country = watch('country');
  const region = watch('region');

  const [media, setMedia] = useState<EventFormMediaItem[]>(initialValues?.media ?? []);
  const [imagesError, setImagesError] = useState<string | undefined>(undefined);
  const [questions, setQuestions] = useState<EventFormQuestion[]>(initialValues?.questions ?? []);
  const [timelines, setTimelines] = useState<EventFormTimelineItem[]>(initialValues?.timelines ?? []);
  const [organizers, setOrganizers] = useState<SelectedOrganizer[]>(initialValues?.organizers ?? []);
  const [coordinates, setCoordinates] = useState<{ lat: number; long: number } | null>(initialValues?.coordinates ?? null);
  const [saveAsDraft, setSaveAsDraft] = useState<boolean>(initialValues?.inDraft ?? false);
  const [coupons, setCoupons] = useState<EventCouponInput[]>(initialValues?.coupons ?? []);

  const mutedIcon = isDark ? colors.dark.textSecondary : colors.muted;
  const payIconColor = isDark ? colors.primary : colors.white;
  const headerPad = insets.top + 72;

  const compressPickedImage = async (asset: ImagePicker.ImagePickerAsset): Promise<EventFormImage> => {
    const baseName = asset.fileName ?? fileNameFromUri(asset.uri, `image-${Date.now()}.jpg`);
    try {
      const context = ImageManipulator.manipulate(asset.uri);
      const width = asset.width ?? 0;
      const height = asset.height ?? 0;
      if (Math.max(width, height) > MAX_IMAGE_DIMENSION) {
        if (width >= height) context.resize({ width: MAX_IMAGE_DIMENSION });
        else context.resize({ height: MAX_IMAGE_DIMENSION });
      }
      const rendered = await context.renderAsync();
      const saved = await rendered.saveAsync({ compress: IMAGE_COMPRESSION_QUALITY, format: SaveFormat.JPEG });
      return { id: null, uri: saved.uri, name: withJpgExtension(baseName), type: 'image/jpeg' };
    } catch {
      return { id: null, uri: asset.uri, name: baseName, type: asset.mimeType ?? 'image/jpeg' };
    }
  };

  const pickImages = async () => {
    haptics.selection();
    const remaining = MAX_IMAGES - media.filter((item) => item.kind === 'image').length;
    if (remaining <= 0) {
      toast(t('You can add up to 6 images'), 'info');
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      toast(t('We need photo access to add a cover image'), 'error');
      return;
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: remaining,
        quality: 1,
      });
      if (result.canceled) return;
      const compressed = await Promise.all(result.assets.slice(0, remaining).map((asset) => compressPickedImage(asset)));
      setMedia((prev) => [...prev, ...compressed.map<EventFormMediaItem>((image) => ({ kind: 'image', image }))]);
      setImagesError(undefined);
    } catch {
      haptics.error();
      toast(t('We could not load that image. Please try another one.'), 'error');
    }
  };

  const pickVideo = async () => {
    haptics.selection();
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      toast(t('We need photo access to add a cover image'), 'error');
      return;
    }
    let result: ImagePicker.ImagePickerResult;
    try {
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        allowsMultipleSelection: false,
      });
    } catch {
      haptics.error();
      toast(t('We could not load that video. Please try another one.'), 'error');
      return;
    }
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset) return;
    const name = asset.fileName ?? fileNameFromUri(asset.uri, `video-${Date.now()}.mp4`);
    const type = asset.mimeType ?? videoMimeFromName(name);
    if (!VIDEO_ALLOWED_TYPES.includes(type)) {
      toast(t('Video must be MP4, WebM, or MOV.'), 'error');
      return;
    }
    if (asset.fileSize != null && asset.fileSize > VIDEO_MAX_BYTES) {
      toast(t('Video must be 100 MB or smaller.'), 'error');
      return;
    }
    setMedia((prev) => [
      ...prev.filter((item) => item.kind !== 'video'),
      { kind: 'video', video: { uri: asset.uri, name, type, existing: false } },
    ]);
  };

  const removeMedia = (index: number) => {
    haptics.selection();
    setMedia((prev) => prev.filter((_, i) => i !== index));
  };

  const moveMedia = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    setMedia((prev) => {
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const moved = next[index];
      next[index] = next[target];
      next[target] = moved;
      return next;
    });
    haptics.selection();
  };

  const resolveTicketPrice = (ticket: FormValues['tickets'][number]): number => {
    if (mode === 'edit' && ticket.ticketId != null) {
      const originalPrice = originalTicketPriceById.get(ticket.ticketId);
      if (originalPrice != null) return originalPrice;
    }
    return ticket.isFree ? 0 : Number(ticket.price || '0');
  };

  const buildPayload = (values: FormValues): EventFormSubmit => ({
    title: values.title.trim(),
    description: values.description.trim(),
    category: values.category,
    type: values.type,
    currency: values.currency,
    start_date: values.startDate,
    start_time: values.startTime || (values.timeTba ? '00:00' : ''),
    end_date: values.endDate,
    end_time: values.endTime,
    time_is_tba: values.timeTba,
    event_location_type: values.isOnline ? 'virtual' : 'physical',
    location_is_tba: values.isOnline ? false : values.locationTba,
    country: values.country.trim(),
    region: values.region.trim(),
    address: values.isOnline ? values.address.trim() : values.locationTba ? '' : values.address.trim(),
    coordinates: values.isOnline ? null : coordinates,
    inDraft: mode === 'edit' ? saveAsDraft : false,
    media,
    coupons,
    questions: questions.map((question, index) => {
      const supportsOptions = QUESTION_OPTION_TYPES.includes(question.type);
      return {
        id: question.id,
        question: question.question.trim(),
        description: question.description.trim(),
        type: question.type,
        options: supportsOptions ? question.options : [],
        conditions: supportsOptions ? question.conditions : [],
        required: question.required,
        order: index,
      };
    }),
    timelines: timelines
      .map((item) => ({
        id: item.id,
        title: item.title.trim(),
        description: item.description.trim(),
        start_time: item.start_time,
        end_time: item.end_time,
      }))
      .filter((item) => item.title.length > 0 || item.description.length > 0 || item.start_time.length > 0 || item.end_time.length > 0),
    organizers: organizers.map((organizer) => ({ id: organizer.id, invite_accepted: 'pending' })),
    tickets: values.tickets.map((ticket) => ({
      id: ticket.ticketId,
      name: ticket.name.trim(),
      price: resolveTicketPrice(ticket),
      quantity: ticket.quantity.trim().length > 0 ? Number(ticket.quantity) : null,
      comment: ticket.comment.trim(),
      sale_start_date: toAbsoluteIso(ticket.saleStartDate, ticket.saleStartTime, '00:00'),
      sale_end_date: toAbsoluteIso(ticket.saleEndDate, ticket.saleEndTime, '23:59'),
      is_active: ticket.isActive,
      qr_code_quantity: ticket.qrCodeQuantity,
      show_remaining_tickets: ticket.showRemainingTickets,
      is_table: ticket.isTable,
      event_day: pinnedEventDay(ticket.eventDay, eventDaysBetween(values.startDate, values.endDate)),
    })),
  });

  const imageCount = media.filter((item) => item.kind === 'image').length;

  const submit = handleSubmit(
    (values) => {
      if (imageCount === 0) {
        setImagesError(t('At least one image is required'));
        haptics.error();
        toast(t('At least one image is required'), 'error');
        return;
      }
      onSubmit(buildPayload(values));
    },
    (formErrors) => {
      haptics.error();
      if (imageCount === 0) setImagesError(t('At least one image is required'));
      const message =
        firstEventFormError(formErrors, t) ??
        (imageCount === 0 ? t('At least one image is required') : t('Please complete the highlighted fields'));
      toast(message, 'error');
    },
  );

  const ticketsError = errors.tickets?.message;

  return (
    <View className="flex-1">
      <KeyboardAwareScrollView
        bottomOffset={submitBarHeight + 16}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: headerPad, paddingBottom: insets.bottom + 160, paddingHorizontal: 20 }}
      >
        {headerNotice}

        <SectionTitle required>{t('Event media')}</SectionTitle>
        <AppText className="-mt-2 mb-3 font-gilroy-medium text-[13px] text-muted dark:text-dark-muted">
          {t('Add up to 6 images and 1 video')}
        </AppText>
        <MediaStrip
          media={media}
          error={imagesError}
          onAddImages={pickImages}
          onAddVideo={pickVideo}
          onRemove={removeMedia}
          onMove={moveMedia}
        />

        <View className="mt-6">
          <Controller
            control={control}
            name="title"
            render={({ field, fieldState }) => (
              <View>
                <TextInput
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  placeholder={t('Event Name')}
                  placeholderTextColor={isDark ? 'rgba(249,249,249,0.4)' : 'rgba(43,58,68,0.42)'}
                  multiline
                  className="font-gilroy-bold text-[28px] leading-[34px] text-primary dark:text-dark-text"
                />
                {fieldState.error ? (
                  <AppText className="mt-1 font-gilroy-medium text-xs text-danger">
                    {fieldState.error.message ? t(fieldState.error.message) : null}
                  </AppText>
                ) : null}
              </View>
            )}
          />
        </View>

        <View className="mt-5">
          <ControlledTextInput
            control={control}
            name="description"
            label={t('Description')}
            placeholder={t('Add Description')}
            multiline
            autoCapitalize="sentences"
            containerClassName="h-32"
          />
        </View>

        {contextSection}

        <FormSection icon={Tag} title={t('Category')}>
          <Controller
            control={control}
            name="category"
            render={({ field, fieldState }) => (
              <>
                <CategorySelect
                  value={typeof field.value === 'number' ? field.value : null}
                  onChange={field.onChange}
                  categories={categories ?? []}
                  loading={categoriesLoading}
                />
                {fieldState.error ? (
                  <AppText className="mt-2 font-gilroy-medium text-xs text-danger">
                    {fieldState.error.message ? t(fieldState.error.message) : null}
                  </AppText>
                ) : null}
              </>
            )}
          />
        </FormSection>

        <FormSection icon={Eye} title={t('Event type')}>
          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <View className="gap-2">
                <SegmentedControl
                  options={[
                    { value: 'PUBLIC', label: t('Public') },
                    { value: 'PERSONAL', label: t('Personal') },
                    { value: 'PRIVATE', label: t('Private') },
                  ]}
                  value={field.value}
                  onChange={(value) => field.onChange(value)}
                />
                <AppText className="font-gilroy-medium text-[12px] text-muted dark:text-dark-muted">
                  {field.value === 'PRIVATE'
                    ? t('Unlisted. Only people with the link can register.')
                    : t('Public events are discoverable by everyone. Personal events are shared privately.')}
                </AppText>
              </View>
            )}
          />
        </FormSection>

        <FormSection icon={CalendarDays} title={t('Date and time')}>
          <View className="flex-row gap-3">
            <View className="items-center pt-3">
              <View className="h-3 w-3 rounded-full bg-primary dark:bg-white" />
              <View className="my-1 h-12 border-l border-dashed border-muted/60" />
              <View className="h-3 w-3 rounded-full border-2 border-muted" />
            </View>
            <View className="flex-1 gap-4">
              <View className="gap-1.5">
                <AppText className="font-gilroy-semibold text-[13px] text-muted dark:text-dark-muted">{t('Start')}</AppText>
                <View className="flex-row gap-2">
                  <Controller
                    control={control}
                    name="startDate"
                    render={({ field }) => (
                      <EventFormDateTimeField value={field.value} mode="date" onChange={field.onChange} placeholder={t('Date')} icon={<CalendarDays size={15} color={mutedIcon} />} containerClassName="flex-1" />
                    )}
                  />
                  {timeTba ? null : (
                    <Controller
                      control={control}
                      name="startTime"
                      render={({ field }) => (
                        <EventFormDateTimeField value={field.value} mode="time" onChange={field.onChange} placeholder={t('Time')} icon={<Clock size={15} color={mutedIcon} />} containerClassName="w-28" />
                      )}
                    />
                  )}
                </View>
              </View>
              <View className="gap-1.5">
                <AppText className="font-gilroy-semibold text-[13px] text-muted dark:text-dark-muted">{t('End')}</AppText>
                <View className="flex-row gap-2">
                  <Controller
                    control={control}
                    name="endDate"
                    render={({ field }) => (
                      <EventFormDateTimeField value={field.value} mode="date" onChange={field.onChange} placeholder={t('Date')} icon={<CalendarDays size={15} color={mutedIcon} />} containerClassName="flex-1" />
                    )}
                  />
                  {timeTba ? null : (
                    <Controller
                      control={control}
                      name="endTime"
                      render={({ field }) => (
                        <EventFormDateTimeField value={field.value} mode="time" onChange={field.onChange} placeholder={t('Time')} icon={<Clock size={15} color={mutedIcon} />} containerClassName="w-28" />
                      )}
                    />
                  )}
                </View>
              </View>
            </View>
          </View>
          <View className="mt-4">
            <Controller
              control={control}
              name="timeTba"
              render={({ field }) => (
                <ToggleRow
                  label={t('Time is TBA')}
                  description={t('Hide the hour on the event page, tickets and emails')}
                  value={field.value}
                  onValueChange={field.onChange}
                  icon={<Clock size={16} color={field.value ? colors.primary : colors.muted} />}
                />
              )}
            />
          </View>
          {errors.startDate || errors.startTime || errors.endDate || errors.endTime ? (
            <AppText className="mt-1.5 font-gilroy-medium text-xs text-danger">
              {t(
                errors.startDate?.message ??
                  errors.startTime?.message ??
                  errors.endDate?.message ??
                  errors.endTime?.message ??
                  '',
              )}
            </AppText>
          ) : null}
        </FormSection>

        <FormSection icon={MapPin} title={t('Event Location')}>
          <Controller
            control={control}
            name="isOnline"
            render={({ field }) => <LocationTypeToggle value={field.value === true} onChange={field.onChange} />}
          />

          {isOnline ? (
            <View className="mt-4">
              <ControlledTextInput
                control={control}
                name="address"
                label={t('Meeting link')}
                placeholder="https://"
                autoCapitalize="none"
                keyboardType="url"
                leftIcon={<Link2 size={16} color={mutedIcon} />}
              />
            </View>
          ) : (
            <View className="mt-4 gap-4">
              <Controller
                control={control}
                name="locationTba"
                render={({ field }) => (
                  <ToggleRow
                    label={t('Location to be announced')}
                    description={t('Hide the exact address; show only the city.')}
                    value={field.value}
                    onValueChange={field.onChange}
                    icon={<Clock size={16} color={field.value ? colors.primary : colors.muted} />}
                  />
                )}
              />
              <Controller
                control={control}
                name="address"
                render={({ field, fieldState }) => (
                  <LocationAutocompleteField
                    value={typeof field.value === 'string' ? field.value : ''}
                    onChangeText={field.onChange}
                    label={locationTba ? t('City') : t('Address')}
                    placeholder={locationTba ? t('Search for a city (e.g. Bucharest)') : t('Search for a location')}
                    error={
                      fieldState.error?.message
                        ? t(fieldState.error.message)
                        : errors.country?.message
                          ? t(errors.country.message)
                          : undefined
                    }
                    onSelectPlace={(details) => {
                      field.onChange(details.address);
                      setValue('country', details.country ?? '', { shouldValidate: true });
                      setValue('region', details.city ?? '', { shouldValidate: true });
                      if (details.latitude != null && details.longitude != null) {
                        setCoordinates({ lat: details.latitude, long: details.longitude });
                      }
                    }}
                  />
                )}
              />
              {region || country ? (
                <View className="flex-row items-center gap-2 self-start rounded-[10px] bg-links/10 px-3 py-2 dark:bg-white/[0.08]">
                  <MapPin size={14} color={mutedIcon} />
                  <AppText className="font-gilroy-semibold text-[13px] text-primary/80 dark:text-dark-text/80">
                    {[region, country].filter(Boolean).join(', ')}
                  </AppText>
                </View>
              ) : null}
            </View>
          )}
        </FormSection>

        <FormSection icon={TicketIcon} title={t('Tickets')} required>
          <Controller
            control={control}
            name="currency"
            render={({ field: currencyField }) => (
              <View className="gap-3">
                {fields.map((ticketField, index) => {
                  const isExistingTicket = mode === 'edit' && ticketField.ticketId != null;
                  return (
                    <TicketCard
                      key={ticketField.id}
                      control={control}
                      setValue={setValue}
                      index={index}
                      currency={currencyField.value}
                      onRemove={() => remove(index)}
                      showRemove={fields.length > 1 && !(isExistingTicket && isPaidEvent)}
                      locked={isExistingTicket}
                      pinnableDays={pinnableDays}
                    />
                  );
                })}
              </View>
            )}
          />
          {ticketsError ? <AppText className="mt-3 font-gilroy-medium text-xs text-danger">{t(ticketsError)}</AppText> : null}
          <PressableScale
            onPress={() => append(DEFAULT_TICKET)}
            accessibilityLabel={t('Add more tickets')}
            className="mt-3 flex-row items-center gap-1.5 self-start"
          >
            <Plus size={16} color={colors.links} />
            <AppText className="font-gilroy-semibold text-[14px] text-links dark:text-dark-text">{t('Add more tickets')}</AppText>
          </PressableScale>
        </FormSection>

        <FormSection
          icon={MessageCircleQuestion}
          title={t('Additional Questions')}
          subtitle={t('Create and customize your registration questions. Use arrows to reorder.')}
        >
          <QuestionsBuilder questions={questions} onChange={setQuestions} />
        </FormSection>

        <FormSection icon={Clock} title={t('Event Timeline')}>
          <TimelineEditor items={timelines} onChange={setTimelines} />
        </FormSection>

        <FormSection
          icon={Users}
          title={t('Event Organizers')}
          subtitle={t('Add organizers who will help you manage this event, excluding yourself')}
        >
          <OrganizerPicker selected={organizers} onChange={setOrganizers} excludeUserId={currentUserId} />
        </FormSection>

        {couponsEditable ? (
          <FormSection icon={Tag} title={t('Coupons')} subtitle={t('Offer discount codes buyers can apply at checkout.')}>
            <CouponsBuilder coupons={coupons} onChange={setCoupons} />
          </FormSection>
        ) : null}

        {mode === 'edit' && (
          <FormSection icon={FileText} title={t('Visibility')}>
            <ToggleRow
              label={t('Save as draft')}
              description={t('Draft events are hidden until you publish them.')}
              value={saveAsDraft}
              onValueChange={setSaveAsDraft}
              disabled={isOrganization === false}
              icon={<FileText size={16} color={saveAsDraft ? colors.primary : colors.muted} />}
            />
            {isOrganization === false ? (
              <AppText className="mt-2 font-gilroy-medium text-[12px] text-muted dark:text-dark-muted">
                {t('Only organization accounts can publish events. Your event will be saved as a draft.')}
              </AppText>
            ) : null}
          </FormSection>
        )}
      </KeyboardAwareScrollView>

      <View
        className="absolute bottom-0 left-0 right-0"
        onLayout={(event) => setSubmitBarHeight(event.nativeEvent.layout.height)}
      >
        <KeyboardStickyView offset={{ opened: insets.bottom }}>
          <GlassSurface elevation="high" className="rounded-b-none border-b-0 px-5 pt-4" style={{ paddingBottom: insets.bottom + 12 }}>
            <GlassButton
              label={submitLabel ?? (mode === 'create' ? t('Create Event') : t('Save changes'))}
              variant="primary"
              onPress={submit}
              loading={submitting}
              icon={<TicketIcon size={18} color={payIconColor} />}
              className="rounded-[12px]"
            />
          </GlassSurface>
        </KeyboardStickyView>
      </View>
    </View>
  );
}
