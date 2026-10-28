import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Clock, Trash2 } from 'lucide-react-native';

import { haptics } from '@/lib/haptics';
import { colors } from '@/theme/colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { DashedAddButton, GlassInput, PressableScale } from '@/components/ui';

import { EventFormDateTimeField } from './EventFormDateTimeField';

export interface EventFormTimelineItem {
  id: string;
  title: string;
  description: string;
  start_time: string;
  end_time: string;
}

export function createTimelineItemId(): string {
  return `tl_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export interface TimelineEditorProps {
  items: EventFormTimelineItem[];
  onChange: (items: EventFormTimelineItem[]) => void;
}

export function TimelineEditor({ items, onChange }: TimelineEditorProps) {
  const { t } = useTranslation();
  const isDark = useColorScheme() === 'dark';
  const mutedIcon = isDark ? colors.dark.textSecondary : colors.muted;

  const addItem = () => {
    haptics.selection();
    onChange([...items, { id: createTimelineItemId(), title: '', description: '', start_time: '', end_time: '' }]);
  };

  const removeItem = (id: string) => {
    haptics.selection();
    onChange(items.filter((item) => item.id !== id));
  };

  const updateItem = (id: string, patch: Partial<EventFormTimelineItem>) => {
    onChange(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  return (
    <View className="gap-3">
      {items.map((item) => (
        <View
          key={item.id}
          className="gap-3 rounded-2xl border border-app-border bg-app-bg p-4 dark:border-dark-border dark:bg-dark-bg"
        >
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1">
              <GlassInput
                label={t('Timeline item title')}
                placeholder={t('Timeline item title')}
                value={item.title}
                onChangeText={(value) => updateItem(item.id, { title: value })}
                autoCapitalize="sentences"
              />
            </View>
            <PressableScale
              onPress={() => removeItem(item.id)}
              accessibilityLabel={t('Remove event milestone')}
              className="h-8 w-8 items-center justify-center rounded-full bg-danger/10"
            >
              <Trash2 size={16} color={colors.danger} />
            </PressableScale>
          </View>
          <GlassInput
            label={t('Timeline item description')}
            placeholder={t('Description')}
            value={item.description}
            onChangeText={(value) => updateItem(item.id, { description: value })}
            autoCapitalize="sentences"
          />
          <View className="flex-row gap-2">
            <EventFormDateTimeField
              value={item.start_time}
              mode="time"
              onChange={(value) => updateItem(item.id, { start_time: value })}
              placeholder={t('Start at')}
              icon={<Clock size={15} color={mutedIcon} />}
              containerClassName="flex-1"
            />
            <EventFormDateTimeField
              value={item.end_time}
              mode="time"
              onChange={(value) => updateItem(item.id, { end_time: value })}
              placeholder={t('End at')}
              icon={<Clock size={15} color={mutedIcon} />}
              containerClassName="flex-1"
            />
          </View>
        </View>
      ))}
      <DashedAddButton
        label={items.length === 0 ? t('Add event timeline item') : t('Add more')}
        onPress={addItem}
      />
    </View>
  );
}
