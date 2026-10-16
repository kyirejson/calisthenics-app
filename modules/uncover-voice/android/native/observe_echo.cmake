# A read-only observation point in the pinned AEC3 translation unit. Do not fork
# its DSP, mutate vendor/, or link a second echo remover. Fail closed if upstream
# changes: these observations must come from the spectra used by the suppressor.
set(AEC_REMOVER "${AEC_DIR}/audio_processing/aec3/echo_remover.cc")
file(SHA256 "${AEC_REMOVER}" AEC_REMOVER_SHA)
if(NOT AEC_REMOVER_SHA STREQUAL "50941a5aa5e8e38bf539a94a3f18958ce7c10250284fc704995ebdbba57a1b99")
  message(FATAL_ERROR "AEC3 observation point changed; review the pinned source before building")
endif()
set_property(DIRECTORY APPEND PROPERTY CMAKE_CONFIGURE_DEPENDS "${AEC_REMOVER}")
file(READ "${AEC_REMOVER}" AEC_REMOVER_SOURCE)
string(REPLACE "#include <algorithm>" "#include <algorithm>\n#include \"echo_observation.h\"" AEC_REMOVER_SOURCE "${AEC_REMOVER_SOURCE}")
string(REPLACE "    suppression_filter_.ApplyGain(" [=[
    black_echo_observe(aec_state_.UsableLinearEstimate(),
                       aec_state_.SaturatedCapture() || aec_state_.SaturatedEcho(),
                       suppression_gain_.IsDominantNearend(),
                       nearend_spectrum[0].data(), R2[0].data(),
                       cng_.NoiseSpectrum()[0].data(), kFftLengthBy2Plus1);
    suppression_filter_.ApplyGain(]=] AEC_REMOVER_SOURCE "${AEC_REMOVER_SOURCE}")
set(AEC_OBSERVED_REMOVER "${CMAKE_CURRENT_BINARY_DIR}/echo_remover_observed.cc")
file(CONFIGURE OUTPUT "${AEC_OBSERVED_REMOVER}" CONTENT "${AEC_REMOVER_SOURCE}" @ONLY)
list(REMOVE_ITEM AEC_SRC "${AEC_REMOVER}")
list(APPEND AEC_SRC "${AEC_OBSERVED_REMOVER}")
