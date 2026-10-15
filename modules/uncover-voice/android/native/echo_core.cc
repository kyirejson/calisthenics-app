#include "echo_core.h"
#include "audio_float_scope.h"
#include <algorithm>
#include <array>
#include <cmath>
#include <cstring>
#include <deque>
#include <memory>
#include <new>
#include "api/echo_canceller3_config.h"
#include "api/echo_canceller3_factory.h"
#include "api/environment.h"
#include "audio_processing/audio_buffer.h"

// Local WebRTC AEC3 only: no RTC transport, account, service or microphone upload.
// AEC3 consumes 10 ms. ASR/VAD consumes 32 ms. A fixed 10 ms FIFO bridges the
// two without periodically dropping samples, inserting gaps or drifting clocks.
struct BlackEcho {
  static constexpr int block = 160;
  int frame;
  webrtc::Environment environment;
  std::unique_ptr<webrtc::EchoControl> echo;
  webrtc::AudioBuffer render{16000, 1, 16000, 1, 16000, 1};
  webrtc::AudioBuffer capture{16000, 1, 16000, 1, 16000, 1};
  webrtc::AudioBuffer linear{16000, 1, 16000, 1, 16000, 1};
  std::array<int16_t, block> mic{}, far{};
  int pending = 0;
  std::deque<int16_t> output = std::deque<int16_t>(block, 0);
  // Separate acoustic ownership evidence from the ASR/VAD confidence. A tiny
  // speech-shaped residual is still "speech" to VAD. It is not necessarily a person.
  std::array<float, 16384> history{};
  double history_power = 0;
  int locked_delay = -1;
  explicit BlackEcho(int size) : frame(size) {
    webrtc::EchoCanceller3Config config;
    config.filter.export_linear_aec_output = true;
    echo = webrtc::EchoCanceller3Factory(config).Create(environment, 16000, 1, 1);
  }
};
static float render_coherence(BlackEcho *state, const int16_t *captured, const int16_t *rendered) {
  const int tail = state->history.size() - state->frame;
  for (int i = 0; i < state->frame; ++i) state->history_power -= state->history[i] * state->history[i];
  std::memmove(state->history.data(), state->history.data() + state->frame, tail * sizeof(float));
  for (int i = 0; i < state->frame; ++i) {
    float value = rendered[i] / 32768.f;
    state->history[tail + i] = value; state->history_power += value * value;
  }
  if (state->history_power < 1e-8) { state->locked_delay = -1; return 0; }
  float mic_power = 0;
  for (int i = 0; i < state->frame; i += 2) mic_power += std::pow(captured[i] / 32768.f, 2);
  if (mic_power < 1e-9f) return 1;
  float best = 0; int best_delay = 0;
  // Half-rate search plus a one-sample refinement. No transcript matching or
  // voice/sex identity assumption: two people with the same voice remain separate.
  auto score = [&](int delay) {
    float cross = 0, power = 0;
    const float *ref = state->history.data() + tail - delay;
    for (int i = 0; i < state->frame; i += 2) { cross += captured[i] / 32768.f * ref[i]; power += ref[i] * ref[i]; }
    return power > 1e-9f ? std::abs(cross) / std::sqrt(mic_power * power) : 0;
  };
  if (state->locked_delay >= 0) {
    for (int delay = std::max(0, state->locked_delay - 8); delay <= std::min(tail, state->locked_delay + 8); ++delay) {
      float value = score(delay); if (value > best) { best = value; best_delay = delay; }
    }
  }
  if (best < .85f) for (int delay = 0; delay <= std::min(tail, 8192); delay += 2) {
    float value = score(delay); if (value > best) { best = value; best_delay = delay; }
  }
  if (best >= .85f) state->locked_delay = best_delay;
  for (int delay : {best_delay - 1, best_delay + 1}) {
    if (delay < 0 || delay > tail) continue;
    float cross = 0, power = 0;
    const float *ref = state->history.data() + tail - delay;
    for (int i = 0; i < state->frame; i += 2) { cross += captured[i] / 32768.f * ref[i]; power += ref[i] * ref[i]; }
    if (power > 1e-9f) best = std::max(best, std::abs(cross) / std::sqrt(mic_power * power));
  }
  return best;
}
BlackEcho *black_echo_create(int frame) {
  if (frame <= 0 || frame > 8192) return nullptr;
  try { return new BlackEcho(frame); } catch (...) { return nullptr; }
}
int black_echo_frame_size(BlackEcho *state) { return state ? state->frame : 0; }
void black_echo_process(BlackEcho *state, const int16_t *captured, const int16_t *rendered, int16_t *output) {
  AudioFloatScope floating_point_scope;
  float coherence = render_coherence(state, captured, rendered);
  // A strongly coherent waveform is our loudspeaker, even if clipped or quiet.
  const bool independent_capture = coherence < .85f;
  for (int i = 0; i < state->frame; ++i) {
    state->mic[state->pending] = captured[i]; state->far[state->pending++] = rendered[i];
    if (state->pending == BlackEcho::block) {
      // WebRTC AudioBuffer uses FloatS16 (not normalized floats).
      for (int j = 0; j < BlackEcho::block; ++j) {
        state->render.channels()[0][j] = state->far[j];
        state->capture.channels()[0][j] = state->mic[j];
      }
      state->echo->AnalyzeRender(&state->render);
      state->echo->AnalyzeCapture(&state->capture);
      state->echo->ProcessCapture(&state->capture, &state->linear, false);
      for (int j = 0; j < BlackEcho::block; ++j)
        state->output.push_back(static_cast<int16_t>(std::clamp(state->linear.channels_const()[0][j], -32768.f, 32767.f)));
      state->pending = 0;
    }
  }
  for (int i = 0; i < state->frame; ++i) {
    output[i] = independent_capture ? state->output.front() : 0; state->output.pop_front();
  }
}
void black_echo_release(BlackEcho *state) { delete state; }
