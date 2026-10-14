#include <jni.h>
#include <stdint.h>
#include <stdlib.h>
#include <speex/speex_resampler.h>
#include "echo_core.h"

JNIEXPORT jlong JNICALL Java_uncover_voice_VoiceEcho_nativeCreate(JNIEnv *env, jobject self, jint frame) {
  return (jlong)(intptr_t)black_echo_create(frame);
}
JNIEXPORT void JNICALL Java_uncover_voice_VoiceEcho_nativeProcess(JNIEnv *env, jobject self, jlong pointer, jshortArray captured, jshortArray rendered, jshortArray output) {
  BlackEcho *state = (BlackEcho *)(intptr_t)pointer;
  int frame = black_echo_frame_size(state);
  if (!state || (*env)->GetArrayLength(env, captured) != frame || (*env)->GetArrayLength(env, rendered) != frame || (*env)->GetArrayLength(env, output) != frame) return;
  jshort *mic = (*env)->GetShortArrayElements(env, captured, NULL), *ref = (*env)->GetShortArrayElements(env, rendered, NULL), *out = (*env)->GetShortArrayElements(env, output, NULL);
  if (mic && ref && out) black_echo_process(state, mic, ref, out);
  if (mic) (*env)->ReleaseShortArrayElements(env, captured, mic, JNI_ABORT);
  if (ref) (*env)->ReleaseShortArrayElements(env, rendered, ref, JNI_ABORT);
  if (out) (*env)->ReleaseShortArrayElements(env, output, out, 0);
}
JNIEXPORT void JNICALL Java_uncover_voice_VoiceEcho_nativeRelease(JNIEnv *env, jobject self, jlong pointer) {
  BlackEcho *state = (BlackEcho *)(intptr_t)pointer;
  black_echo_release(state);
}
JNIEXPORT jshortArray JNICALL Java_uncover_voice_VoiceEcho_nativeResample(JNIEnv *env, jobject self, jshortArray audio, jint rate) {
  if (rate < 8000 || rate > 192000) return NULL;
  spx_uint32_t inputSize = (*env)->GetArrayLength(env, audio), outputSize = ((uint64_t)inputSize * 16000 + rate - 1) / rate + 64;
  int error = 0; SpeexResamplerState *state = speex_resampler_init(1, rate, 16000, 5, &error);
  if (!state || error) { if (state) speex_resampler_destroy(state); return NULL; }
  jshort *input = (*env)->GetShortArrayElements(env, audio, NULL);
  spx_int16_t *output = calloc(outputSize, sizeof(spx_int16_t));
  jshortArray result = NULL;
  if (input && output) {
    speex_resampler_skip_zeros(state);
    error = speex_resampler_process_int(state, 0, input, &inputSize, output, &outputSize);
    if (!error) { result = (*env)->NewShortArray(env, outputSize); if (result) (*env)->SetShortArrayRegion(env, result, 0, outputSize, output); }
  }
  if (input) (*env)->ReleaseShortArrayElements(env, audio, input, JNI_ABORT);
  free(output); speex_resampler_destroy(state); return result;
}
