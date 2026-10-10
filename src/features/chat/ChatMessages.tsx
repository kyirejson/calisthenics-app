import { s, lime, muted } from './styles';
import { useState } from 'react';
import { useChatSession, type Turn } from './useChatSession';
import { ActivityIndicator, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';

import { AppGlyph } from '../../components/AppGlyph';
import { ChatMark } from './ChatMark';
import { LinearGradient } from 'expo-linear-gradient';

import { MarkdownView } from '../../components/MarkdownView';
import { fileSize } from '../../integrations/chatAttachments.mjs';
import type { ChatAttachment, DraftAttachment } from '../../integrations/chatFileTypes';
export function FileTile({
  file,
  remove,
  retry,
}: {
  file: ChatAttachment | DraftAttachment;
  remove?: () => void;
  retry?: () => void;
}) {
  const status = 'status' in file ? file.status : 'ready';
  return (
    <View style={[s.fileTile, status === 'error' && s.fileError]}>
      <View style={s.fileIcon}>
        <AppGlyph name="document" color={status === 'error' ? '#F6A49A' : lime} size={22} />
      </View>
      <View style={s.fileDetails}>
        <Text numberOfLines={2} style={s.fileName}>
          {file.name}
        </Text>
        <Text style={s.fileMeta}>
          {file.kind.toUpperCase()} · {fileSize(file.size)} ·{' '}
          {status === 'reading' ? '正在读取文字…' : status === 'error' ? '读取失败' : '文字已就绪'}
        </Text>
        {'error' in file && file.error ? (
          <Text selectable style={s.fileErrorText}>
            {file.error}
          </Text>
        ) : null}
        {status === 'error' && retry ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`重试读取 ${file.name}`}
            onPress={retry}
            style={s.retry}
          >
            <Text style={s.linkText}>重新读取</Text>
          </Pressable>
        ) : null}
      </View>
      {status === 'reading' ? <ActivityIndicator size="small" color={lime} /> : null}
      {remove ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`移除附件 ${file.name}`}
          onPress={remove}
          style={s.hit}
        >
          <Text style={s.close}>×</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
export function ChatMessages({
  model,
}: {
  model: Pick<
    ReturnType<typeof useChatSession>,
    | 'turns'
    | 'setDraft'
    | 'pendingTurn'
    | 'streamContent'
    | 'activeTools'
    | 'busy'
    | 'scroll'
    | 'following'
    | 'openFiles'
  >;
}) {
  const [readingHeight, setReadingHeight] = useState<number | null>(null);
  const compact = useWindowDimensions().height < 560 || readingHeight !== null && readingHeight < 360;
  const {
    turns,
    setDraft,
    pendingTurn,
    streamContent,
    activeTools,
    busy,
    scroll,
    following,
    openFiles,
  } = model;
  const renderUser = (turn: Turn, key: string) => (
    <View key={key} style={s.user}>
      {turn.content ? (
        <Text selectable style={s.userText}>
          {turn.content}
        </Text>
      ) : null}
      {turn.attachments?.map((file) => (
        <FileTile key={file.id} file={file} />
      ))}
    </View>
  );

  return (
    <ScrollView
      testID="chat-messages"
      ref={scroll}
      style={s.history}
      showsVerticalScrollIndicator={false}
      onLayout={event => setReadingHeight(event.nativeEvent.layout.height)}
      contentContainerStyle={[s.content, !turns.length && !busy && s.emptyContent]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      scrollEventThrottle={64}
      onScroll={(event) => {
        const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
        following.current = contentOffset.y + layoutMeasurement.height >= contentSize.height - 70;
      }}
      onContentSizeChange={() => {
        if (following.current) scroll.current?.scrollToEnd({ animated: true });
      }}
    >
      {!turns.length && !busy ? (
        <View style={[s.welcome, compact && s.welcomeCompact]}>
          {!compact ? <><LinearGradient pointerEvents="none" colors={['#202C1B', '#121A17', '#0D1114']} style={s.welcomeGlow} />
          <View style={s.welcomeSymbol}><ChatMark size={88} /></View>
          <Text style={s.eyebrow}>UNCOVER AI</Text></> : null}
          <Text style={[s.welcomeTitle, compact && s.welcomeTitleCompact]}>{compact ? '把训练问题，聊明白。' : '把训练问题，\n聊明白。'}</Text>
          {!compact ? <Text style={s.welcomeDescription}>训练、饮食、动作进阶，也可以上传资料一起讨论。</Text> : null}
          <View style={[s.suggestions, compact && s.suggestionsCompact]}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setDraft('看看今日训练')}
              style={[s.suggestion, compact && s.suggestionCompact]}
            >
              <AppGlyph name="dumbbell" size={22} color={muted} />
              <Text style={s.suggestionText}>看看今日训练</Text>
              <AppGlyph name="chevron" size={16} color={muted} />
            </Pressable>
            <Pressable accessibilityRole="button" onPress={openFiles} style={[s.suggestion, compact && s.suggestionCompact]}>
              <AppGlyph name="document" size={22} color={muted} />
              <Text style={s.suggestionText}>分析一份资料</Text>
              <AppGlyph name="chevron" size={16} color={muted} />
            </Pressable>
          </View>
        </View>
      ) : null}
      {turns.map((turn, index) =>
        turn.role === 'user' ? (
          renderUser(turn, String(index))
        ) : (
          <View key={index} style={s.assistant}>
            <View style={s.assistantHeader}>
              <ChatMark size={28} />
              <Text style={s.assistantName}>DeepSeek</Text>
            </View>
            {turn.toolsUsed?.length ? (
              <Text style={s.toolText}>{turn.toolsUsed.join(' · ')}</Text>
            ) : null}
            <MarkdownView content={turn.content} accentColor={lime} />
          </View>
        ),
      )}
      {pendingTurn ? renderUser(pendingTurn, 'pending') : null}
      {busy && streamContent ? (
        <View style={s.assistant}>
          <View style={s.assistantHeader}>
            <ChatMark size={28} />
            <Text style={s.assistantName}>DeepSeek</Text>
          </View>
          {activeTools.length ? <Text style={s.toolText}>{activeTools.join(' · ')}</Text> : null}
          <MarkdownView content={streamContent} accentColor={lime} />
        </View>
      ) : busy ? (
        <View style={s.busyRow}>
          <ActivityIndicator size="small" color={lime} />
          <Text accessibilityLiveRegion="polite" style={s.busyText}>
            {activeTools.length ? `已调用：${activeTools.join(' · ')}，正在生成回复…` : '正在回复…'}
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}
