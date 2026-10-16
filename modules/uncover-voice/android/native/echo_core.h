#pragma once
#include <stdint.h>
#ifdef __cplusplus
extern "C" {
#endif
typedef struct BlackEcho BlackEcho;
typedef struct BlackEchoEvidence {
  int blocks, nearend_blocks, echo_blocks, reliable_blocks, saturated_blocks;
  double nearend_power, residual_echo_power, noise_power;
  double delay_ms, erle_db, erl_db;
} BlackEchoEvidence;
BlackEcho *black_echo_create(int frame);
int black_echo_frame_size(BlackEcho *state);
void black_echo_process(BlackEcho *state, const int16_t *captured, const int16_t *rendered, int16_t *output);
void black_echo_evidence(BlackEcho *state, BlackEchoEvidence *evidence);
void black_echo_release(BlackEcho *state);
#ifdef __cplusplus
}
#endif
