import { Text, View } from 'react-native';
import { appPalette as c } from '../../theme';
// Deliberately no HTML, embedded media, executable URLs or remote Markdown plugin.
export function AssistantRichText({ text }: { text: string }) {
  return <View testID="assistant-reply" style={{ gap: 5 }}>{text.split('\n').map((line, index) => {
    const heading = /^(#{1,3})\s+/.test(line), bullet = /^\s*[-*]\s+/.test(line);
    const content = line.replace(/^#{1,3}\s+/, '').replace(/^\s*[-*]\s+/, '• ');
    return <Text key={index} style={{ color: c.text, fontSize: heading ? 17 : 15, fontWeight: heading ? '800' : '400', lineHeight: 25, marginTop: heading ? 6 : 0, paddingLeft: bullet ? 4 : 0 }}>{content.split(/(\*\*[^*]+\*\*)/g).map((part, n) => <Text key={n} style={part.startsWith('**') ? { fontWeight: '800' } : undefined}>{part.startsWith('**') ? part.slice(2, -2) : part}</Text>)}</Text>;
  })}</View>;
}
