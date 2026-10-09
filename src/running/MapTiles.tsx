import { Image, Platform, StyleSheet, View, type NativeSyntheticEvent, type ViewProps, type ViewStyle } from 'react-native';
import { requireNativeView, requireOptionalNativeModule } from 'expo';

type Tile = { key: string; uri: string; x: number; y: number };
type NativeTileEvent = NativeSyntheticEvent<{ key: string }>;
type NativeProps = ViewProps & { tiles: Tile[]; attempt: number; onTileLoad: (event: NativeTileEvent) => void; onTileError: (event: NativeTileEvent) => void };
const NativeTiles = Platform.OS === 'android' && requireOptionalNativeModule('UncoverRunning')
  ? requireNativeView<NativeProps>('UncoverRunning', 'MapTilesView') : null;
// Native Canvas draws bitmap pixels at the actual map scale, independent of RN
// image/child layout. GPS and route overlays remain above this imagery layer.
export function MapTiles({ tiles, attempt, onLoad, onError }: { tiles: Tile[]; attempt: number; onLoad: (key: string) => void; onError: (key: string) => void }) {
  if (NativeTiles) return <NativeTiles style={StyleSheet.absoluteFill} pointerEvents="none" tiles={tiles} attempt={attempt} onTileLoad={event => onLoad(event.nativeEvent.key)} onTileError={event => onError(event.nativeEvent.key)} />;
  return <View style={[StyleSheet.absoluteFill, Platform.OS === 'web' ? { filter: 'invert(92%) hue-rotate(165deg) saturate(50%) brightness(72%) contrast(95%)' } as ViewStyle : null]} pointerEvents="none">{tiles.map(tile => <Image key={tile.key + ':' + attempt} source={{ uri: tile.uri }} testID="run-map-tile" onLoad={() => onLoad(tile.key)} onError={() => onError(tile.key)} style={{ position: 'absolute', width: 256, height: 256, left: tile.x, top: tile.y }} />)}</View>;
}
