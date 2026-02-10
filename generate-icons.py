#!/usr/bin/env python3
"""Generate PWA icons for Wazn Express"""

from PIL import Image, ImageDraw, ImageFont
import os

# Icon sizes needed for PWA
ICON_SIZES = [16, 32, 72, 96, 120, 128, 144, 152, 180, 192, 384, 512]
SPLASH_SIZES = [(640, 1136), (750, 1334), (1242, 2208)]

OUTPUT_DIR = "/home/ubuntu/wazn-express/client/public/icons"

def create_icon(size):
    """Create a professional icon with gradient background and text"""
    # Create image with gradient background
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Draw rounded rectangle with gradient-like effect
    # Background colors (dark slate to lighter)
    bg_color = (30, 41, 59)  # slate-800
    accent_color = (251, 146, 60)  # orange-400
    
    # Draw background circle/rounded shape
    padding = int(size * 0.08)
    corner_radius = int(size * 0.2)
    
    # Draw main background
    draw.rounded_rectangle(
        [padding, padding, size - padding, size - padding],
        radius=corner_radius,
        fill=bg_color
    )
    
    # Draw accent stripe at bottom
    stripe_height = int(size * 0.15)
    draw.rounded_rectangle(
        [padding, size - padding - stripe_height, size - padding, size - padding],
        radius=corner_radius // 2,
        fill=accent_color
    )
    
    # Draw "W" letter
    try:
        font_size = int(size * 0.45)
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)
    except:
        font = ImageFont.load_default()
    
    text = "W"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    
    x = (size - text_width) // 2
    y = (size - text_height) // 2 - int(size * 0.08)
    
    # Draw text with white color
    draw.text((x, y), text, fill=(255, 255, 255), font=font)
    
    # Draw small package icon below W
    pkg_size = int(size * 0.12)
    pkg_x = size // 2 - pkg_size // 2
    pkg_y = y + text_height + int(size * 0.02)
    
    # Simple package box
    draw.rectangle(
        [pkg_x, pkg_y, pkg_x + pkg_size, pkg_y + pkg_size],
        outline=(255, 255, 255),
        width=max(1, int(size * 0.02))
    )
    
    return img

def create_splash(width, height):
    """Create splash screen"""
    img = Image.new('RGB', (width, height), (30, 41, 59))
    draw = ImageDraw.Draw(img)
    
    # Draw logo in center
    logo_size = min(width, height) // 3
    logo = create_icon(logo_size)
    
    x = (width - logo_size) // 2
    y = (height - logo_size) // 2 - height // 10
    
    img.paste(logo, (x, y), logo)
    
    # Draw company name
    try:
        font_size = logo_size // 4
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)
    except:
        font = ImageFont.load_default()
    
    text = "Wazn Express"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    
    draw.text(
        ((width - text_width) // 2, y + logo_size + height // 20),
        text,
        fill=(255, 255, 255),
        font=font
    )
    
    return img

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    # Generate icons
    for size in ICON_SIZES:
        icon = create_icon(size)
        icon.save(f"{OUTPUT_DIR}/icon-{size}x{size}.png", "PNG")
        print(f"Created icon-{size}x{size}.png")
    
    # Apple touch icon
    apple_icon = create_icon(180)
    apple_icon.save(f"{OUTPUT_DIR}/apple-touch-icon.png", "PNG")
    print("Created apple-touch-icon.png")
    
    # Generate splash screens
    for width, height in SPLASH_SIZES:
        splash = create_splash(width, height)
        splash.save(f"{OUTPUT_DIR}/splash-{width}x{height}.png", "PNG")
        print(f"Created splash-{width}x{height}.png")
    
    # Generate shortcut icons
    for name in ['track', 'shipments', 'scan']:
        shortcut = create_icon(96)
        shortcut.save(f"{OUTPUT_DIR}/shortcut-{name}.png", "PNG")
        print(f"Created shortcut-{name}.png")
    
    print("\nAll PWA icons generated successfully!")

if __name__ == "__main__":
    main()
