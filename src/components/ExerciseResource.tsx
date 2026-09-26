import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Card, SectionTitle } from './ui';
import { getOriginalActionImage, getOriginalImage, getOriginalResource } from '../data/originalResources';
import { getSkillImage } from '../data/skillsImages';
import { getDemonImage } from '../data/demonImages';
import { colors, radius } from '../theme';
import type { Exercise } from '../types';
import { hasSupportIllustration, SupportIllustration } from './SupportIllustration';

const neckDemo = require('../../assets/training-demos/neck-hand-resistance-single-v2.png');
const calfDemo = require('../../assets/training-demos/single-leg-calf-shoes-single-v2.png');

export function ExercisePhoto({ exercise, resizeMode = 'cover', showShade = true, showTag = true, compact = false, style }: {
  exercise: Exercise;
  resizeMode?: 'cover' | 'contain';
  showShade?: boolean;
  showTag?: boolean;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const skillImage = getSkillImage(exercise.id);
  const demonImage = getDemonImage(exercise.id);
  const originalImage = getOriginalActionImage(exercise.id);
  const calfDemonstration = exercise.id === 'aux_singleLegCalf';
  const generatedDemo = calfDemonstration ? calfDemo : exercise.id === 'neck_handResistance' ? neckDemo : undefined;
  const localImage = generatedDemo || skillImage || demonImage || originalImage;
  const remoteUri = exercise.realImage || exercise.image || '';
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(Boolean(localImage));
  useEffect(() => {
    setFailed(false);
    setLoaded(Boolean(localImage));
  }, [exercise.id, localImage, remoteUri]);
  const remoteAvailable = /^https?:\/\//i.test(remoteUri);
  const imageSource = !failed ? (localImage || (remoteAvailable ? { uri: remoteUri } : undefined)) : undefined;
  useEffect(() => {
    if (localImage || !remoteAvailable || loaded || failed) return;
    const timer = setTimeout(() => setFailed(true), 4500);
    return () => clearTimeout(timer);
  }, [localImage, remoteAvailable, loaded, failed, exercise.id, remoteUri]);
  const imageVisible = Boolean(imageSource && (localImage || loaded));
  const schematic = !imageVisible && hasSupportIllustration(exercise.id);

  return <View style={[styles.photo, generatedDemo && { backgroundColor: '#EEECE7' }, style]}>
    {schematic ? <SupportIllustration id={exercise.id} compact={compact} /> : !imageVisible ? <View style={styles.photoMissing}><Text style={[styles.photoMissingIcon, compact && styles.photoMissingIconCompact]}>{exercise.id === 'neck_handResistance' ? '文' : '↗'}</Text><Text style={[styles.photoMissingText, compact && styles.photoMissingTextCompact]}>{exercise.id === 'neck_handResistance' ? '原书未配图' : imageSource ? '加载配图中' : compact ? '暂无配图' : '图片暂不可用，请按文字指导练习'}</Text></View> : null}
    {imageSource ? <Image source={imageSource} style={[styles.photoImage, !imageVisible && styles.photoImagePending]} resizeMode={generatedDemo ? 'contain' : resizeMode} onLoad={() => setLoaded(true)} onError={() => setFailed(true)} /> : null}
    {showShade && imageVisible ? <View style={styles.photoShade} /> : null}
    {imageVisible && !generatedDemo && showTag ? <View style={styles.photoTag}><Text style={styles.photoTagText}>{skillImage ? (exercise.category === 'auxiliary' ? '动作演示' : '街健演示') : demonImage ? '魔鬼演示' : originalImage ? '原文配图' : '参考图'}</Text></View> : null}
    {schematic && showTag ? <View style={styles.photoTag}><Text style={styles.photoTagText}>动作示意 · 非原文照片</Text></View> : null}
  </View>;
}

export function ExerciseInstructions({ exercise }: { exercise: Exercise }) {
  const points = (exercise.keyPoints || []).filter(Boolean);
  const issues = (exercise.commonIssues || []).filter((issue) => issue.problem && issue.fix);
  return <>
    {points.length ? <><SectionTitle title="动作流程" /><Card>{points.map((point, index) => <View key={`${exercise.id}-step-${index}`} style={[styles.point, index > 0 && styles.spaced]}><View style={styles.number}><Text style={styles.numberText}>{index + 1}</Text></View><Text style={styles.pointText}>{point}</Text></View>)}</Card></> : null}
    {issues.length ? <><SectionTitle title="易错与纠正" /><Card>{issues.map((issue, index) => <View key={`${exercise.id}-issue-${index}`} style={[styles.issue, index > 0 && styles.spaced]}><Text style={styles.issueTitle}>{issue.problem}</Text><Text style={styles.issueFix}>{issue.fix}</Text></View>)}</Card></> : null}
  </>;
}

export function ExerciseDetailedGuide({ exercise }: { exercise: Exercise }) {
  const [tab, setTab] = useState<'summary' | 'original'>('summary');
  const resource = getOriginalResource(exercise.id);
  const points = (exercise.keyPoints || []).filter(Boolean);
  const issues = (exercise.commonIssues || []).filter((issue) => issue.problem && issue.fix);
  const standards = Object.entries(exercise.standards || {}).filter(([, value]) => Boolean(value));

  return <View>
    {exercise.id === 'aux_singleLegCalf' || exercise.id === 'neck_handResistance' ? <View style={styles.demoGuide}>
      <Image source={exercise.id === 'aux_singleLegCalf' ? calfDemo : neckDemo} style={styles.demoGuideImage} resizeMode="contain" />
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
      return <View key={index} style={styles.figure}>{source ? <Image source={source} style={styles.figureImage} resizeMode="contain" /> : <View style={styles.figureMissing}><Text style={styles.figureMissingText}>原图未收录</Text></View>}</View>;
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
        return <View key={cellIndex} style={styles.tableCell}>{cellImage ? source ? <Image source={source} style={styles.tableImage} resizeMode="contain" /> : <Text style={styles.tableText}>原图未收录</Text> : <Text style={styles.tableText}><InlineText value={cell} /></Text>}</View>;
      })}</View>;
    }
    if (/^[-•]\s+/.test(line)) return <View key={index} style={styles.bulletRow}><Text style={styles.bulletMark}>•</Text><Text style={styles.markdownText}><InlineText value={line.replace(/^[-•]\s+/, '')} /></Text></View>;
    return <Text key={index} style={styles.markdownText}><InlineText value={line} /></Text>;
  })}</View>;
}

