// Offline generated-fixture acceptance only. Not packaged, exported, or connected to the app microphone.
#include <stdio.h>
#include <stdint.h>
#include <time.h>
#include "echo_core.h"
static double ms(struct timespec begin, struct timespec end) { return (end.tv_sec - begin.tv_sec) * 1000. + (end.tv_nsec - begin.tv_nsec) / 1000000.; }
int main(int argc, char **argv) {
  if (argc != 4) return 2;
  FILE *far = fopen(argv[1], "rb"), *mic = fopen(argv[2], "rb"), *out = fopen(argv[3], "wb");
  if (!far || !mic || !out) return 3;
  BlackEcho *state = black_echo_create(512); if (!state) return 4;
  int16_t rendered[512], captured[512], cleaned[512]; unsigned long frames = 0;
  struct timespec begin, end; clock_gettime(CLOCK_MONOTONIC, &begin);
  double dsp_cpu_ms = 0, max_frame_cpu_ms = 0;
  while (fread(rendered, sizeof(int16_t), 512, far) == 512 && fread(captured, sizeof(int16_t), 512, mic) == 512) {
    struct timespec cpu_begin, cpu_end; clock_gettime(CLOCK_THREAD_CPUTIME_ID, &cpu_begin);
    black_echo_process(state, captured, rendered, cleaned);
    clock_gettime(CLOCK_THREAD_CPUTIME_ID, &cpu_end);
    double cpu_ms = ms(cpu_begin, cpu_end); dsp_cpu_ms += cpu_ms;
    if (cpu_ms > max_frame_cpu_ms) max_frame_cpu_ms = cpu_ms;
    if (fwrite(cleaned, sizeof(int16_t), 512, out) != 512) return 5;
    frames++;
  }
  black_echo_release(state); fclose(far); fclose(mic); fclose(out);
  clock_gettime(CLOCK_MONOTONIC, &end);
  printf("processed_generated_fixture_frames=%lu wall_ms=%.3f dsp_cpu_ms=%.3f max_frame_cpu_ms=%.3f audio_ms=%lu\n", frames, ms(begin, end), dsp_cpu_ms, max_frame_cpu_ms, frames * 32); return 0;
}
