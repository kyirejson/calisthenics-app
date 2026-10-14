import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { AppGlyph } from '../../components/AppGlyph';
import type { DraftAttachment } from '../../integrations/chatFileTypes';
import { FileTile } from './ChatMessages';
import { ChatInputChrome } from './ChatInputChrome';
import { s, lime, muted } from './styles';

export function ChatComposer({ draft, setDraft, busy, inputBusy, canSend, files, filesOpen, openFiles, remove, send, stop }: {
  draft: string; setDraft: (text: string) => void; busy: boolean; inputBusy: boolean; canSend: boolean;
  files: DraftAttachment[]; filesOpen: boolean; openFiles: () => void;
  remove: (file: DraftAttachment) => void; send: () => void; stop: () => void;
}) {
  const input = useRef<TextInput>(null);
  const { width, height } = useWindowDimensions();
  const maximum = Math.max(64, Math.min(132, height * .25));
  const [inputHeight, setInputHeight] = useState(48);
  const [focused, setFocused] = useState(false);
  const showStop = busy && (!canSend || inputBusy);
  const fitHeight = (value: number) => Math.max(48, Math.min(maximum, value));
  useEffect(() => { if (!draft) setInputHeight(48); }, [draft]);
  // Native reports content size; a textarea must be measured unconstrained to shrink as well as grow.
  useLayoutEffect(() => {
    if (Platform.OS !== 'web') return;
    const node = input.current as unknown as HTMLTextAreaElement | null;
    if (!node?.style) return;
    node.style.height = '0px';
    const next = fitHeight(node.scrollHeight);
    node.style.height = `${next}px`;
    setInputHeight(next);
  }, [draft, maximum, width]);
  return <View testID="chat-composer" style={s.composerOuter}>
    <ChatInputChrome />
    <View style={[s.composer, focused && s.composerFocused]}>
      {!filesOpen && !busy && files.length ? <ScrollView
        testID="chat-pending-files" style={s.pendingFiles} horizontal showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled" contentContainerStyle={s.pendingFilesContent}>
        {files.map(file => <View key={file.id} style={[s.pendingFile, { width: Math.min(300, width - 56) }]}><FileTile file={file} remove={() => remove(file)} /></View>)}
      </ScrollView> : null}
      <TextInput ref={input} accessibilityLabel="聊天输入" multiline value={draft} onChangeText={setDraft}
        editable={!inputBusy} placeholder="写下你的问题…" placeholderTextColor="#82908D"
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        onContentSizeChange={event => { if (Platform.OS !== 'web') setInputHeight(fitHeight(event.nativeEvent.contentSize.height)); }}
        submitBehavior="newline" blurOnSubmit={false} textAlignVertical="top" underlineColorAndroid="transparent"
        style={[s.input, { height: fitHeight(inputHeight), maxHeight: maximum }]} />
      <View style={s.composerActions}>
        <Pressable accessibilityRole="button" accessibilityLabel="添加聊天附件" disabled={inputBusy} onPress={openFiles}
          style={({ pressed }) => [s.fileButton, inputBusy && s.disabled, pressed && s.pressed]}>
          <AppGlyph name="paperclip" size={21} color={focused ? lime : muted} />
          <Text style={s.fileButtonText}>添加文件{files.length ? ` · ${files.length}` : ''}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={showStop ? '停止回复' : '发送聊天消息'}
          disabled={!showStop && !canSend} onPress={showStop ? stop : send}
          style={({ pressed }) => [s.send, !busy && !canSend && s.sendDisabled, pressed && s.pressed]}>
          <AppGlyph name={showStop ? 'stop' : 'arrowUp'} color={busy || canSend ? '#0D1114' : '#91A580'} size={showStop ? 18 : 23} />
        </Pressable>
      </View>
    </View>
  </View>;
}
