import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { getOriginalImage, getOriginalResource } from '../data/originalResources';
import { getExerciseArtwork, type ArtworkFrame } from '../data/exerciseArtwork';
import { appPalette, fitnessColors as colors, radius } from '../theme';
import type { Exercise } from '../types';
import { hasSupportIllustration, SupportIllustration } from './SupportIllustration';
import { loadedImageDimensions } from '../utils/imageDimensions';
import { fitSubjectFrame, getSubjectFrame, photoAspect } from '../utils/exerciseFraming';

const imageSizes = new Map<string, { width: number; height: number }>();

export function ExercisePhoto({ exercise, frame, resizeMode = 'contain', framing = 'full', showShade = true, showTag = true, compact = false, onDimensions, style }: {
  exercise: Exercise;
  frame?: ArtworkFrame;
  resizeMode?: 'cover' | 'contain';
  framing?: 'full' | 'subject';
  showShade?: boolean;
  showTag?: boolean;
  compact?: boolean;
  onDimensions?: (width: number, height: number) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const artwork = getExerciseArtwork(exercise);
  const selected = frame || artwork.cover;
  const selectedSource = selected?.source;
  const remoteUri = selectedSource && typeof selectedSource === 'object' && !Array.isArray(selectedSource) ? selectedSource.uri || '' : '';
  const remoteAvailable = /^https?:\/\//i.test(remoteUri);
  const localImage = remoteAvailable ? undefined : selectedSource;
  const generatedDemo = selected?.kind === 'generated';
  const subject = framing === 'subject' ? getSubjectFrame(selected?.key) : undefined;
  const [box, setBox] = useState({ width: 0, height: 0 });
  const cropStyle = subject && box.width > 0 && box.height > 0 ? fitSubjectFrame(subject, box.width, box.height) : undefined;
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(Boolean(localImage));
  useEffect(() => {
    setFailed(false);
    setLoaded(Boolean(localImage));
  }, [exercise.id, selected?.key, localImage, remoteUri]);
  const imageSource = !failed ? (localImage || (remoteAvailable ? { uri: remoteUri } : undefined)) : undefined;
  useEffect(() => {
    if (localImage || !remoteAvailable || loaded || failed) return;
    const timer = setTimeout(() => setFailed(true), 4500);
    return () => clearTimeout(timer);
  }, [localImage, remoteAvailable, loaded, failed, exercise.id, remoteUri]);
  const imageVisible = Boolean(imageSource && (localImage || loaded));
  const schematic = !imageVisible && hasSupportIllustration(exercise.id);

  return <View style={[styles.photo, style]} onLayout={event => {
    const { width, height } = event.nativeEvent.layout;
    setBox(previous => previous.width === width && previous.height === height ? previous : { width, height });
  }}>
    {schematic ? <SupportIllustration id={exercise.id} compact={compact} /> : !imageVisible ? <View style={styles.photoMissing}><Text style={[styles.photoMissingIcon, compact && styles.photoMissingIconCompact]}>↗</Text><Text style={[styles.photoMissingText, compact && styles.photoMissingTextCompact]}>{artwork.missingReason ? '配图待补' : imageSource ? '加载配图中' : compact ? '暂无配图' : '图片暂不可用，请按文字指导练习'}</Text></View> : null}
    {imageSource ? <Image accessibilityLabel={exercise.name + '动作配图'} source={imageSource} style={[styles.photoImage, cropStyle && { position: 'absolute', right: undefined, bottom: undefined, ...cropStyle }, !imageVisible && styles.photoImagePending]} resizeMode={cropStyle || generatedDemo ? 'contain' : resizeMode} onLoad={(event) => {
      setLoaded(true);
      const dimensions = loadedImageDimensions(event, selectedSource);
      if (dimensions && selected) imageSizes.set(selected.key, dimensions);
      if (onDimensions && dimensions) onDimensions(subject ? subject.sourceWidth * subject.width : dimensions.width, subject ? subject.sourceHeight * subject.height : dimensions.height);
    }} onError={() => setFailed(true)} /> : null}
    {showShade && imageVisible ? <View style={styles.photoShade} /> : null}
    {imageVisible && !generatedDemo && showTag ? <View style={styles.photoTag}><Text style={styles.photoTagText}>{selected?.kind === 'original' ? '原文配图' : '参考图'}</Text></View> : null}
    {schematic && showTag ? <View style={styles.photoTag}><Text style={styles.photoTagText}>动作示意 · 非原文照片</Text></View> : null}
  </View>;
}

/** Natural-ratio viewport for cards; only reviewed background is removed. */
export function ExerciseMedia({ exercise, width = '100%', minHeight = 52, maxHeight = 240, framing = 'subject', style, testID }: {
  exercise: Exercise; width?: number | '100%'; minHeight?: number; maxHeight?: number; framing?: 'subject' | 'full'; style?: StyleProp<ViewStyle>; testID?: string;
}) {
  const frame = getExerciseArtwork(exercise).cover;
  const subject = framing === 'subject' ? getSubjectFrame(frame?.key) : undefined;
  const source = frame?.source;
  const asset = source && typeof source === 'object' && !Array.isArray(source) && source.width && source.height ? { width: source.width, height: source.height } : undefined;
  const initialRatio = photoAspect((frame && imageSizes.get(frame.key)) || asset, subject);
  const [ratio, setRatio] = useState(initialRatio);
  const [measured, setMeasured] = useState(typeof width === 'number' ? width : 0);
  useEffect(() => setRatio(initialRatio), [exercise.id, frame?.key, initialRatio]);
  const height = Math.max(minHeight, Math.min(maxHeight, (measured || (typeof width === 'number' ? width : 280)) / ratio));
  return <View testID={testID} style={[styles.media, { width, height }, style]} onLayout={event => setMeasured(previous => Math.abs(previous - event.nativeEvent.layout.width) < .5 ? previous : event.nativeEvent.layout.width)}>
    <ExercisePhoto exercise={exercise} framing={framing} resizeMode="contain" showShade={false} showTag={false} compact={maxHeight < 150} onDimensions={(imageWidth, imageHeight) => setRatio(previous => Math.abs(previous - imageWidth / imageHeight) < .001 ? previous : imageWidth / imageHeight)} />
  </View>;
}

export function ExerciseDetailedGuide({ exercise, initialTab = 'summary' }: { exercise: Exercise; initialTab?: 'summary' | 'original' }) {
  const [tab, setTab] = useState<'summary' | 'original'>(initialTab);
  const resource = getOriginalResource(exercise.id);
  const supplementalDemo = exercise.id === 'aux_singleLegCalf' || exercise.id === 'neck_handResistance' ? getExerciseArtwork(exercise).cover : undefined;
  const points = (exercise.keyPoints || []).filter(Boolean);
  const issues = (exercise.commonIssues || []).filter((issue) => issue.problem && issue.fix);
  const standards = Object.entries(exercise.standards || {}).filter(([, value]) => Boolean(value));

  return <View>
    {supplementalDemo ? <View style={styles.demoGuide}>
      <Image source={supplementalDemo.source} style={styles.demoGuideImage} resizeMode="contain" />
      <View style={styles.demoGuideCopy}><Text style={styles.sourceKind}>{exercise.id === 'aux_singleLegCalf' ? '扶稳 · 慢起慢落' : '轻阻力 · 小幅活动'}</Text>
        <Text style={styles.body}>{exercise.id === 'aux_singleLegCalf' ? '前脚掌推地、脚跟抬起，再缓慢落回地面。左右交替，记录两侧合计次数。' : '双手轻放脑后，小幅点头再回正。图片仅示意手位，不代表用力大小；保持轻阻力与无痛活动范围。'}</Text>
      </View>
    </View> : null}
    <View style={styles.tabs}>
      <Pressable accessibilityRole="tab" accessibilityState={{ selected: tab === 'summary' }} onPress={() => setTab('summary')} style={[styles.tab, tab === 'summary' && styles.tabActive]}><Text style={[styles.tabText, tab === 'summary' && styles.tabTextActive]}>速览指导</Text></Pressable>
      <Pressable accessibilityRole="tab" accessibilityState={{ selected: tab === 'original' }} onPress={() => setTab('original')} style={[styles.tab, tab === 'original' && styles.tabActive]}><Text style={[styles.tabText, tab === 'original' && styles.tabTextActive]}>资料原文与配图</Text></Pressable>
    </View>

    {tab === 'summary' ? <View>
      {exercise.source ? <View style={styles.sourceInfo}><Text style={styles.sourceKind}>动作来源</Text><Text style={styles.body}>{exercise.source}</Text></View> : null}
      {exercise.purpose ? <View style={styles.purpose}><Text style={styles.sectionLabel}>训练目的</Text><Text style={styles.body}>{exercise.purpose}</Text></View> : null}
      {points.length ? <View style={styles.guideSection}><Text style={styles.sectionTitle}>动作要点</Text>{points.map((point, index) => <View key={index} style={styles.quickRow}><Text style={styles.quickNum}>{String(index + 1).padStart(2, '0')}</Text><Text style={styles.quickText}>{point}</Text></View>)}</View> : null}
      {issues.length ? <View style={styles.guideSection}><Text style={styles.sectionTitle}>易错与纠正</Text>{issues.map((issue, index) => <View key={index} style={styles.quickIssue}><Text style={styles.issueTitle}>{issue.problem}</Text><Text style={styles.issueFix}>{issue.fix}</Text></View>)}</View> : null}
      {standards.length ? <View style={styles.guideSection}><Text style={styles.sectionTitle}>进阶参考标准</Text>{standards.map(([name, value]) => <View key={name} style={styles.standardRow}><Text style={styles.standardName}>{standardName(name)}</Text><Text style={styles.standardValue}>{value}</Text></View>)}</View> : null}
    </View> : <View>
      {resource ? <>
        <View style={[styles.sourceInfo, resource.kind === 'mini_program' && styles.supplementInfo]}>
          <Text style={styles.sourceKind}>{resource.kind === 'book' ? resource.scope === 'chapter' ? '关联章节原文' : '书籍动作原文' : '小程序补充资料 · 未在所指书籍章节核实'}</Text>
          <Text style={styles.sourceTitle}>{resource.title}</Text>
          {resource.sourceFile && resource.kind === 'book' ? <Text style={styles.sourcePath}>{resource.sourceFile.replace(/\.md$/, '').split('/').map((part) => part.replace(/^\d+_/, '').replaceAll('_', ' · ')).join(' / ')}</Text> : null}
        </View>
        <SourceMarkdown markdown={resource.markdown} />
        {exercise.id === 'neck_handResistance' ? <View style={styles.missingNotice}><Text style={styles.missingNoticeTitle}>原书未配图</Text><Text style={styles.missingNoticeText}>上方为应用生成的补充演示，不属于书籍原图或真人实拍。原书热身次数与本应用的初始训练量分别展示。</Text></View> : null}
        {resource.missingImageNames?.length ? <View style={styles.missingNotice}><Text style={styles.missingNoticeTitle}>原图未收录</Text><Text style={styles.missingNoticeText}>当前本地资料没有这幅图。上方参考图如有显示，不代表该动作的书籍原图。</Text></View> : null}
      </> : <Text style={styles.noSource}>{exercise.source?.startsWith('应用') ? `${exercise.source}。请查看速览中的应用指导，不将其视为书籍原文。` : '这项动作暂无可核对的原文资料。'}</Text>}
    </View>}
  </View>;
}

function SourceMarkdown({ markdown }: { markdown: string }) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  return <View style={styles.sourceBody}>{lines.map((raw, index) => {
    const line = raw.trim();
    if (!line) return null;
    const imageMatch = /^!\[\[([^\]|]+)(?:\|[^\]]*)?\]\]$/.exec(line);
    if (imageMatch) {
      const source = getOriginalImage(imageMatch[1]);
      return source ? <OriginalFigure key={index} source={source} /> : <View key={index} style={styles.figureMissing}><Text style={styles.figureMissingText}>原图未收录</Text></View>;
    }
    const heading = /^(#{2,5})\s+(.+)$/.exec(line);
    if (heading) return <Text key={index} style={[styles.markdownHeading, heading[1].length >= 4 && styles.markdownSubheading]}>{heading[2]}</Text>;
    if (/^图\d+[\s　]/.test(line)) return <Text key={index} style={styles.caption}>{line}</Text>;
    if (line.startsWith('|') && line.endsWith('|')) {
      const cells = line.slice(1, -1).split('|').map((cell) => cell.trim());
      if (cells.every((cell) => /^:?-{3,}:?$/.test(cell))) return null;
      return <View key={index} style={styles.tableRow}>{cells.map((cell, cellIndex) => {
        const cellImage = /^!\[\[([^\]|]+)(?:\|[^\]]*)?\]\]$/.exec(cell);
        const source = cellImage ? getOriginalImage(cellImage[1]) : undefined;
        return <View key={cellIndex} style={styles.tableCell}>{cellImage ? source ? <OriginalFigure source={source} table /> : <Text style={styles.tableText}>原图未收录</Text> : <Text style={styles.tableText}><InlineText value={cell} /></Text>}</View>;
      })}</View>;
    }
    if (/^[-•]\s+/.test(line)) return <View key={index} style={styles.bulletRow}><Text style={styles.bulletMark}>•</Text><Text style={styles.markdownText}><InlineText value={line.replace(/^[-•]\s+/, '')} /></Text></View>;
    return <Text key={index} style={styles.markdownText}><InlineText value={line} /></Text>;
  })}</View>;
}

