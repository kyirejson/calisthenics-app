import { useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import { useAppStore } from '../store/AppStore';
import { appPalette as p } from '../theme';
import { confirmAction } from '../utils/confirm';
import { Button, Page } from './ui';

export function StorageRecovery({ full = false }: { full?: boolean }) {
  const { storageIssues, exportData, retryStorageLoading, clearData } = useAppStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!Object.keys(storageIssues).length) return null;
  const run = async (action: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true); setError('');
    try { await action(); } catch { setError('操作未完成，请重试。'); }
    finally { setBusy(false); }
  };
  const content = <View testID="storage-recovery" style={s.card}>
    <Text accessibilityRole="alert" style={s.title}>本地数据已进入恢复保护</Text>
    <Text style={s.body}>部分数据读取或迁移失败，相关写入已暂停，其他数据仍保留。导出包含可读取记录及恢复用原始文本；不包含照片文件。</Text>
    <Button label="导出恢复备份" disabled={busy} onPress={() => void run(async () => Share.share({ title: 'Uncover 恢复备份', message: await exportData() }))} />
    <Button label="重试读取" disabled={busy} onPress={() => void run(retryStorageLoading)} />
    {full ? <Button label="清除并重新建档" variant="danger" disabled={busy} onPress={() => confirmAction('清除全部本机数据？',
      '请先导出恢复备份。此操作会删除全部本机记录、档案和照片；JSON不能恢复照片，清除无法撤销。',
      () => void run(clearData), { destructive: true, confirmLabel: '确认清除' })} /> : null}
    {error ? <Text accessibilityRole="alert" style={s.body}>{error}</Text> : null}
  </View>;
  return full ? <Page tone="dark">{content}</Page> : content;
}
const s = StyleSheet.create({ card: { padding: 12, margin: 12, borderRadius: 14, borderWidth: 1, borderColor: p.warning, backgroundColor: p.card, gap: 8 },
  title: { color: p.text, fontSize: 15, fontWeight: '800' }, body: { color: p.muted, fontSize: 12, lineHeight: 19 } });
