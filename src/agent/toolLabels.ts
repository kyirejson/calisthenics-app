export function toolLabel(name: string, args: Record<string, unknown>): string {
  if (name === 'search_knowledge') return `检索知识库${typeof args.query === 'string' ? ` · ${args.query}` : ''}`;
  if (name === 'read_knowledge_note') return `阅读资料 · ${typeof args.path === 'string' ? args.path.split('/').pop()?.replace('.md', '') : '知识库'}`;
  return ({
    read_memory: '读取个人记忆', update_memory: '更新个人记忆', read_today_training: '读取今日训练',
    read_recent_weight: '读取近期体重', read_today_meals: '读取今日饮食', write_meal_records: '处理饮食记录',
    search_web: '搜索互联网', read_web_page: '阅读网页', continue_listening: '继续倾听', end_voice_conversation: '返回唤醒待机',
    read_music_settings: '读取音乐预设', write_music_settings: '保存音乐预设',
    open_music_and_observe: '打开并核实音乐界面', music_ui_action_and_observe: '操作并核实音乐界面',
    control_music_and_observe: '控制并核实音乐播放', open_music: '打开音乐软件',
    read_music_screen: '查看音乐界面', music_ui_action: '操作音乐界面',
    read_phone_status: '检查手机控制', find_apps: '查找手机应用', open_app: '打开应用并观察', read_phone_screen: '查看手机界面',
    phone_ui_action: '操作手机控件', phone_gesture: '执行手机手势', phone_global_action: '操作手机系统',
    control_music: '控制音乐播放', read_music_playback: '核实播放状态',
  } as Record<string, string>)[name] || name;
}