function InlineText({ value }: { value: string }) {
  return <>{value.split(/(\*\*[^*]+\*\*)/g).map((part, index) => part.startsWith('**') && part.endsWith('**') ? <Text key={index} style={styles.inlineBold}>{part.slice(2, -2)}</Text> : <React.Fragment key={index}>{part}</React.Fragment>)}</>;
}

function standardName(key: string) {
  return ({ beginner: '初级', intermediate: '中级', upgrade: '升级', elite: '精英' } as Record<string, string>)[key] || key;
}

const styles = StyleSheet.create({
  demoGuide: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, backgroundColor: '#EEECE7', borderRadius: radius.md, marginBottom: 12 },
  demoGuideImage: { width: 108, height: 144, borderRadius: 8 },
  demoGuideCopy: { flex: 1, minWidth: 0 },
  photo: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, overflow: 'hidden', backgroundColor: '#161A14' },
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
  point: { flexDirection: 'row', alignItems: 'flex-start' },
  spaced: { marginTop: 13 },
  number: { width: 25, height: 25, borderRadius: 9, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  numberText: { color: colors.ink, fontSize: 11, fontWeight: '900' },
  pointText: { flex: 1, color: colors.ink, fontSize: 12, lineHeight: 19 },
  issue: { backgroundColor: '#F4F5EE', borderRadius: radius.sm, padding: 11 },
  issueTitle: { color: colors.ink, fontSize: 12, fontWeight: '900' },
  issueFix: { color: colors.inkMuted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  tabs: { flexDirection: 'row', backgroundColor: '#EAECE4', borderRadius: radius.pill, padding: 4, marginTop: 5, marginBottom: 15 },
  tab: { flex: 1, minHeight: 34, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  tabActive: { backgroundColor: '#FFFFFF' },
  tabText: { color: colors.inkMuted, fontSize: 11, fontWeight: '800' },
  tabTextActive: { color: colors.ink },
  purpose: { backgroundColor: '#EDF5D8', borderRadius: radius.md, padding: 13 },
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
  sourceInfo: { backgroundColor: '#ECF3DC', borderRadius: radius.md, padding: 13, marginBottom: 9 },
  supplementInfo: { backgroundColor: '#FFF1DA' },
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
  figure: { height: 220, backgroundColor: '#F0F0E9', borderRadius: radius.sm, marginTop: 8, marginBottom: 8, overflow: 'hidden' },
  figureImage: { width: '100%', height: '100%' },
  figureMissing: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  figureMissingText: { color: colors.inkMuted, fontSize: 11 },
  tableRow: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, marginBottom: 5 },
  tableCell: { flex: 1, padding: 4, minWidth: 0 },
  tableImage: { width: '100%', height: 140, backgroundColor: '#F0F0E9', borderRadius: radius.sm },
  tableText: { color: colors.inkMuted, fontSize: 10, lineHeight: 16 },
  missingNotice: { backgroundColor: '#FFF1DA', borderRadius: radius.sm, padding: 12, marginTop: 9 },
  missingNoticeTitle: { color: colors.ink, fontSize: 11, fontWeight: '900' },
  missingNoticeText: { color: colors.inkMuted, fontSize: 11, lineHeight: 17, marginTop: 4 },
  noSource: { color: colors.inkMuted, fontSize: 12, lineHeight: 19 },
});
