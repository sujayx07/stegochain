"""
LSB (Least Significant Bit) Image Steganography Module
=======================================================
Hides secret messages in images by modifying the least significant
bit of each colour channel (R, G, B) in every pixel.

Supported formats: PNG, BMP
Delimiter used to mark end-of-message: #####
"""

from PIL import Image


# ── Constants ────────────────────────────────────────────────────────────────
DELIMITER = "#####"


# ── Public API ───────────────────────────────────────────────────────────────

def embed_message_in_image(image_path: str, message: str, output_path: str) -> str:
    """
    Embed *message* inside the image located at *image_path* using LSB encoding.

    Parameters
    ----------
    image_path  : path to the source image (PNG or BMP)
    message     : the plaintext string to hide
    output_path : where the stego-image will be saved

    Returns
    -------
    output_path (str) on success.

    Raises
    ------
    ValueError  if the message (+ delimiter) is too large for the image.
    """
    img = Image.open(image_path).convert("RGB")
    pixels = list(img.getdata())
    width, height = img.size

    full_message = message + DELIMITER
    binary_message = _str_to_bin(full_message)

    capacity_bits = width * height * 3
    if len(binary_message) > capacity_bits:
        raise ValueError(
            f"Message too large: {len(binary_message)} bits required, "
            f"image capacity is {capacity_bits} bits "
            f"({capacity_bits // 8} chars)."
        )

    bit_index = 0
    new_pixels = []

    for pixel in pixels:
        r, g, b = pixel
        channels = [r, g, b]
        new_channels = []

        for channel in channels:
            if bit_index < len(binary_message):
                # Replace the LSB with the next message bit
                channel = (channel & 0b11111110) | int(binary_message[bit_index])
                bit_index += 1
            new_channels.append(channel)

        new_pixels.append(tuple(new_channels))

    stego_img = Image.new("RGB", (width, height))
    stego_img.putdata(new_pixels)
    stego_img.save(output_path)

    return output_path


def extract_message_from_image(stego_image_path: str) -> str:
    """
    Extract the hidden message from a stego-image.

    Parameters
    ----------
    stego_image_path : path to the stego image

    Returns
    -------
    The extracted message as a string (delimiter stripped).

    Raises
    ------
    ValueError if no hidden message / delimiter is found.
    """
    img = Image.open(stego_image_path).convert("RGB")
    pixels = list(img.getdata())

    bits = []
    for pixel in pixels:
        for channel in pixel:          # R, G, B
            bits.append(channel & 1)   # extract LSB

    # Reconstruct characters 8 bits at a time
    chars = []
    for i in range(0, len(bits) - 7, 8):
        byte = bits[i : i + 8]
        char = chr(int("".join(map(str, byte)), 2))
        chars.append(char)

        # Check for delimiter at end of accumulated string
        current = "".join(chars)
        if current.endswith(DELIMITER):
            return current[: -len(DELIMITER)]

    raise ValueError("No hidden message found in the image (delimiter not detected).")


def get_image_capacity(image_path: str) -> int:
    """
    Return the maximum number of characters that can be hidden in *image_path*.

    Formula: (width × height × 3 channels) / 8 bits per character
    """
    img = Image.open(image_path)
    width, height = img.size
    return (width * height * 3) // 8


# ── Helpers ──────────────────────────────────────────────────────────────────

def _str_to_bin(text: str) -> str:
    """Convert a string to its binary representation (8 bits per character)."""
    return "".join(format(ord(c), "08b") for c in text)
