import { FlatList, Modal, Pressable, SafeAreaView, Text, View } from 'react-native';
import { TrainingHistoryDay, LegendDot } from './TrainingHistoryDay';
import { styles as s } from './styles';
import { useTrainingRecords, type RecordsProps } from './useTrainingRecords';

export function TrainingRecords(props: RecordsProps) {
  const model = useTrainingRecords(props);
  const { calendarDate, grid, monthDays, monthOffset, setMonthOffset, selectDate, latest, allGroups, allOpen, setAllOpen, openAll, selectedDate, setSelectedDate, dayGroups, deleteError } = model;
  return <View testID="profile-training-records">
    <View style={s.historyTitleRow}><Text style={s.sectionTitle}>训练日历</Text></View>
    <View style={[s.calendar, { marginTop: 0 }]} testID="profile-training-calendar">
      <View style={s.calendarNav}>
        <Pressable accessibilityRole="button" accessibilityLabel="上一个月" onPress={() => setMonthOffset(value => value - 1)} style={s.calendarNavButton}><Text style={s.calendarArrow}>‹</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="回到本月训练日历" onPress={() => setMonthOffset(0)} style={s.calendarTitleButton}><Text style={s.calendarTitle} testID="training-calendar-month">{calendarDate.getFullYear()}年{calendarDate.getMonth() + 1}月</Text><Text style={s.caption}>{monthDays} 天有训练</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="下一个月" disabled={monthOffset >= 0} onPress={() => setMonthOffset(value => Math.min(0, value + 1))} style={[s.calendarNavButton, monthOffset >= 0 && s.disabled]}><Text style={s.calendarArrow}>›</Text></Pressable>
      </View>
      <View style={s.calendarWeekRow}>{['一', '二', '三', '四', '五', '六', '日'].map(label => <Text key={label} style={s.calendarWeekLabel}>{label}</Text>)}</View>
      <View style={s.calendarGrid}>{grid.map((cell, index) => cell ? <Pressable key={cell.key} accessibilityRole="button" accessibilityLabel={'查看' + cell.key + '训练记录'} accessibilityState={{ selected: selectedDate === cell.key }} onPress={() => selectDate(cell.key)} style={[s.calendarCell, cell.isToday && s.calendarToday, selectedDate === cell.key && s.calendarSelected]}>
        <Text style={[s.calendarDay, cell.isToday && s.green, selectedDate === cell.key && s.selectedDay]}>{cell.day}</Text><View style={[s.calendarDot, cell.state === 'complete' && s.completeDot, cell.state === 'partial' && s.partialDot]} />
      </Pressable> : <View key={'blank-' + index} style={s.calendarCell} />)}</View>
      <View style={s.legendRow}><LegendDot complete label="完成" /><LegendDot label="部分完成" /><Text style={s.caption}>点日期查看记录</Text></View>
    </View>
    <View style={s.historyTitleRow}><Text style={s.sectionTitle}>训练历史</Text><Pressable accessibilityRole="button" accessibilityLabel="查看全部训练历史" onPress={openAll} style={s.clearButton}><Text style={s.clearText}>查看全部 ›</Text></Pressable></View>
    {deleteError && !allOpen ? <Text accessibilityRole="alert" style={s.error}>{deleteError}</Text> : null}
    {!allOpen ? <View testID="profile-latest-history">{latest ? <TrainingHistoryDay day={latest} model={model} /> : <View style={s.emptyCard}><Text style={s.emptyTitle}>还没有训练历史</Text><Text style={s.emptyBody}>完成训练或保存跑步后，会在这里显示最新记录。</Text></View>}</View> : null}
    <Modal visible={allOpen} animationType="slide" onRequestClose={() => setAllOpen(false)}>
      <SafeAreaView style={s.root} testID="all-training-history">
        <View style={[s.sheetHeader, { paddingTop: 12 }]}><Text style={s.sheetTitle}>{selectedDate ? selectedDate + ' 记录' : '全部训练历史'}</Text><Pressable accessibilityRole="button" accessibilityLabel="关闭全部训练历史" onPress={() => setAllOpen(false)} style={s.close}><Text style={s.closeText}>×</Text></Pressable></View>
        {selectedDate ? <Pressable accessibilityRole="button" accessibilityLabel="显示所有训练日期" onPress={() => setSelectedDate(null)} style={s.clearButton}><Text style={s.clearText}>全部记录 · {allGroups.length} 个训练日</Text></Pressable> : null}
        {deleteError ? <Text accessibilityRole="alert" style={s.error}>{deleteError}</Text> : null}
        <FlatList testID="training-history-list" data={dayGroups} keyExtractor={day => day.key} showsVerticalScrollIndicator={false} contentContainerStyle={[s.content, { paddingBottom: 24 }]} initialNumToRender={6} maxToRenderPerBatch={6} windowSize={7} extraData={[model.expandedDay, model.detailsDay, model.expandedSession, model.deleting]} renderItem={({ item }) => <TrainingHistoryDay day={item} model={model} />} ListEmptyComponent={<View style={s.emptyCard}><Text style={s.emptyTitle}>这天没有有效训练记录</Text></View>} />
      </SafeAreaView>
    </Modal>
  </View>;
}
