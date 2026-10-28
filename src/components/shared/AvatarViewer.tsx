import { Modal, Pressable, View } from 'react-native';
import { Image } from 'expo-image';

import { AppText } from '@/components/ui/AppText';

export interface AvatarViewerProps {
  uri?: string | null;
  visible: boolean;
  onClose: () => void;
  fallback?: string;
}

export function AvatarViewer({ uri, visible, onClose, fallback }: AvatarViewerProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable className="flex-1 items-center justify-center bg-black/90 px-8" onPress={onClose}>
        <View className="aspect-square w-full max-w-[340px] overflow-hidden rounded-full border-2 border-white/15">
          {uri ? (
            <Image source={{ uri }} contentFit="cover" transition={200} style={{ width: '100%', height: '100%' }} />
          ) : (
            <View className="h-full w-full items-center justify-center bg-primary">
              <AppText className="font-gilroy-bold text-white" style={{ fontSize: 96 }}>
                {fallback}
              </AppText>
            </View>
          )}
        </View>
      </Pressable>
    </Modal>
  );
}
