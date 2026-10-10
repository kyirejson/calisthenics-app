/** Scope desktop textarea chrome to chat; don't change other editors or disable scrolling. */
export function ChatInputChrome() {
  return <style>{`
    [data-testid="chat-composer"] textarea { resize: none; scrollbar-width: none; }
    [data-testid="chat-composer"] textarea::-webkit-scrollbar { display: none; width: 0; height: 0; }
  `}</style>;
}
