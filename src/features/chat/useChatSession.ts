import { useChatAttachments } from './useChatAttachments';
import { isClearContextCommand } from './commands';
import { useEffect, useRef, useState } from 'react';
import { Keyboard, ScrollView } from 'react-native';
import { currentConnection, loadConnection } from '../../integrations/credentials';
import { subscribeConnection } from '../../integrations/connectionRuntime.mjs';
import { createDeepseekClient } from '../../integrations/deepseekClient.mjs';

import { useAppRepository } from '../../store/AppStore';
import { readOrInitializeMemory } from '../../memory/operations';
import { profileMarkdown } from '../../memory/profileMemory';
import { personalChat } from '../../integrations/personalTools.mjs';
import { executePersonalTool } from '../../integrations/personalData';
import { localWeightDate } from '../../domain/weight/weightTrend';

import { attachmentMessage } from '../../integrations/chatAttachments.mjs';
import { releaseChatFile } from '../../integrations/chatFiles';
import type { ChatAttachment } from '../../integrations/chatFileTypes';
export type Turn = {
  role: 'user' | 'assistant';
  content: string;
  toolsUsed?: string[];
  attachments?: ChatAttachment[];
};

function toolLabel(name: string, args: Record<string, unknown>): string {
  if (name === 'search_knowledge')
    return `检索知识库${typeof args.query === 'string' ? ` · ${args.query}` : ''}`;
  if (name === 'read_knowledge_note')
    return `阅读资料 · ${typeof args.path === 'string' ? args.path.split('/').pop()?.replace('.md', '') : '知识库'}`;
  return (
    (
      {
        read_memory: '读取个人记忆',
        update_memory: '更新个人记忆',
        read_today_training: '读取今日训练',
        read_recent_weight: '读取近期体重',
        read_today_meals: '读取今日饮食',
        write_meal_records: '处理饮食记录',
        read_music_settings: '读取音乐预设', write_music_settings: '保存音乐预设',
        open_music: '打开音乐软件', read_music_screen: '查看音乐界面',
        music_ui_action: '操作音乐界面', control_music: '控制音乐播放', read_music_playback: '核实播放状态',
      } as Record<string, string>
    )[name] || name
  );
}

