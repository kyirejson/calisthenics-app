import { ChatMessages, FileTile } from '../features/chat/ChatMessages';
import { s, lime, muted } from '../features/chat/styles';
import { useChatSession } from '../features/chat/useChatSession';

import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ServiceSettings } from './ServiceSettings';
import { AppGlyph } from '../components/AppGlyph';

import { MemoryEditor } from '../components/MemoryEditor';

export function DeepseekChat(props: { visible: boolean; onClose: () => void }) {
  const {
    visible,
    onClose,
    turns,
    draft,
    setDraft,
    pendingTurn,
    streamContent,
    activeTools,
    busy,
    error,
    settingsOpen,
    setSettingsOpen,
    memoryOpen,
    setMemoryOpen,
    filesOpen,
    setFilesOpen,
    picking,
    files,
    request,
    scroll,
    following,
    pick,
    remove,
    retry,
    openFiles,
    canSend,
    send,
  } = useChatSession(props);
  return (
    <Modal
      visible={visible}
      animationType={Platform.OS === 'web' ? 'none' : 'slide'}
      onRequestClose={() => {
        if (filesOpen) setFilesOpen(false);
        else if (settingsOpen) setSettingsOpen(false);
        else if (memoryOpen) setMemoryOpen(false);
        else onClose();
      }}
    >
      {memoryOpen ? <MemoryEditor onClose={() => setMemoryOpen(false)} /> : null}
      {settingsOpen ? (
        <ServiceSettings onClose={() => setSettingsOpen(false)} />
      ) : (
        <SafeAreaView style={s.root}>
          <KeyboardAvoidingView
            style={s.root}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View style={s.header}>
              <View style={s.brand}>
                <Text style={s.title}>DeepSeek</Text>
                <View style={s.badge}>
                  <Text style={s.badgeText}>Flash</Text>
                </View>
              </View>
              <View style={s.headerActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="查看个人记忆"
                  onPress={() => {
                    Keyboard.dismiss();
                    setMemoryOpen(true);
                  }}
                  style={s.hit}
                >
                  <AppGlyph name="book" size={20} color={muted} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="打开服务设置"
                  onPress={() => {
                    Keyboard.dismiss();
                    setSettingsOpen(true);
                  }}
                  style={s.hit}
                >
                  <AppGlyph name="settings" size={20} color={muted} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="关闭 DeepSeek 聊天"
                  onPress={onClose}
                  style={s.hit}
                >
                  <Text style={s.close}>×</Text>
                </Pressable>
              </View>
            </View>
            <ChatMessages
              model={{
                turns,
                setDraft,
                pendingTurn,
                streamContent,
                activeTools,
                busy,
                scroll,
                following,
                openFiles,
              }}
            />
            {error ? (
              <Text accessibilityRole="alert" style={s.error}>
                {error}
              </Text>
            ) : null}
            <View style={s.composerOuter}>
              {!filesOpen && !busy && files.length ? (
                <ScrollView
                  style={s.pendingFiles}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.pendingFilesContent}
                >
                  {files.map((file) => (
                    <View key={file.id} style={s.pendingFile}>
                      <FileTile file={file} remove={() => remove(file)} />
                    </View>
                  ))}
                </ScrollView>
              ) : null}
              <View style={s.composer}>
                <TextInput
                  accessibilityLabel="聊天输入"
                  multiline
                  value={draft}
                  onChangeText={setDraft}
                  editable={!busy}
                  placeholder="写下你的问题…"
                  placeholderTextColor="#75807E"
                  style={s.input}
                />
                <View style={s.composerActions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="添加聊天附件"
                    disabled={busy}
                    onPress={openFiles}
                    style={[s.fileButton, busy && s.disabled]}
                  >
                    <AppGlyph name="paperclip" size={20} color={muted} />
                    <Text style={s.fileButtonText}>
                      文件{files.length ? ` · ${files.length}` : ''}
                    </Text>
                  </Pressable>
                  {busy ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="停止回复"
                      onPress={() => request.current?.abort()}
                      style={s.send}
                    >
                      <AppGlyph name="stop" color="#0D1114" size={19} />
                    </Pressable>
                  ) : (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="发送聊天消息"
                      disabled={!canSend}
                      onPress={() => void send()}
                      style={[s.send, !canSend && s.sendDisabled]}
                    >
                      <AppGlyph name="arrowUp" color={canSend ? '#0D1114' : '#74816F'} size={22} />
                    </Pressable>
                  )}
                </View>
              </View>
            </View>
            {filesOpen ? (
              <View style={s.sheetLayer}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="关闭附件面板"
                  style={s.scrim}
                  onPress={() => setFilesOpen(false)}
                />
                <View testID="chat-file-sheet" accessibilityViewIsModal style={s.sheet}>
                  <View style={s.handle} />
                  <View style={s.sheetHeader}>
                    <Text style={s.sheetTitle}>添加文件</Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="收起附件面板"
                      onPress={() => setFilesOpen(false)}
                      style={s.hit}
                    >
                      <Text style={s.close}>×</Text>
                    </Pressable>
                  </View>
                  <Text style={s.sheetDescription}>提取文字后随消息发送给 DeepSeek</Text>
                  <View style={s.formats}>
                    {['PDF', 'DOCX', 'TXT', 'MD'].map((format) => (
                      <Text key={format} style={s.format}>
                        {format}
                      </Text>
                    ))}
                  </View>
                  <ScrollView
                    style={s.sheetFiles}
                    contentContainerStyle={s.sheetFilesContent}
                    keyboardShouldPersistTaps="handled"
                  >
                    {files.length ? (
                      files.map((file) => (
                        <FileTile
                          key={file.id}
                          file={file}
                          remove={() => remove(file)}
                          retry={() => retry(file)}
                        />
                      ))
                    ) : (
                      <View style={s.fileEmpty}>
                        <AppGlyph name="document" size={30} color={muted} />
                        <Text style={s.fileEmptyText}>选择一份资料，开始讨论</Text>
                        <Text style={s.fileMeta}>扫描 PDF 暂不支持文字识别</Text>
                      </View>
                    )}
                  </ScrollView>
                  {error ? (
                    <Text accessibilityRole="alert" style={s.fileErrorText}>
                      {error}
                    </Text>
                  ) : null}
                  <View style={s.sheetActions}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="选择附件文件"
                      disabled={picking || busy}
                      onPress={() => void pick()}
                      style={[s.chooseFile, picking && s.disabled]}
                    >
                      {picking ? (
                        <ActivityIndicator color={lime} size="small" />
                      ) : (
                        <AppGlyph name="plus" color={lime} />
                      )}
                      <Text style={s.linkText}>{picking ? '正在读取' : '选择文件'}</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="完成附件选择"
                      onPress={() => setFilesOpen(false)}
                      style={s.done}
                    >
                      <Text style={s.doneText}>完成</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            ) : null}
          </KeyboardAvoidingView>
        </SafeAreaView>
      )}
    </Modal>
  );
}
