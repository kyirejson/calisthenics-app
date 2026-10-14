// Offline generated-fixture acceptance only. Not packaged, exported, or connected to the app microphone.
#include <stdio.h>
#include <stdint.h>
#include "echo_core.h"
int main(int argc, char **argv) {
  if (argc != 4) return 2;
  FILE *far = fopen(argv[1], "rb"), *mic = fopen(argv[2], "rb"), *out = fopen(argv[3], "wb");
  if (!far || !mic || !out) return 3;
  BlackEcho *state = black_echo_create(512); if (!state) return 4;
  int16_t rendered[512], captured[512], cleaned[512]; unsigned long frames = 0;
  while (fread(rendered, sizeof(int16_t), 512, far) == 512 && fread(captured, sizeof(int16_t), 512, mic) == 512) {
    black_echo_process(state, captured, rendered, cleaned);
    if (fwrite(cleaned, sizeof(int16_t), 512, out) != 512) return 5;
    frames++;
  }
  black_echo_release(state); fclose(far); fclose(mic); fclose(out);
  printf("processed_generated_fixture_frames=%lu\n", frames); return 0;
}
