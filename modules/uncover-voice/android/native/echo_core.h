#pragma once
#include <stdint.h>
#ifdef __cplusplus
extern "C" {
#endif
typedef struct BlackEcho BlackEcho;
BlackEcho *black_echo_create(int frame);
int black_echo_frame_size(BlackEcho *state);
void black_echo_process(BlackEcho *state, const int16_t *captured, const int16_t *rendered, int16_t *output);
void black_echo_release(BlackEcho *state);
#ifdef __cplusplus
}
#endif
