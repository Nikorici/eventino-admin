import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MapPin } from 'lucide-react-native';

import { cn } from '@/lib/cn';
import { colors } from '@/theme/colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useDebounce } from '@/hooks/useDebounce';
import {
  createPlacesSessionToken,
  fetchPlaceDetails,
  fetchPlacePredictions,
  type PlaceDetails,
  type PlacePrediction,
} from '@/lib/places';
import { AppText, GlassInput, PressableScale } from '@/components/ui';

export interface LocationAutocompleteFieldProps {
  value: string;
  onChangeText: (text: string) => void;
  onSelectPlace: (details: PlaceDetails) => void;
  label?: string;
  placeholder?: string;
  error?: string;
}

export function LocationAutocompleteField({
  value,
  onChangeText,
  onSelectPlace,
  label,
  placeholder,
  error,
}: LocationAutocompleteFieldProps) {
  const { t } = useTranslation();
  const isDark = useColorScheme() === 'dark';
  const mutedIcon = isDark ? colors.dark.textSecondary : colors.muted;

  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const sessionTokenRef = useRef(createPlacesSessionToken());
  const suppressRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const debounced = useDebounce(value, 350);

  useEffect(() => {
    if (suppressRef.current) {
      suppressRef.current = false;
      return;
    }
    const trimmed = debounced.trim();
    if (trimmed.length < 3) {
      setPredictions([]);
      setLoading(false);
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    void fetchPlacePredictions(trimmed, sessionTokenRef.current, controller.signal).then((results) => {
      if (controller.signal.aborted) return;
      setPredictions(results);
      setLoading(false);
    });
    return () => controller.abort();
  }, [debounced]);

  const handleSelect = async (prediction: PlacePrediction) => {
    suppressRef.current = true;
    setPredictions([]);
    setOpen(false);
    onChangeText(prediction.description);
    const details = await fetchPlaceDetails(prediction.placeId, sessionTokenRef.current);
    sessionTokenRef.current = createPlacesSessionToken();
    if (details) onSelectPlace(details);
  };

  const showList = open && (loading || predictions.length > 0);

  return (
    <View className="relative z-10">
      <GlassInput
        label={label}
        placeholder={placeholder ?? t('Search for a place or address')}
        value={value}
        onChangeText={(text) => {
          setOpen(true);
          onChangeText(text);
        }}
        onFocus={() => setOpen(true)}
        autoCapitalize="none"
        error={error}
        leftIcon={<MapPin size={16} color={mutedIcon} />}
        rightIcon={loading ? <ActivityIndicator size="small" color={mutedIcon} /> : undefined}
      />
      {showList ? (
        <View className="mt-2 overflow-hidden rounded-[12px] border border-app-border bg-app-surface dark:border-dark-border dark:bg-dark-surface">
          {predictions.map((prediction, index) => (
            <PressableScale
              key={prediction.placeId}
              onPress={() => void handleSelect(prediction)}
              accessibilityLabel={prediction.description}
              className={cn(
                'flex-row items-center gap-2.5 px-3.5 py-3',
                index > 0 && 'border-t border-app-border dark:border-dark-border',
              )}
            >
              <MapPin size={15} color={mutedIcon} />
              <View className="flex-1">
                <AppText numberOfLines={1} className="font-gilroy-semibold text-[13px]">
                  {prediction.primaryText}
                </AppText>
                {prediction.secondaryText ? (
                  <AppText numberOfLines={1} className="font-gilroy-medium text-[11px] text-muted dark:text-dark-muted">
                    {prediction.secondaryText}
                  </AppText>
                ) : null}
              </View>
            </PressableScale>
          ))}
          {loading && predictions.length === 0 ? (
            <View className="flex-row items-center gap-2 px-3.5 py-3">
              <ActivityIndicator size="small" color={mutedIcon} />
              <AppText className="font-gilroy-medium text-[13px] text-muted dark:text-dark-muted">
                {t('Searching…')}
              </AppText>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
