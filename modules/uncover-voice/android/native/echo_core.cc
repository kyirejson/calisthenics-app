#include "echo_core.h"
#include "echo_observation.h"
#include "audio_float_scope.h"
#include <algorithm>
#include <array>
#include <deque>
#include <cmath>
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
  BlackEchoEvidence evidence{};
  explicit BlackEcho(int size) : frame(size) {
    const webrtc::EchoCanceller3Config config;
    echo = webrtc::EchoCanceller3Factory(config).Create(environment, 16000, 1, 1);
  }
};

// A scoped sink, not global per-device state: synthesis/resampling instances
// cannot overwrite evidence belonging to the recognition worker.
static thread_local BlackEchoEvidence* observation = nullptr;
void black_echo_observe(bool linear_usable, bool saturated, bool dominant_nearend,
                        const float* nearend, const float* residual_echo,
                        const float* noise, std::size_t bins) {
  if (!observation) return;
  auto& result = *observation;
  ++result.blocks;
  result.reliable_blocks += linear_usable;
  result.saturated_blocks += saturated;
  double n = 0, e = 0, floor = 0;
  // Speech band, excluding DC and the extreme high-frequency bins. AEC3's
  // residual estimate includes the acoustic tail; render energy alone does not.
  for (std::size_t k = 2; k < std::min<std::size_t>(bins, 49); ++k) {
    n += nearend[k]; e += residual_echo[k]; floor += noise[k];
  }
  result.nearend_power += n; result.residual_echo_power += e; result.noise_power += floor;
  if (!std::isfinite(n + e + floor) || saturated || !linear_usable) return;
  // Independent speech needs BOTH the suppressor's double-talk state and
  // evidence above residual echo/noise. Merely reducing echo energy is not it.
  if (dominant_nearend && n > 4 * std::max(e, 1.0) && n > 4 * std::max(floor, 1.0))
    ++result.nearend_blocks;
  else if (e >= n * .5)
    ++result.echo_blocks;
}
BlackEcho *black_echo_create(int frame) {
  if (frame <= 0 || frame > 8192) return nullptr;
  try { return new BlackEcho(frame); } catch (...) { return nullptr; }
}
int black_echo_frame_size(BlackEcho *state) { return state ? state->frame : 0; }
void black_echo_process(BlackEcho *state, const int16_t *captured, const int16_t *rendered, int16_t *output) {
  AudioFloatScope floating_point_scope;
  state->evidence = {};
  auto* previous_observation = observation;
  observation = &state->evidence;
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
  observation = previous_observation;
  const auto metrics = state->echo->GetMetrics();
  state->evidence.delay_ms = metrics.delay_ms;
  state->evidence.erle_db = metrics.echo_return_loss_enhancement;
  state->evidence.erl_db = metrics.echo_return_loss;
}
void black_echo_evidence(BlackEcho *state, BlackEchoEvidence *evidence) { *evidence = state->evidence; }
void black_echo_release(BlackEcho *state) { delete state; }
