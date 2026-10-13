# Shizuku constructs this class reflectively in its authorized shell process.
-keep class uncover.music.MusicDisplayService { public <init>(android.content.Context); }
-keep class uncover.music.IMusicDisplay$Stub { *; }