function OriginalFigure({ source, table = false }: { source: NonNullable<ReturnType<typeof getOriginalImage>>; table?: boolean }) {
  const [width, setWidth] = useState(0);
  const [ratio, setRatio] = useState(4 / 3);
  return <View style={[styles.figure, { height: Math.max(table ? 80 : 100, Math.min(table ? 220 : 400, (width || 240) / ratio)) }]} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
    <Image source={source} style={styles.figureImage} resizeMode="contain" onLoad={event => { const size = loadedImageDimensions(event, source); if (size) setRatio(size.width / size.height); }} />
  </View>;
}

function InlineText({ value }: { value: string }) {
  return <>{value.split(/(\*\*[^*]+\*\*)/g).map((part, index) => part.startsWith('**') && part.endsWith('**') ? <Text key={index} style={styles.inlineBold}>{part.slice(2, -2)}</Text> : <React.Fragment key={index}>{part}</React.Fragment>)}</>;
}

function standardName(key: string) {
  return ({ beginner: '初级', intermediate: '中级', upgrade: '升级', elite: '精英' } as Record<string, string>)[key] || key;
}

const styles = StyleSheet.create({
  media: { position: 'relative', overflow: 'hidden', borderRadius: 12, backgroundColor: '#171C22', flexShrink: 0 },
  demoGuide: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, backgroundColor: appPalette.raised, borderRadius: radius.md, marginBottom: 12 },
  demoGuideImage: { width: 108, height: 144, borderRadius: 8 },
  demoGuideCopy: { flex: 1, minWidth: 0 },
  photo: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, overflow: 'hidden', backgroundColor: '#171C22' },
  photoImage: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
  photoImagePending: { opacity: 0 },
  photoShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(13,15,11,0.52)' },
  photoMissing: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  photoMissingIcon: { color: '#A8D258', fontSize: 54, opacity: 0.45 },
  photoMissingText: { color: '#D4DBCA', fontSize: 11 },
  photoMissingIconCompact: { fontSize: 23 },
  photoMissingTextCompact: { fontSize: 9, textAlign: 'center' },
  photoTag: { position: 'absolute', right: 10, top: 10, backgroundColor: 'rgba(10,12,9,0.82)', borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 5 },
  photoTagText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  issueTitle: { color: colors.ink, fontSize: 12, fontWeight: '900' },
  issueFix: { color: colors.inkMuted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  tabs: { flexDirection: 'row', backgroundColor: appPalette.card, borderRadius: radius.pill, padding: 4, marginTop: 5, marginBottom: 15 },
  tab: { flex: 1, minHeight: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  tabActive: { backgroundColor: appPalette.raised },
  tabText: { color: colors.inkMuted, fontSize: 11, fontWeight: '800' },
  tabTextActive: { color: colors.ink },
  purpose: { backgroundColor: appPalette.olive, borderRadius: radius.md, padding: 13 },
  sectionLabel: { color: colors.green, fontSize: 11, fontWeight: '900' },
  body: { color: colors.ink, fontSize: 12, lineHeight: 19, marginTop: 5 },
  guideSection: { marginTop: 17 },
  sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: '900', marginBottom: 9 },
  quickRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  quickNum: { color: colors.limeDark, fontSize: 11, fontWeight: '900', width: 29 },
  quickText: { flex: 1, color: colors.ink, fontSize: 12, lineHeight: 19 },
  quickIssue: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, padding: 11, marginBottom: 7 },
  standardRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  standardName: { color: colors.green, fontSize: 11, fontWeight: '900', width: 48 },
  standardValue: { color: colors.ink, fontSize: 11, lineHeight: 17, flex: 1 },
  sourceInfo: { backgroundColor: appPalette.olive, borderRadius: radius.md, padding: 13, marginBottom: 9 },
  supplementInfo: { backgroundColor: appPalette.warningBackground },
  sourceKind: { color: colors.green, fontSize: 10, fontWeight: '900' },
  sourceTitle: { color: colors.ink, fontSize: 14, fontWeight: '900', marginTop: 4 },
  sourcePath: { color: colors.inkMuted, fontSize: 10, lineHeight: 16, marginTop: 5 },
  sourceBody: { paddingBottom: 8 },
  markdownHeading: { color: colors.ink, fontSize: 18, lineHeight: 25, fontWeight: '900', marginTop: 17, marginBottom: 8 },
  markdownSubheading: { color: colors.green, fontSize: 14, lineHeight: 21, marginTop: 15 },
  markdownText: { color: colors.ink, fontSize: 12, lineHeight: 21, marginBottom: 9 },
  inlineBold: { fontWeight: '900' },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 },
  bulletMark: { color: colors.green, width: 16, fontSize: 13, fontWeight: '900' },
  caption: { color: colors.inkMuted, fontSize: 11, lineHeight: 17, marginTop: -4, marginBottom: 12, textAlign: 'center' },
  figure: { backgroundColor: appPalette.card, borderRadius: radius.sm, marginTop: 8, marginBottom: 8, overflow: 'hidden' },
  figureImage: { width: '100%', height: '100%' },
  figureMissing: { minHeight: 80, justifyContent: 'center', alignItems: 'center' },
  figureMissingText: { color: colors.inkMuted, fontSize: 11 },
  tableRow: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, marginBottom: 5 },
  tableCell: { flex: 1, padding: 4, minWidth: 0 },
  tableText: { color: colors.inkMuted, fontSize: 10, lineHeight: 16 },
  missingNotice: { backgroundColor: appPalette.warningBackground, borderRadius: radius.sm, padding: 12, marginTop: 9 },
  missingNoticeTitle: { color: colors.ink, fontSize: 11, fontWeight: '900' },
  missingNoticeText: { color: colors.inkMuted, fontSize: 11, lineHeight: 17, marginTop: 4 },
  noSource: { color: colors.inkMuted, fontSize: 12, lineHeight: 19 },
});