export function useChatSession({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const repository = useAppRepository();
  const [turns, setTurns] = useState<Turn[]>([]),
    [draft, setDraft] = useState('');
  const [pendingTurn, setPendingTurn] = useState<Turn | null>(null);
  const [streamContent, setStreamContent] = useState('');
  const [activeTools, setActiveTools] = useState<string[]>([]);
  const [contextNotice, setContextNotice] = useState('');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [ready, setReady] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false),
    [memoryOpen, setMemoryOpen] = useState(false);
  const [filesOpen, setFilesOpen] = useState(false);
  const alive = useRef(true),
    locked = useRef(false),
    request = useRef<AbortController | null>(null);
  // Keep the same message identity on retries; a successfully sent new message gets a new identity.
  const messageRequest = useRef<{ signature: string; id: string } | null>(null);
  const scroll = useRef<ScrollView>(null),
    following = useRef(true);
  const { files, setFiles, filesRef, picking, pick, remove, retry } = useChatAttachments({
    alive,
    locked,
    setError,
  });
  useEffect(() => {
    alive.current = true;
    const unsubscribe = subscribeConnection(() => request.current?.abort());
    void loadConnection()
      .then(() => {
        if (alive.current) setReady(true);
      })
      .catch((e) => {
        if (alive.current) setError(e instanceof Error ? e.message : '无法读取连接配置。');
      });
    return () => {
      alive.current = false;
      request.current?.abort();
      unsubscribe();
      filesRef.current.forEach((file) => releaseChatFile(file.source));
    };
  }, []);
  const openFiles = () => {
    Keyboard.dismiss();
    setFilesOpen(true);
  };
  const canSend =
    !picking &&
    (isClearContextCommand(draft) || ready &&
      files.every((file) => file.status === 'ready') &&
      (!!draft.trim() || !!files.length));
  const send = async () => {
    if (!canSend || locked.current) return;
    if (isClearContextCommand(draft)) {
      // This is a local action, not a model turn: no API request, data tool or memory write.
      setTurns([]);
      setPendingTurn(null);
      setStreamContent('');
      setActiveTools([]);
      setError('');
      setDraft('');
      messageRequest.current = null;
      filesRef.current.forEach(remove);
      setFilesOpen(false);
      following.current = true;
      scroll.current?.scrollTo({ y: 0, animated: false });
      setContextNotice('对话上下文已清空，个人记忆和已保存记录保留。');
      return;
    }
    setContextNotice('');
    const capturedFiles: ChatAttachment[] = files.map(({ id, name, size, kind, text }) => ({
      id,
      name,
      size,
      kind,
      text,
    }));
    const user: Turn = {
      role: 'user',
      content: draft.trim(),
      attachments: capturedFiles.length ? capturedFiles : undefined,
    };
    const signature = JSON.stringify(user);
    if (messageRequest.current?.signature !== signature) messageRequest.current = { signature, id: `chat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}` };
    const requestId = messageRequest.current!.id;
    const executionId = `${requestId}-attempt-${Math.random().toString(36).slice(2)}`;
    const controller = new AbortController();
    locked.current = true;
    request.current = controller;
    following.current = true;
    setBusy(true);
    setError('');
    setPendingTurn(user);
    setStreamContent('');
    setActiveTools([]);
    const capturedTools: string[] = [];
    let unsubscribeMusic = () => {};
    try {
      await loadConnection();
      if (controller.signal.aborted) throw Error('请求已取消，请重试。');
      const messages = [...turns, user];
      const { musicTransport } = await import('../../music/transport');
      unsubscribeMusic = musicTransport.onCancelled(executionId, () => controller.abort());
      const musicReceipts = await musicTransport.receipts(requestId).catch(e => [{ ok: false, error: e instanceof Error ? e.message : '音乐操作回执读取失败。' }]);
      const answer = await personalChat({
        client: createDeepseekClient({ config: currentConnection() }),
        messages: messages.map(attachmentMessage),
        memory: await readOrInitializeMemory(
          repository.getSnapshot().profile
            ? profileMarkdown(repository.getSnapshot().profile!)
            : null,
        ),
        date: localWeightDate(new Date()),
        time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
        mealReceipts: repository.getSnapshot().nutritionJournal.mealOperationReceipts?.filter(row => row.requestId === requestId)
          .map(row => ({ operationKey: row.id.slice(requestId.length + 1), entryIds: row.entryIds })) ?? [],
        signal: controller.signal,
        musicReceipts,
        execute: (name: string, input: unknown, signal?: AbortSignal) =>
          executePersonalTool(name, input, repository.getSnapshot(), signal,
            { requestId, executionId, apply: repository.getSnapshot().applyMealOperations, updateSettings: repository.getSnapshot().updateSettings }),
        onToolCall: (call: { name: string; args: Record<string, unknown> }) => {
          const label = toolLabel(call.name, call.args);
          if (!capturedTools.includes(label)) capturedTools.push(label);
          if (alive.current) setActiveTools([...capturedTools]);
        },
        onDelta: (_delta: string, accumulated: string) => {
          if (alive.current) setStreamContent(accumulated);
        },
      });
      if (alive.current && !controller.signal.aborted) {
        setTurns([
          ...messages,
          {
            role: 'assistant',
            content: answer,
            toolsUsed: capturedTools.length ? capturedTools : undefined,
          },
        ]);
        setDraft('');
        messageRequest.current = null;
        setFiles([]);
        files.forEach((file) => releaseChatFile(file.source));
      }
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : '请求失败，请重试。');
    } finally {
      try {
        const { musicTransport } = await import('../../music/transport');
        if (controller.signal.aborted) await musicTransport.cancel(executionId);
        await musicTransport.returnToApp(requestId, executionId);
      } catch { /* Missing/revoked music access must not strand the chat's busy state. */ }
      unsubscribeMusic();
      locked.current = false;
      request.current = null;
      if (alive.current) {
        setBusy(false);
        setPendingTurn(null);
        setStreamContent('');
        setActiveTools([]);
      }
    }
  };

  return {
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
    contextNotice,
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
  };
}
