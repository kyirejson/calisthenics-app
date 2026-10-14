cmake_minimum_required(VERSION 3.22)
project(uncover_voice_echo LANGUAGES C CXX)
set(SPEEX_DIR "${CMAKE_CURRENT_SOURCE_DIR}/vendor/speexdsp-1.2.1")
if(NOT EXISTS "${SPEEX_DIR}/libspeexdsp/mdf.c")
  message(FATAL_ERROR "Run scripts/prepare-voice-resources.cjs before the native build")
endif()
add_library(black-echo SHARED echo.c echo_core.c
  "${SPEEX_DIR}/libspeexdsp/mdf.c" "${SPEEX_DIR}/libspeexdsp/preprocess.c"
  "${SPEEX_DIR}/libspeexdsp/filterbank.c" "${SPEEX_DIR}/libspeexdsp/fftwrap.c"
  "${SPEEX_DIR}/libspeexdsp/kiss_fft.c" "${SPEEX_DIR}/libspeexdsp/kiss_fftr.c"
  "${SPEEX_DIR}/libspeexdsp/resample.c")
target_include_directories(black-echo PRIVATE "${SPEEX_DIR}/include" "${CMAKE_CURRENT_SOURCE_DIR}/include" "${CMAKE_CURRENT_SOURCE_DIR}/include/speex")
target_compile_definitions(black-echo PRIVATE FLOATING_POINT USE_KISS_FFT EXPORT=)
target_compile_options(black-echo PRIVATE -O2 -fvisibility=hidden)
target_link_libraries(black-echo m)
target_link_options(black-echo PRIVATE "-Wl,-z,max-page-size=16384")
