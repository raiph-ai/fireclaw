#!/usr/bin/env python3
"""
FireClaw OLED Display Service
Badger claw icon with fire effects on threat detection
SSD1306 128x64 I2C OLED at 0x3C
"""

import time
import json
import random
import socket
import os
import sys
from datetime import datetime
from pathlib import Path

from luma.core.interface.serial import i2c
from luma.core.render import canvas
from luma.oled.device import ssd1306
from PIL import Image, ImageDraw, ImageFont

# Configuration
OLED_ADDRESS = 0x3C
OLED_BUS = 1
STATUS_FILE = "/home/admin/fireclaw/data/display-status.json"
SCREEN_ROTATION_INTERVAL = 5  # seconds
FPS = 20

# Try to import the claw bitmap
try:
    from claw_bitmap import CLAW_BITMAP, CLAW_SIZE
except ImportError:
    CLAW_BITMAP = None
    CLAW_SIZE = 0


class FireClawDisplay:
    def __init__(self):
        self.device = None
        self.width = 128
        self.height = 64
        self.current_screen = 0
        self.last_screen_change = time.time()
        self.start_time = time.time()
        self.last_event = None
        self.last_event_time = 0
        self.event_duration = 0

        # Screen order: claw first, then info screens
        self.screens = ['claw', 'ip', 'stats', 'uptime', 'health']

        try:
            self.font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 10)
            self.font_large = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 14)
            self.font_small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 9)
        except:
            self.font = ImageFont.load_default()
            self.font_large = ImageFont.load_default()
            self.font_small = ImageFont.load_default()

        # Pre-render claw image
        self.claw_img = self._render_claw_image()

    def _render_claw_image(self):
        """Pre-render the claw bitmap as a PIL Image for fast blitting"""
        if CLAW_BITMAP is None:
            return None
        img = Image.new('1', (CLAW_SIZE, CLAW_SIZE), 0)
        draw = ImageDraw.Draw(img)
        for y, row in enumerate(CLAW_BITMAP):
            for x, pixel in enumerate(row):
                if pixel:
                    draw.point((x, y), fill=255)
        return img

    def init_device(self):
        """Initialize the OLED device"""
        try:
            serial = i2c(port=OLED_BUS, address=OLED_ADDRESS)
            self.device = ssd1306(serial)
            print(f"✓ OLED detected at address 0x{OLED_ADDRESS:02X}")
            return True
        except Exception as e:
            print(f"No OLED detected: {e}")
            return False

    def get_status_data(self):
        try:
            if os.path.exists(STATUS_FILE):
                with open(STATUS_FILE, 'r') as f:
                    return json.load(f)
        except:
            pass
        return None

    def get_ip_address(self):
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
            return ip
        except:
            return "No network"

    def get_hostname(self):
        return socket.gethostname()

    def get_uptime(self):
        uptime_seconds = time.time() - self.start_time
        days = int(uptime_seconds // 86400)
        hours = int((uptime_seconds % 86400) // 3600)
        minutes = int((uptime_seconds % 3600) // 60)
        return days, hours, minutes

    def get_health_stats(self):
        stats = {}
        try:
            with open('/sys/class/thermal/thermal_zone0/temp', 'r') as f:
                temp = int(f.read().strip()) / 1000.0
                stats['cpu_temp'] = f"{temp:.1f}°C"
        except:
            stats['cpu_temp'] = "N/A"
        try:
            with open('/proc/meminfo', 'r') as f:
                lines = f.readlines()
                mem_total = int(lines[0].split()[1])
                mem_available = int(lines[2].split()[1])
                mem_used_pct = ((mem_total - mem_available) / mem_total) * 100
                stats['ram'] = f"{mem_used_pct:.0f}%"
        except:
            stats['ram'] = "N/A"
        try:
            st = os.statvfs('/')
            total = st.f_blocks * st.f_frsize
            free = st.f_bfree * st.f_frsize
            used_pct = ((total - free) / total) * 100
            stats['disk'] = f"{used_pct:.0f}%"
        except:
            stats['disk'] = "N/A"
        return stats

    # === Screen renderers ===

    def screen_claw(self, draw, img):
        """Draw the claw icon centered on the display"""
        if self.claw_img:
            # Center the claw on the 128x64 display
            x_offset = (self.width - CLAW_SIZE) // 2
            y_offset = (self.height - CLAW_SIZE) // 2
            img.paste(self.claw_img, (x_offset, y_offset))

    def screen_claw_fire(self, draw, img):
        """Draw the claw icon with fire effect (for threat detection)"""
        self.screen_claw(draw, img)
        self._draw_fire(draw)

    def _draw_fire(self, draw):
        """Draw animated fire/flames rising from the claw"""
        claw_x = (self.width - CLAW_SIZE) // 2
        claw_y = (self.height - CLAW_SIZE) // 2

        # Flame triangles rising from top of claw
        for cx in range(claw_x, claw_x + CLAW_SIZE, 7):
            if random.random() > 0.15:
                h = random.randint(5, 14)
                w = random.randint(3, 6)
                tip_y = max(0, claw_y - h)
                base_y = claw_y + 2
                draw.polygon([(cx - w, base_y), (cx, tip_y), (cx + w, base_y)],
                             outline=255, fill=255 if random.random() > 0.4 else 0)

        # Sparks/embers shooting upward
        for _ in range(25):
            x = random.randint(claw_x - 5, claw_x + CLAW_SIZE + 5)
            y = random.randint(0, claw_y + 5)
            draw.point((x, y), fill=255)

        # Side flames
        for _ in range(8):
            side = random.choice(['left', 'right'])
            if side == 'left':
                x = claw_x - random.randint(2, 8)
            else:
                x = claw_x + CLAW_SIZE + random.randint(2, 8)
            y = random.randint(claw_y, claw_y + CLAW_SIZE // 2)
            h = random.randint(3, 8)
            draw.line([(x, y), (x, y - h)], fill=255, width=1)

        # "THREAT" text at bottom
        draw.text((30, 55), "!! THREAT !!", font=self.font_small, fill=255)

    def screen_ip(self, draw, img):
        draw.text((10, 5), "FireClaw", font=self.font_large, fill=255)
        draw.line([10, 22, 118, 22], fill=255)
        ip = self.get_ip_address()
        hostname = self.get_hostname()
        draw.text((10, 28), f"IP: {ip}", font=self.font, fill=255)
        draw.text((10, 42), f"Host: {hostname}", font=self.font_small, fill=255)

    def screen_stats(self, draw, img):
        status = self.get_status_data()
        if status:
            fetches = status.get('fetches_today', 0)
            threats = status.get('threats_today', 0)
            draw.text((10, 10), "Today", font=self.font_large, fill=255)
            draw.line([10, 27, 118, 27], fill=255)
            draw.text((10, 32), f"{fetches} fetches", font=self.font, fill=255)
            draw.text((10, 46), f"{threats} threats", font=self.font, fill=255)
        else:
            draw.text((10, 20), "Waiting for", font=self.font, fill=255)
            draw.text((10, 35), "data...", font=self.font, fill=255)

    def screen_uptime(self, draw, img):
        days, hours, minutes = self.get_uptime()
        draw.text((10, 8), "Running", font=self.font_large, fill=255)
        draw.line([10, 25, 118, 25], fill=255)
        draw.text((15, 35), f"{days}d {hours}h {minutes}m", font=self.font, fill=255)
        if int(time.time()) % 2 == 0:
            draw.ellipse([105, 50, 115, 60], fill=255)

    def screen_health(self, draw, img):
        stats = self.get_health_stats()
        draw.text((10, 5), "Health", font=self.font_large, fill=255)
        draw.line([10, 22, 118, 22], fill=255)
        draw.text((10, 28), f"CPU: {stats['cpu_temp']}", font=self.font, fill=255)
        draw.text((10, 40), f"RAM: {stats['ram']}", font=self.font, fill=255)
        draw.text((10, 52), f"Disk: {stats['disk']}", font=self.font, fill=255)

    # === Event handling ===

    def check_events(self):
        status = self.get_status_data()
        if not status:
            return
        last_event = status.get('last_event')
        last_event_type = status.get('last_event_type')
        if last_event_type and last_event != self.last_event:
            self.last_event = last_event
            self.last_event_time = time.time()
            if last_event_type in ('injection', 'blocked', 'alert'):
                self.event_duration = 5  # Fire claw for 5 seconds
            elif last_event_type == 'sanitized':
                self.event_duration = 2
            else:
                self.event_duration = 3

    # === Main render ===

    def render_frame(self):
        img = Image.new('1', (self.width, self.height), 0)
        draw = ImageDraw.Draw(img)
        current_time = time.time()

        self.check_events()

        # Event animation: fire claw
        if self.last_event and (current_time - self.last_event_time) < self.event_duration:
            self.screen_claw_fire(draw, img)
        else:
            # Normal screen rotation
            if current_time - self.last_screen_change > SCREEN_ROTATION_INTERVAL:
                self.current_screen = (self.current_screen + 1) % len(self.screens)
                self.last_screen_change = current_time

            screen_name = self.screens[self.current_screen]
            renderer = getattr(self, f'screen_{screen_name}', None)
            if renderer:
                renderer(draw, img)

        return img

    def run(self):
        if not self.init_device():
            sys.exit(0)

        print("FireClaw OLED Display Service started")
        print(f"Claw bitmap: {'loaded' if CLAW_BITMAP else 'NOT FOUND'}")
        print(f"Screen rotation: {SCREEN_ROTATION_INTERVAL}s")

        try:
            while True:
                img = self.render_frame()
                self.device.display(img)
                time.sleep(1.0 / FPS)
        except KeyboardInterrupt:
            print("\nStopping display service...")
            self.device.clear()
        except Exception as e:
            print(f"Error: {e}")
            raise


if __name__ == '__main__':
    display = FireClawDisplay()
    display.run()
