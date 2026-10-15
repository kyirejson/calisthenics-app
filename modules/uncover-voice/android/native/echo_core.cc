#include "echo_core.h"
#include "audio_float_scope.h"
#include <algorithm>
#include <array>
#include <deque>
#include <memory>
#include "api/echo_canceller3_config.h"
#include "api/echo_canceller3_factory.h"
#include "api/environment.h"
#include "audio_processing/audio_buffer.h"

// AEC3 consumes 10 ms. The recognizer consumes 32 ms. Preserve every sample
// through the fixed 10 ms FIFO; do not periodically drop or duplicate frames.
struct BlackEcho {
  static constexpr int block = 160;
  int frame;
  webrtc::Environment environment;
  std::unique_ptr<webrtc::EchoControl> echo;
  webrtc::AudioBuffer render{16000, 1, 16000, 1, 16000, 1};
  webrtc::AudioBuffer capture{16000, 1, 16000, 1, 16000, 1};
  std::array<int16_t, block> mic{}, far{};
  int pending = 0;
  std::deque<int16_t> output = std::deque<int16_t>(block, 0);
  explicit BlackEcho(int size) : frame(size) {
    const webrtc::EchoCanceller3Config config;
    echo = webrtc::EchoCanceller3Factory(config).Create(environment, 16000, 1, 1);
  }
};
BlackEcho *black_echo_create(int frame) {
  if (frame <= 0 || frame > 8192) return nullptr;
  try { return new BlackEcho(frame); } catch (...) { return nullptr; }
}
int black_echo_frame_size(BlackEcho *state) { return state ? state->frame : 0; }
void black_echo_process(BlackEcho *state, const int16_t *captured, const int16_t *rendered, int16_t *output) {
  AudioFloatScope floating_point_scope;
  for (int i = 0; i < state->frame; ++i) {
    state->mic[state->pending] = captured[i]; state->far[state->pending++] = rendered[i];
    if (state->pending == BlackEcho::block) {
      // AudioBuffer uses FloatS16, not normalized floats. ProcessCapture mutates
      // capture with the complete AEC3 output (linear cancellation + residual
      // suppression). The optional linear output alone is NOT the ASR signal.
      for (int j = 0; j < BlackEcho::block; ++j) {
        state->render.channels()[0][j] = state->far[j];
        state->capture.channels()[0][j] = state->mic[j];
      }
      state->echo->AnalyzeRender(&state->render);
      state->echo->AnalyzeCapture(&state->capture);
      state->echo->ProcessCapture(&state->capture, false);
      for (int j = 0; j < BlackEcho::block; ++j)
        state->output.push_back(static_cast<int16_t>(std::clamp(state->capture.channels_const()[0][j], -32768.f, 32767.f)));
      state->pending = 0;
    }
  }
  // No waveform-correlation whole-frame mute: loudspeaker and user can speak
  // together. VAD/turn assessment consume the cleaned signal, not raw capture.
  for (int i = 0; i < state->frame; ++i) {
    output[i] = state->output.front(); state->output.pop_front();
  }
}
void black_echo_release(BlackEcho *state) { delete state; }
