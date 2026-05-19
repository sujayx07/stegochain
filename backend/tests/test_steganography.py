"""
Steganography Test Suite
========================
Tests the LSB image steganography and Echo Hiding audio steganography modules.

Run from the project root:
    python backend/tests/test_steganography.py

No external media files are required — test images and audio are generated
programmatically inside the test functions.
"""

import os
import sys
import wave

import numpy as np
from PIL import Image

# ---------------------------------------------------------------------------
# Ensure the backend package is importable when run directly
# ---------------------------------------------------------------------------
BACKEND_DIR = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, os.path.abspath(BACKEND_DIR))

from modules.steganography.lsb_image import (
    embed_message_in_image,
    extract_message_from_image,
    get_image_capacity,
)
from modules.steganography.echo_audio import (
    embed_message_in_audio,
    extract_message_from_audio,
    get_audio_capacity,
)

# ---------------------------------------------------------------------------
# Test file paths (created and cleaned up inside each test)
# ---------------------------------------------------------------------------
TEST_DIR = os.path.dirname(__file__)
SOURCE_IMAGE = os.path.join(TEST_DIR, "source_test_image.png")
STEGO_IMAGE  = os.path.join(TEST_DIR, "test_stego_image.png")
SOURCE_AUDIO = os.path.join(TEST_DIR, "source_test_audio.wav")
STEGO_AUDIO  = os.path.join(TEST_DIR, "test_stego_audio.wav")

IMAGE_MESSAGE = "StegoChain test message 12345"
AUDIO_MESSAGE = "StegoChain audio test 67890"


# ---------------------------------------------------------------------------
# Helper utilities
# ---------------------------------------------------------------------------

def _create_test_image(path: str, width: int = 100, height: int = 100) -> None:
    """Generate a 100×100 PNG with random RGB pixels."""
    rng = np.random.default_rng(seed=42)
    pixel_data = rng.integers(0, 256, (height, width, 3), dtype=np.uint8)
    img = Image.fromarray(pixel_data, mode="RGB")
    img.save(path)
    print(f"  [setup] Created test image: {path}  ({width}x{height} px)")


def _create_test_audio(path: str, duration_s: float = 3.0, sample_rate: int = 44100) -> None:
    """
    Generate a 3-second, 44100 Hz mono white-noise WAV file.

    White noise (broadband) is the correct carrier for echo-hiding steganography
    because it gives a flat power spectrum, making the echo cepstrum peak
    unambiguous.  A pure sine wave creates periodic cepstrum structure that
    collides with the embedded echo delay.
    """
    rng = np.random.default_rng(seed=42)
    num_samples = int(sample_rate * duration_s)
    noise = (rng.uniform(-1.0, 1.0, num_samples) * 32767).astype(np.int16)

    with wave.open(path, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)       # 16-bit samples
        wf.setframerate(sample_rate)
        wf.writeframes(noise.tobytes())

    print(f"  [setup] Created test audio: {path}  ({duration_s}s @ {sample_rate} Hz, white noise)")


def _cleanup(*paths: str) -> None:
    """Remove temporary test files."""
    for p in paths:
        try:
            os.remove(p)
        except FileNotFoundError:
            pass


# ---------------------------------------------------------------------------
# Image LSB test
# ---------------------------------------------------------------------------

def test_image_lsb() -> bool:
    print("\n--------------------------------------")
    print(" IMAGE LSB STEGANOGRAPHY TEST")
    print("--------------------------------------")

    try:
        # 1. Create a test image
        _create_test_image(SOURCE_IMAGE)

        # 2. Report capacity
        capacity = get_image_capacity(SOURCE_IMAGE)
        print(f"  [info] Image capacity: {capacity} characters")

        # 3. Embed message
        print(f"  [embed] Hiding message: \"{IMAGE_MESSAGE}\"")
        embed_message_in_image(SOURCE_IMAGE, IMAGE_MESSAGE, STEGO_IMAGE)
        print(f"  [embed] Stego image saved -> {STEGO_IMAGE}")

        # 4. Extract message
        extracted = extract_message_from_image(STEGO_IMAGE)
        print(f"  [extract] Recovered message: \"{extracted}\"")

        # 5. Assert correctness
        assert extracted == IMAGE_MESSAGE, (
            f"Mismatch!\n  Expected : {IMAGE_MESSAGE!r}\n  Got      : {extracted!r}"
        )

        print("  [result] PASS - Messages match")
        return True

    except AssertionError as exc:
        print(f"  [result] FAIL - Assertion error\n  {exc}")
        return False
    except Exception as exc:
        print(f"  [result] FAIL - Unexpected error\n  {type(exc).__name__}: {exc}")
        return False
    finally:
        _cleanup(SOURCE_IMAGE, STEGO_IMAGE)
        print("  [cleanup] Temporary files removed.")


# ---------------------------------------------------------------------------
# Audio Echo Hiding test
# ---------------------------------------------------------------------------

def test_audio_echo() -> bool:
    print("\n--------------------------------------")
    print(" AUDIO ECHO HIDING STEGANOGRAPHY TEST")
    print("--------------------------------------")

    try:
        # 1. Create a test WAV file
        _create_test_audio(SOURCE_AUDIO)

        # 2. Report capacity
        capacity = get_audio_capacity(SOURCE_AUDIO)
        print(f"  [info] Audio capacity: {capacity} characters")

        # 3. Embed message
        print(f"  [embed] Hiding message: \"{AUDIO_MESSAGE}\"")
        embed_message_in_audio(SOURCE_AUDIO, AUDIO_MESSAGE, STEGO_AUDIO)
        print(f"  [embed] Stego audio saved -> {STEGO_AUDIO}")

        # 4. Extract message
        extracted = extract_message_from_audio(STEGO_AUDIO)
        print(f"  [extract] Recovered message: \"{extracted}\"")

        # 5. Assert correctness
        assert extracted == AUDIO_MESSAGE, (
            f"Mismatch!\n  Expected : {AUDIO_MESSAGE!r}\n  Got      : {extracted!r}"
        )

        print("  [result] PASS - Messages match")
        return True

    except AssertionError as exc:
        print(f"  [result] FAIL - Assertion error\n  {exc}")
        return False
    except Exception as exc:
        print(f"  [result] FAIL - Unexpected error\n  {type(exc).__name__}: {exc}")
        return False
    finally:
        _cleanup(SOURCE_AUDIO, STEGO_AUDIO)
        print("  [cleanup] Temporary files removed.")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    image_pass = test_image_lsb()
    audio_pass = test_audio_echo()

    print("\n==========================================")
    print("  STEGANOGRAPHY MODULE TEST RESULTS")
    print(f"  Image LSB Test : {'PASS' if image_pass else 'FAIL'}")
    print(f"  Audio Echo Test: {'PASS' if audio_pass else 'FAIL'}")
    print("==========================================\n")

    if not (image_pass and audio_pass):
        sys.exit(1)
