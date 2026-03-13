#!/usr/bin/env python3
"""Convert the favicon PNG to a 1-bit bitmap array for OLED display"""
from PIL import Image
import sys

def convert_to_bitmap(input_path, output_path, target_size=56):
    img = Image.open(input_path).convert('L')  # grayscale
    img = img.resize((target_size, target_size), Image.LANCZOS)
    # Threshold to 1-bit (invert: black icon on white bg -> white icon on black OLED)
    pixels = []
    for y in range(target_size):
        row = []
        for x in range(target_size):
            # Icon is black on white, we want white on black OLED
            row.append(1 if img.getpixel((x, y)) < 128 else 0)
        pixels.append(row)
    
    # Write as Python list
    with open(output_path, 'w') as f:
        f.write(f"# Auto-generated {target_size}x{target_size} bitmap\n")
        f.write(f"CLAW_SIZE = {target_size}\n")
        f.write("CLAW_BITMAP = [\n")
        for row in pixels:
            f.write(f"    {row},\n")
        f.write("]\n")
    print(f"Written {target_size}x{target_size} bitmap to {output_path}")

if __name__ == '__main__':
    input_path = sys.argv[1] if len(sys.argv) > 1 else '../website/android-chrome-192x192.png'
    convert_to_bitmap(input_path, 'claw_bitmap.py', 56)
