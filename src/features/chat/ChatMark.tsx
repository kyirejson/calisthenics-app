import Svg, { Path } from 'react-native-svg';
import { Platform } from 'react-native';

/** The same small folded mark in the header, welcome and assistant messages. */
export function ChatMark({ size = 32 }: { size?: number }) {
  return <Svg width={size} height={size * .8} viewBox="0 0 80 64" accessible={Platform.OS === 'web' ? undefined : false} aria-hidden>
    <Path d="M38 6c5-1 10 1 13 6l20 34c3 6-1 12-8 12H51L28 18Z" fill="#718C30" />
    <Path d="M31 6h15c-4 0-7 3-10 8L17 48c-3 5-6 7-11 7H5c-5 0-7-5-4-10L21 12c2-4 5-6 10-6Z" fill="#C8F545" />
    <Path d="M66 43h10c4 0 5 4 3 7l-5 8c-2 3-5 4-9 4H53c-4 0-7-3-8-6 6 2 10 0 13-5l3-4c1-2 3-4 5-4Z" fill="#C8F545" />
  </Svg>;
}
