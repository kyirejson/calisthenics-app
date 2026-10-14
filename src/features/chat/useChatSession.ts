import { useChatAttachments } from './useChatAttachments';
import { isClearContextCommand } from './commands';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Keyboard, ScrollView } from 'react-native';
import { loadConnection } from '../../integrations/credentials';
import { subscribeConnection } from '../../integrations/connectionRuntime.mjs';
import { useAppRepository } from '../../store/AppStore';
import { runAgentTurn } from '../../integrations/runAgentTurn';
import { releaseChatFile } from '../../integrations/chatFiles';
import type { ChatAttachment } from '../../integrations/chatFileTypes';
import { agentConversation, clearAgentContext, stopAgentReply } from '../../agent/runtime';
import type { AgentTurn, TurnHandle } from '../../agent/conversation';
export type Turn = AgentTurn;

export function useChatSession({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const repository = useAppRepository();
  const conversation = useSyncExternalStore(agentConversation.subscribe, agentConversation.getSnapshot, agentConversation.getSnapshot);
  const [draft, setDraft] = useState(''), [contextNotice, setContextNotice] = useState('');
  const [error, setError] = useState(''), [ready, setReady] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false), [memoryOpen, setMemoryOpen] = useState(false);
  const [filesOpen, setFilesOpen] = useState(false);
  const alive = useRef(true), locked = useRef(false), request = useRef<AbortController | null>(null);
  // Retries reuse the operation identity, including successful tool receipts.
  const messageRequest = useRef<{ signature: string; id: string } | null>(null);
  const scroll = useRef<ScrollView>(null), following = useRef(true);
  const { files, setFiles, filesRef, picking, pick, remove, retry } = useChatAttachments({ alive, locked, setError });
  useEffect(() => {
    alive.current = true;
    const unsubscribe = subscribeConnection(() => { request.current?.abort(); agentConversation.interrupt(); });
    void Promise.all([loadConnection(), agentConversation.load()]).then(() => {
      if (alive.current) setReady(true);
    }).catch(e => { if (alive.current) setError(e instanceof Error ? e.message : '无法读取连接或对话配置。'); });
    return () => {
      alive.current = false;
      // Unmount owns only this typed request. Hiding the panel does not stop headless voice.
      if (request.current) { request.current.abort(); agentConversation.interrupt(messageRequest.current?.id); }
      unsubscribe(); filesRef.current.forEach(file => releaseChatFile(file.source));
    };
  }, []);
  const openFiles = () => { Keyboard.dismiss(); setFilesOpen(true); };
  const canSend = !picking && !locked.current && (isClearContextCommand(draft) || ready &&
    files.every(file => file.status === 'ready') && (!!draft.trim() || !!files.length));
  const send = async () => {
    if (!canSend) return;
    if (isClearContextCommand(draft)) {
      try {
        await clearAgentContext(); setError(''); setDraft(''); messageRequest.current = null;
        filesRef.current.forEach(remove); setFilesOpen(false); following.current = true;
        scroll.current?.scrollTo({ y: 0, animated: false });
        setContextNotice('对话上下文已清空，个人记忆和已保存记录保留。');
      } catch (e) { setError(e instanceof Error ? e.message : '上下文未能清空，请重试。'); }
      return;
    }
    setContextNotice('');
    const capturedFiles: ChatAttachment[] = files.map(({ id, name, size, kind, text }) => ({ id, name, size, kind, text }));
    const user = { content: draft.trim(), attachments: capturedFiles.length ? capturedFiles : undefined };
    const signature = JSON.stringify(user);
    if (messageRequest.current?.signature !== signature) messageRequest.current = { signature, id: `chat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}` };
    const requestId = messageRequest.current!.id, executionId = `${requestId}-attempt-${Math.random().toString(36).slice(2)}`;
    const controller = new AbortController();
    locked.current = true; request.current = controller; following.current = true; setError('');
    let handle: TurnHandle | null = null;
    try {
      // Typed follow-ups can stop a spoken answer without navigating to another screen.
      await stopAgentReply();
      handle = await agentConversation.begin({ requestId, source: 'text', user, controller });
      if (!handle) return;
      const activeHandle = handle;
      const answer = await runAgentTurn({ repository, requestId, executionId, controller,
        messages: agentConversation.messages(handle), responseMode: 'text',
        onRoundStart: () => agentConversation.round(activeHandle),
        onToolCall: call => agentConversation.tool(activeHandle, call),
        onToolResult: call => agentConversation.receipt(activeHandle, call),
        onDelta: (_delta, accumulated) => agentConversation.delta(activeHandle, accumulated),
      });
      if (agentConversation.complete(handle, answer) && alive.current) {
        setDraft(''); messageRequest.current = null; setFiles([]); files.forEach(file => releaseChatFile(file.source));
      }
    } catch (e) {
      if (controller.signal.aborted) agentConversation.interrupt(requestId);
      else {
        const message = e instanceof Error ? e.message : '请求失败，请重试。';
        if (handle) agentConversation.fail(handle, message);
        if (alive.current) setError(message);
      }
    } finally {
      if (request.current === controller) { locked.current = false; request.current = null; }
    }
  };
  const busy = conversation.generating || ['speaking', 'acknowledging'].includes(conversation.voice.phase);
  return { visible, onClose, turns: conversation.turns, voice: conversation.voice, preview: conversation.preview,
    draft, setDraft, busy, inputBusy: locked.current, error: error || conversation.error || conversation.voice.error || '', contextNotice,
    settingsOpen, setSettingsOpen, memoryOpen, setMemoryOpen, filesOpen, setFilesOpen,
    picking, files, scroll, following, pick, remove, retry, openFiles, canSend, send, stop: () => void stopAgentReply() };
}
