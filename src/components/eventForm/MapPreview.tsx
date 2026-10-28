import { View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

export interface MapPreviewProps {
  coordinates: { lat: number; long: number };
  onChange: (coordinates: { lat: number; long: number }) => void;
}

export function MapPreview({ coordinates, onChange }: MapPreviewProps) {
  const position = { latitude: coordinates.lat, longitude: coordinates.long };
  return (
    <View className="mt-4 h-44 overflow-hidden rounded-[14px] border border-app-border dark:border-dark-border">
      <MapView
        style={{ flex: 1 }}
        region={{ ...position, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
        onPress={(event) =>
          onChange({ lat: event.nativeEvent.coordinate.latitude, long: event.nativeEvent.coordinate.longitude })
        }
      >
        <Marker coordinate={position} />
      </MapView>
    </View>
  );
}
