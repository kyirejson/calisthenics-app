import { ChatMessages, FileTile } from '../features/chat/ChatMessages';
import { s, lime, muted } from '../features/chat/styles';
import { useChatSession } from '../features/chat/useChatSession';
import { ChatComposer } from '../features/chat/ChatComposer';
import { ChatMark } from '../features/chat/ChatMark';

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
    voice,
    preview,
    busy,
    inputBusy,
    error,
    contextNotice,
    settingsOpen,
    setSettingsOpen,
    memoryOpen,
    setMemoryOpen,
    filesOpen,
    setFilesOpen,
    picking,
    files,
    stop,
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
            behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}
          >
            <View style={s.header}>
              <View style={s.brand}>
                <ChatMark size={32} />
                <View style={s.brandCopy}>
                  <Text style={s.title}>AI 助手</Text>
                  <Text style={s.model}>DeepSeek · Flash</Text>
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
                voice,
                preview,
                busy,
                scroll,
                following,
                openFiles,
              }}
            />
            {contextNotice ? <Text testID="chat-context-notice" accessibilityLiveRegion="polite" style={s.contextNotice}>{contextNotice}</Text> : null}
            {error ? (
              <Text accessibilityRole="alert" style={s.error}>
                {error}
              </Text>
            ) : null}
            <ChatComposer draft={draft} setDraft={setDraft} busy={busy} inputBusy={inputBusy} canSend={canSend}
              files={files} filesOpen={filesOpen} openFiles={openFiles} remove={remove}
              send={() => void send()} stop={stop} />
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
