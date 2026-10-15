#pragma once
#include <stdint.h>

// Copyright (c) 2021 The WebRTC Project Authors. BSD-3-Clause.
// Adapted scoped FTZ/DAZ handling from rtc_base/denormal_disabler.cc:
// https://webrtc.googlesource.com/src/+/refs/heads/main/rtc_base/denormal_disabler.cc
// Standalone AEC3 bypasses APM's guard. Tiny filter tails otherwise become
// subnormal operations (hundreds of times slower on some CPUs). Restore the
// thread's original FP mode before returning to JNI/ASR or any other caller.
class AudioFloatScope {
#if defined(__i386__) || defined(__x86_64__)
  uint32_t original;
public:
  AudioFloatScope() {
    asm volatile("stmxcsr %0" : "=m"(original));
    const uint32_t value = original | 0x8040;
    asm volatile("ldmxcsr %0" : : "m"(value));
  }
  ~AudioFloatScope() { asm volatile("ldmxcsr %0" : : "m"(original)); }
#elif defined(__aarch64__)
  uint64_t original;
public:
  AudioFloatScope() {
    asm volatile("mrs %0, FPCR" : "=r"(original));
    const uint64_t value = original | (1ULL << 24);
    asm volatile("msr FPCR, %0" : : "r"(value));
  }
  ~AudioFloatScope() { asm volatile("msr FPCR, %0" : : "r"(original)); }
#elif defined(__arm__)
  uint32_t original;
public:
  AudioFloatScope() {
    asm volatile("vmrs %0, FPSCR" : "=r"(original));
    const uint32_t value = original | (1U << 24);
    asm volatile("vmsr FPSCR, %0" : : "r"(value));
  }
  ~AudioFloatScope() { asm volatile("vmsr FPSCR, %0" : : "r"(original)); }
#else
public:
  AudioFloatScope() = default;
#endif
  AudioFloatScope(const AudioFloatScope&) = delete;
  AudioFloatScope& operator=(const AudioFloatScope&) = delete;
};
