"""
Echo Hiding Audio Steganography Module
=======================================
Hides secret messages inside WAV audio files by adding a low-amplitude
echo with one of two distinct delay values:

    DELAY_ZERO = 50  samples  ->  encodes bit 0
    DELAY_ONE  = 100 samples  ->  encodes bit 1

The audio is split into fixed-size segments (one bit per segment).
Extraction uses the cepstrum (real part of the IFFT of log power spectrum),
which shows a clear peak at the echo lag and is robust against periodic signals.

Supported format: WAV (mono or stereo; mono preferred for accuracy)
Delimiter used to mark end-of-message: #####
"""

import wave

import numpy as np


# ── Constants ────────────────────────────────────────────────────────────────
DELIMITER      = "#####"
DELAY_ZERO     = 37          # samples -> encodes bit 0  (prime, avoids harmonics)
DELAY_ONE      = 73          # samples -> encodes bit 1  (prime, avoids harmonics)
ECHO_AMPLITUDE = 0.5         # relative amplitude of the echo
SEGMENT_SAMPLES = 512        # samples per bit-segment  (must be >> DELAY_ONE)


# ── Public API ───────────────────────────────────────────────────────────────

def embed_message_in_audio(audio_path: str, message: str, output_path: str) -> str:
    """
    Embed *message* inside the WAV file at *audio_path* using echo hiding.

    Parameters
    ----------
    audio_path  : path to the source WAV file
    message     : plaintext string to hide
    output_path : destination path for the stego WAV file

    Returns
    -------
    output_path (str) on success.

    Raises
    ------
    ValueError  if the audio is too short to hold the message.
    """
    samples, params = _read_wav(audio_path)

    full_message = message + DELIMITER
    bits = _str_to_bits(full_message)

    required_samples = len(bits) * SEGMENT_SAMPLES + DELAY_ONE
    if required_samples > len(samples):
        raise ValueError(
            f"Audio too short: need {required_samples} samples, "
            f"have {len(samples)} samples."
        )

    stego = samples.astype(np.float64).copy()

    for i, bit in enumerate(bits):
        start = i * SEGMENT_SAMPLES
        seg_end = start + SEGMENT_SAMPLES
        delay = DELAY_ONE if bit == 1 else DELAY_ZERO

        # Add a decayed copy of the segment shifted by `delay` samples.
        # We write into positions [start+delay .. seg_end+delay] so the echo
        # stays logically inside (or just after) the current segment.
        echo_start = start + delay
        echo_end   = min(seg_end + delay, len(stego))
        src_start  = start
        src_end    = src_start + (echo_end - echo_start)

        stego[echo_start:echo_end] += ECHO_AMPLITUDE * samples[src_start:src_end]

    # Normalise to prevent clipping
    max_val = np.max(np.abs(stego))
    if max_val > 0:
        peak = 2 ** (params.sampwidth * 8 - 1) - 1
        stego = stego / max_val * peak

    _write_wav(output_path, stego.astype(np.int16), params)
    return output_path


def extract_message_from_audio(stego_audio_path: str) -> str:
    """
    Extract the hidden message from a stego WAV file using cepstral analysis.

    Parameters
    ----------
    stego_audio_path : path to the stego WAV file

    Returns
    -------
    The extracted message as a string (delimiter stripped).

    Raises
    ------
    ValueError if the delimiter is never found in the extracted stream.
    """
    samples, _ = _read_wav(stego_audio_path)
    samples = samples.astype(np.float64)

    bits = []
    seg_count = len(samples) // SEGMENT_SAMPLES

    for i in range(seg_count):
        start   = i * SEGMENT_SAMPLES
        segment = samples[start : start + SEGMENT_SAMPLES]
        bits.append(_detect_echo_bit(segment))

        # Check for delimiter after every complete byte
        if len(bits) >= 8 and len(bits) % 8 == 0:
            chars = _bits_to_str(bits)
            if chars.endswith(DELIMITER):
                return chars[: -len(DELIMITER)]

    raise ValueError("No hidden message found in the audio (delimiter not detected).")


def get_audio_capacity(audio_path: str) -> int:
    """
    Return the maximum number of characters that can be hidden in *audio_path*.

    Formula: floor(total_samples / SEGMENT_SAMPLES) / 8
    """
    samples, _ = _read_wav(audio_path)
    max_bits = len(samples) // SEGMENT_SAMPLES
    return max_bits // 8


# ── Helpers ──────────────────────────────────────────────────────────────────

def _read_wav(path: str):
    """Return (numpy int16 array of samples, wave params namedtuple)."""
    with wave.open(path, "rb") as wf:
        params = wf.getparams()
        raw    = wf.readframes(params.nframes)

    dtype   = np.int16 if params.sampwidth == 2 else np.int8
    samples = np.frombuffer(raw, dtype=dtype).copy()   # writeable copy

    # Downmix to mono by taking the left channel
    if params.nchannels == 2:
        samples = samples[::2]

    return samples, params


def _write_wav(path: str, samples: np.ndarray, params):
    """Write mono samples to a WAV file."""
    with wave.open(path, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(params.sampwidth)
        wf.setframerate(params.framerate)
        wf.writeframes(samples.tobytes())


def _str_to_bits(text: str) -> list:
    """Convert a string to a flat list of integer bits (0 or 1)."""
    bits = []
    for c in text:
        bits.extend(int(b) for b in format(ord(c), "08b"))
    return bits


def _bits_to_str(bits: list) -> str:
    """Convert a flat list of bits to a string (8 bits per character)."""
    chars = []
    for i in range(0, len(bits) - 7, 8):
        chars.append(chr(int("".join(map(str, bits[i : i + 8])), 2)))
    return "".join(chars)


def _detect_echo_bit(segment: np.ndarray) -> int:
    """
    Detect whether the echo delay in *segment* is DELAY_ZERO or DELAY_ONE.

    Method: real cepstrum — IFFT of log(|FFT(segment)|^2).
    The cepstrum has a peak at the echo lag.  We compare the magnitudes
    at DELAY_ZERO and DELAY_ONE to decide which delay was embedded.

    Returns 0 or 1.
    """
    # Avoid log(0)
    eps = 1e-10

    # Compute power spectrum then take its log
    spectrum = np.fft.rfft(segment)
    log_pow  = np.log(np.abs(spectrum) ** 2 + eps)

    # Real cepstrum = IFFT of log power spectrum
    cepstrum = np.fft.irfft(log_pow)

    # Compare cepstrum magnitudes at the two candidate delays
    # Use a small window around each delay for robustness
    win = 2
    c0 = np.max(np.abs(cepstrum[max(0, DELAY_ZERO - win) : DELAY_ZERO + win + 1]))
    c1 = np.max(np.abs(cepstrum[max(0, DELAY_ONE  - win) : DELAY_ONE  + win + 1]))

    return 1 if c1 > c0 else 0
