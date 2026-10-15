cmake_minimum_required(VERSION 3.22)
project(uncover_voice_echo LANGUAGES C CXX)
option(BLACK_ECHO_PROBE "Build generated-audio CLI acceptance fixture (never packaged)" OFF)
set(SPEEX_DIR "${CMAKE_CURRENT_SOURCE_DIR}/vendor/speexdsp-1.2.1")
if(NOT EXISTS "${SPEEX_DIR}/libspeexdsp/resample.c")
  message(FATAL_ERROR "Run scripts/prepare-voice-resources.cjs before the native build")
endif()
set(AEC_DIR "${CMAKE_CURRENT_SOURCE_DIR}/vendor/webrtc-aec3/src")
if(NOT EXISTS "${AEC_DIR}/audio_processing/aec3/echo_canceller3.cc")
  message(FATAL_ERROR "Run scripts/prepare-voice-resources.cjs for pinned local AEC3 sources")
endif()
file(GLOB_RECURSE AEC_SRC CONFIGURE_DEPENDS "${AEC_DIR}/*.cc" "${AEC_DIR}/*.c" "${AEC_DIR}/*.cpp")
# Android has its own cpufeatures implementation; compiling the Linux one too
# only fails on ARM, not the x86 emulator.
list(FILTER AEC_SRC EXCLUDE REGEX "/cpu_features_linux\\.c$")
# Configuration is typed in echo_core.cc. No JSON parser or config-file I/O is needed.
list(FILTER AEC_SRC EXCLUDE REGEX "/(jsoncpp/|strings/json\\.cc$|echo_canceller3_config_json\\.cc$)")
if(NOT ANDROID_ABI MATCHES "^x86")
  list(FILTER AEC_SRC EXCLUDE REGEX ".*_(avx2|sse2|sse)\\.cc$")
else()
  foreach(AEC_FILE IN LISTS AEC_SRC)
    if(AEC_FILE MATCHES "_avx2\\.cc$")
      set_source_files_properties("${AEC_FILE}" PROPERTIES COMPILE_OPTIONS "-mavx2;-mfma")
    endif()
  endforeach()
endif()
if(NOT ANDROID_ABI STREQUAL "arm64-v8a")
  list(FILTER AEC_SRC EXCLUDE REGEX ".*_neon\\.cc$")
endif()
add_library(black-echo SHARED echo.c echo_core.cc ${AEC_SRC}
  "${SPEEX_DIR}/libspeexdsp/resample.c"
  "${ANDROID_NDK}/sources/android/cpufeatures/cpu-features.c")
target_compile_features(black-echo PRIVATE cxx_std_20)
target_include_directories(black-echo PRIVATE "${SPEEX_DIR}/include" "${CMAKE_CURRENT_SOURCE_DIR}/include" "${CMAKE_CURRENT_SOURCE_DIR}/include/speex"
  "${AEC_DIR}" "${AEC_DIR}/base"
  "${AEC_DIR}/api" "${AEC_DIR}/base/rtc_base" "${AEC_DIR}/base/system_wrappers/include"
  "${AEC_DIR}/audio_processing" "${AEC_DIR}/audio_processing/aec3" "${AEC_DIR}/audio_processing/resampler"
  "${AEC_DIR}/audio_processing/logging" "${AEC_DIR}/audio_processing/include" "${AEC_DIR}/audio_processing/utility"
  "${AEC_DIR}/rtc_base/experiments" "${AEC_DIR}/common_audio" "${AEC_DIR}/common_audio/third_party/ooura/fft_size_128"
  "${ANDROID_NDK}/sources/android/cpufeatures")
target_compile_definitions(black-echo PRIVATE FLOATING_POINT EXPORT= WEBRTC_ANDROID WEBRTC_LINUX WEBRTC_POSIX)
target_compile_options(black-echo PRIVATE -O2 -fvisibility=hidden)
target_link_libraries(black-echo m log)
target_link_options(black-echo PRIVATE "-Wl,-z,max-page-size=16384")
if(BLACK_ECHO_PROBE)
  # The test CLI links this same core; its C API isn't exported in the app build.
  target_compile_options(black-echo PRIVATE -fvisibility=default)
endif()

if(BLACK_ECHO_PROBE)
  add_executable(black-echo-probe "${CMAKE_CURRENT_SOURCE_DIR}/../../../../scripts/native/voice-echo-probe.c")
  target_include_directories(black-echo-probe PRIVATE "${CMAKE_CURRENT_SOURCE_DIR}")
  target_link_libraries(black-echo-probe black-echo)
endif()
