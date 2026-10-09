import { useRef, useState, type RefObject, type Dispatch, type SetStateAction } from 'react';
import { attachmentKind } from '../../integrations/chatAttachments.mjs';
import { pickChatFiles, readChatFile, releaseChatFile } from '../../integrations/chatFiles';
import type { DraftAttachment, FileSource } from '../../integrations/chatFileTypes';

/** Attachment parsing and resource lifetime, independent of streaming/model requests. */
export function useChatAttachments({
  alive,
  locked,
  setError,
}: {
  alive: RefObject<boolean>;
  locked: RefObject<boolean>;
  setError: Dispatch<SetStateAction<string>>;
}) {
  const [picking, setPicking] = useState(false),
    [files, setFiles] = useState<DraftAttachment[]>([]);
  const filesRef = useRef(files);
  filesRef.current = files;
  const fileId = useRef(0),
    pickingLock = useRef(false),
    discarded = useRef(new Set<string>());
  const parsing = useRef(new Set<string>()),
    parserQueue = useRef(Promise.resolve());
  const read = (file: DraftAttachment) => {
    if (parsing.current.has(file.id)) return parserQueue.current;
    parsing.current.add(file.id);
    const job = parserQueue.current.then(async () => {
      if (!alive.current || discarded.current.delete(file.id)) {
        parsing.current.delete(file.id);
        releaseChatFile(file.source);
        return;
      }
      try {
        const text = await readChatFile(file.source);
        if (alive.current)
          setFiles((current) =>
            current.map((item) =>
              item.id === file.id ? { ...item, text, status: 'ready', error: undefined } : item,
            ),
          );
      } catch (e) {
        if (alive.current)
          setFiles((current) =>
            current.map((item) =>
              item.id === file.id
                ? {
                    ...item,
                    status: 'error',
                    error: e instanceof Error ? e.message : '无法读取此文件，请检查格式。',
                  }
                : item,
            ),
          );
      } finally {
        parsing.current.delete(file.id);
        if (!alive.current || discarded.current.delete(file.id)) releaseChatFile(file.source);
      }
    });
    parserQueue.current = job.catch(() => undefined);
    return job;
  };
  const pick = async () => {
    if (pickingLock.current || locked.current) return;
    pickingLock.current = true;
    setPicking(true);
    setError('');
    try {
      const sources = await pickChatFiles();
      if (!alive.current) {
        sources.forEach(releaseChatFile);
        return;
      }
      const added = sources.map((source: FileSource): DraftAttachment => {
        let kind = source.name.split('.').pop()?.toLowerCase() || 'file',
          problem;
        try {
          kind = attachmentKind(source.name);
        } catch (e) {
          problem = e instanceof Error ? e.message : '不支持此格式。';
        }
        return {
          id: `attachment-${++fileId.current}`,
          name: source.name,
          size: source.size,
          kind,
          text: '',
          source,
          status: problem ? 'error' : 'reading',
          error: problem,
        };
      });
      setFiles((current) => [...current, ...added]);
      // Serialize local parsing to avoid concurrent large PDF allocations on phones.
      for (const file of added)
        if (file.status === 'reading') {
          if (discarded.current.delete(file.id) || !alive.current) releaseChatFile(file.source);
          else await read(file);
        }
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : '无法打开文件选择器。');
    } finally {
      pickingLock.current = false;
      if (alive.current) setPicking(false);
    }
  };
  const remove = (file: DraftAttachment) => {
    setFiles((current) => current.filter((item) => item.id !== file.id));
    if (file.status === 'reading') discarded.current.add(file.id);
    else releaseChatFile(file.source);
  };
  const retry = (file: DraftAttachment) => {
    if (pickingLock.current) return;
    setFiles((current) =>
      current.map((item) =>
        item.id === file.id ? { ...item, status: 'reading', error: undefined } : item,
      ),
    );
    void read(file);
  };

  return { files, setFiles, filesRef, picking, pick, remove, retry };
}
