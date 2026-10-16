import type { VoicePresentation } from './protocol';
import { hasVoiceOutput } from './protocol';

const labels = {
  stopped: '语音已关闭', starting: '正在准备内置语音', wake: '等待 BLACK 唤醒',
  listening: '正在听你说话', assessing: '正在确认你的意思', processing: '正在处理你的请求',
  synthesizing: '正在准备语音', buffering: '正在准备后续语音', speaking: '正在回答',
  blocked: '麦克风暂不可用', unavailable: '当前环境不支持语音对话',
} as const;

/** A view of native facts, not another state machine or a guess based on microphone availability. */
export function voicePresentation(voice: VoicePresentation) {
  return {
    label: labels[voice.phase],
    outputBusy: hasVoiceOutput(voice),
    showTranscript: voice.phase === 'listening' || voice.phase === 'assessing',
    speaking: voice.phase === 'speaking',
  };
}
