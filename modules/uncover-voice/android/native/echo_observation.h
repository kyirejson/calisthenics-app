#pragma once
#include <cstddef>

// Called on the capture thread, without changing AEC3 spectra or gains.
void black_echo_observe(bool linear_usable, bool saturated, bool dominant_nearend,
                        const float* nearend, const float* residual_echo,
                        const float* noise, std::size_t bins);
