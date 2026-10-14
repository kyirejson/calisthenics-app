#include "echo_core.h"
#include <stdlib.h>
#include <math.h>
#include <string.h>
#include <speex/speex_echo.h>
#include <speex/speex_preprocess.h>

#define WARM_HISTORY 8192
#define WARM_TAPS 3
struct BlackEcho {
  SpeexEchoState *echo; SpeexPreprocessState *pre; int frame;
  float history[WARM_HISTORY]; int position;
  double render_power;
  int delay[WARM_TAPS]; float gain[WARM_TAPS]; int taps;
};
static float reference_at(BlackEcho *state, int index, int delay) {
  int position = (state->position - state->frame + index - delay + WARM_HISTORY * 2) % WARM_HISTORY;
  return state->history[position];
}
/* Fast coherent room-path bootstrap. Speex's long adaptive filter needs longer than the half-second cue.
 * Learn only from strongly correlated far-end evidence; retain the previous path during double-talk.
 * Subtract the coherent reference, never mute a whole microphone frame or inspect transcript words.
 */
static int find_delay(BlackEcho *state, const float *signal, const int *excluded, int exclusions, float *coherence) {
  int best = -1; float best_score = 0;
  for (int delay = 0; delay <= 4096; delay += 8) {
    int skip = 0;
    for (int tap = 0; tap < exclusions; tap++) if (abs(delay - excluded[tap]) < 16) skip = 1;
    if (skip) continue;
    double cross = 0, mic = 0, ref = 0;
    for (int i = 0; i < state->frame; i += 4) {
      float value = reference_at(state, i, delay);
      cross += signal[i] * value; mic += signal[i] * signal[i]; ref += value * value;
    }
    float score = ref > 1e-8 && mic > 1e-8 ? fabs(cross) / sqrt(mic * ref) : 0;
    if (score > best_score) { best_score = score; best = delay; }
  }
  if (best < 0) { *coherence = 0; return -1; }
  int coarse = best;
  best_score = 0;
  for (int delay = coarse - 7 < 0 ? 0 : coarse - 7; delay <= coarse + 7 && delay <= 4096; delay++) {
    double cross = 0, mic = 0, ref = 0;
    for (int i = 0; i < state->frame; i++) {
      float value = reference_at(state, i, delay);
      cross += signal[i] * value; mic += signal[i] * signal[i]; ref += value * value;
    }
    float score = ref > 1e-8 && mic > 1e-8 ? fabs(cross) / sqrt(mic * ref) : 0;
    if (score > best_score) { best_score = score; best = delay; }
  }
  *coherence = best_score; return best;
}
static int bootstrap(BlackEcho *state, const int16_t *captured, const int16_t *rendered, int16_t *out) {
  for (int i = 0; i < state->frame; i++) {
    state->render_power -= state->history[state->position] * state->history[state->position];
    state->history[state->position] = rendered[i] / 32768.0f;
    state->render_power += state->history[state->position] * state->history[state->position];
    state->position = (state->position + 1) % WARM_HISTORY;
  }
  if (state->render_power < 1e-8) { memcpy(out, captured, state->frame * sizeof(int16_t)); return 0; }
  float work[state->frame];
  for (int i = 0; i < state->frame; i++) work[i] = captured[i] / 32768.0f;
  float confidence; int delays[WARM_TAPS]; float gains[WARM_TAPS]; int taps = 0;
  delays[0] = find_delay(state, work, delays, 0, &confidence);
  if (confidence >= .78f) {
    for (int tap = 0; tap < WARM_TAPS && delays[tap] >= 0; tap++) {
      double cross = 0, power = 0;
      for (int i = 0; i < state->frame; i++) { float ref = reference_at(state, i, delays[tap]); cross += work[i] * ref; power += ref * ref; }
      gains[tap] = power > 1e-8 ? cross / power : 0;
      for (int i = 0; i < state->frame; i++) work[i] -= gains[tap] * reference_at(state, i, delays[tap]);
      taps++;
      if (tap + 1 < WARM_TAPS) {
        delays[tap + 1] = find_delay(state, work, delays, taps, &confidence);
        if (confidence < .5f) break;
      }
    }
    memcpy(state->delay, delays, taps * sizeof(int)); memcpy(state->gain, gains, taps * sizeof(float)); state->taps = taps;
  }
  double original_power = 0, independent_power = 0;
  for (int i = 0; i < state->frame; i++) {
    float value = captured[i] / 32768.0f;
    original_power += value * value;
    for (int tap = 0; tap < state->taps; tap++) value -= state->gain[tap] * reference_at(state, i, state->delay[tap]);
    independent_power += value * value;
    out[i] = (int16_t)fmaxf(-32768, fminf(32767, value * 32768));
  }
  // A voice detector alone cannot tell quiet residual speaker echo from a quiet person.
  // Only reject frames overwhelmingly explained by our own rendered waveform, not all playback-time speech.
  return state->taps > 0 && original_power > 1e-7 && independent_power < original_power * .02;
}
BlackEcho *black_echo_create(int frame) {
  BlackEcho *state = calloc(1, sizeof(BlackEcho));
  if (!state) return NULL;
  state->frame = frame;
  state->echo = speex_echo_state_init(frame, 4096); // 256 ms tail at 16 kHz, not a semantic speech limit.
  state->pre = speex_preprocess_state_init(frame, 16000);
  if (!state->echo || !state->pre) { black_echo_release(state); return NULL; }
  int rate = 16000, denoise = 1, noise = -20, suppress = -40, active = -15;
  speex_echo_ctl(state->echo, SPEEX_ECHO_SET_SAMPLING_RATE, &rate);
  speex_preprocess_ctl(state->pre, SPEEX_PREPROCESS_SET_ECHO_STATE, state->echo);
  speex_preprocess_ctl(state->pre, SPEEX_PREPROCESS_SET_DENOISE, &denoise);
  speex_preprocess_ctl(state->pre, SPEEX_PREPROCESS_SET_NOISE_SUPPRESS, &noise);
  speex_preprocess_ctl(state->pre, SPEEX_PREPROCESS_SET_ECHO_SUPPRESS, &suppress);
  speex_preprocess_ctl(state->pre, SPEEX_PREPROCESS_SET_ECHO_SUPPRESS_ACTIVE, &active);
  return state;
}
int black_echo_frame_size(BlackEcho *state) { return state ? state->frame : 0; }
void black_echo_process(BlackEcho *state, const int16_t *captured, const int16_t *rendered, int16_t *output) {
  int16_t near[state->frame]; int echo_only = bootstrap(state, captured, rendered, near);
  speex_echo_cancellation(state->echo, near, rendered, output);
  speex_preprocess_run(state->pre, output);
  if (echo_only) memset(output, 0, sizeof(int16_t) * state->frame);
}
void black_echo_release(BlackEcho *state) {
  if (!state) return;
  if (state->pre) speex_preprocess_state_destroy(state->pre);
  if (state->echo) speex_echo_state_destroy(state->echo);
  free(state);
}
