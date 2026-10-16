#include <jni.h>
#include <stdint.h>
#include <stdlib.h>
#include <limits.h>
#include <string.h>
#include <speex/speex_resampler.h>
#include "echo_core.h"

JNIEXPORT jlong JNICALL Java_uncover_voice_VoiceEcho_nativeCreate(JNIEnv *env, jobject self, jint frame) {
  return (jlong)(intptr_t)black_echo_create(frame);
}
JNIEXPORT jboolean JNICALL Java_uncover_voice_VoiceEcho_nativeProcess(JNIEnv *env, jobject self, jlong pointer, jshortArray captured, jshortArray rendered, jshortArray output, jdoubleArray evidence) {
  BlackEcho *state = (BlackEcho *)(intptr_t)pointer;
  int frame = black_echo_frame_size(state);
  if (!state || (*env)->GetArrayLength(env, captured) != frame || (*env)->GetArrayLength(env, rendered) != frame || (*env)->GetArrayLength(env, output) != frame || (*env)->GetArrayLength(env, evidence) != 11) return JNI_FALSE;
  jshort *mic = (*env)->GetShortArrayElements(env, captured, NULL), *ref = (*env)->GetShortArrayElements(env, rendered, NULL), *out = (*env)->GetShortArrayElements(env, output, NULL);
  if (mic && ref && out) black_echo_process(state, mic, ref, out);
  if (mic) (*env)->ReleaseShortArrayElements(env, captured, mic, JNI_ABORT);
  if (ref) (*env)->ReleaseShortArrayElements(env, rendered, ref, JNI_ABORT);
  if (out) (*env)->ReleaseShortArrayElements(env, output, out, 0);
  if (!mic || !ref || !out) return JNI_FALSE;
  BlackEchoEvidence observed; black_echo_evidence(state, &observed);
  const jdouble values[11] = {observed.blocks, observed.nearend_blocks, observed.echo_blocks,
    observed.reliable_blocks, observed.saturated_blocks, observed.nearend_power,
    observed.residual_echo_power, observed.noise_power, observed.delay_ms, observed.erle_db, observed.erl_db};
  (*env)->SetDoubleArrayRegion(env, evidence, 0, 11, values);
  return JNI_TRUE;
}
JNIEXPORT void JNICALL Java_uncover_voice_VoiceEcho_nativeRelease(JNIEnv *env, jobject self, jlong pointer) {
  BlackEcho *state = (BlackEcho *)(intptr_t)pointer;
  black_echo_release(state);
}
JNIEXPORT jshortArray JNICALL Java_uncover_voice_VoiceEcho_nativeResample(JNIEnv *env, jobject self, jshortArray audio, jint rate) {
  if (rate < 8000 || rate > 192000) return NULL;
  spx_uint32_t originalSize = (*env)->GetArrayLength(env, audio);
  uint64_t expected = ((uint64_t)originalSize * 16000 + rate - 1) / rate;
  if (expected > INT_MAX) return NULL;
  if (!originalSize) return (*env)->NewShortArray(env, 0);
  int error = 0; SpeexResamplerState *state = speex_resampler_init(1, rate, 16000, 5, &error);
  if (!state || error) { if (state) speex_resampler_destroy(state); return NULL; }
  jshort *input = (*env)->GetShortArrayElements(env, audio, NULL);
  // skip_zeros removes the leading filter latency, but EOF must still flush
  // the corresponding input tail. Keep precisely the original audio duration.
  spx_uint32_t inputSize = originalSize + speex_resampler_get_input_latency(state) + 1;
  spx_uint32_t outputSize = (spx_uint32_t)expected;
  spx_int16_t *padded = calloc(inputSize, sizeof(spx_int16_t));
  spx_int16_t *output = calloc(outputSize, sizeof(spx_int16_t));
  jshortArray result = NULL;
  if (input && padded && output) {
    memcpy(padded, input, originalSize * sizeof(spx_int16_t));
    speex_resampler_skip_zeros(state);
    error = speex_resampler_process_int(state, 0, padded, &inputSize, output, &outputSize);
    if (!error && outputSize == expected) { result = (*env)->NewShortArray(env, outputSize); if (result) (*env)->SetShortArrayRegion(env, result, 0, outputSize, output); }
  }
  if (input) (*env)->ReleaseShortArrayElements(env, audio, input, JNI_ABORT);
  free(padded); free(output); speex_resampler_destroy(state); return result;
}
