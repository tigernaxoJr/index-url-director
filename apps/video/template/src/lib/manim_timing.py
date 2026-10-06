"""Timing for Manim scenes rendered by `pnpm run manim` (Skill rendering-guide.md#manim).

    from manim import *
    from manim_timing import FONTS, timing, wait_until, finish

    class Main(Scene):
        def construct(self):
            cues = timing()["cues"]          # [{"start", "end", "text", ...}] from the narration
            with register_font(str(FONTS / "NotoSansTC-Bold.otf")):
                self.play(Write(Text("質能等價", font="Noto Sans TC")))
            self.play(Write(MathTex("E = mc^2")))
            wait_until(self, cues[1]["start"] if len(cues) > 1 else 2)
            ...
            finish(self)                     # hold the last frame until the scene ends

`pnpm run manim` passes the scene's length and cues in AVP_TIMING. When the file is rendered by
hand (`manim render assets/scene.py Main`), timing() returns DEFAULT so the program still runs.
"""
import json
import os
from pathlib import Path

FONTS = Path(__file__).resolve().parent.parent / "fonts"
"""The template's fonts (NotoSansTC-Bold.otf, JetBrainsMono-Regular.ttf), for manim's register_font()."""

DEFAULT = {"durationSec": None, "fps": 30, "width": 1920, "height": 1080, "cues": []}


def timing():
    """{"durationSec", "fps", "width", "height", "cues"} of the scene being rendered."""
    path = os.environ.get("AVP_TIMING")
    if not path:
        return dict(DEFAULT)
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def wait_until(scene, t):
    """Waits until `t` seconds into the scene; does nothing when that time has already passed."""
    dt = t - scene.renderer.time
    if dt > 1e-3:
        scene.wait(dt)


def finish(scene):
    """Waits until the scene's full length, so the video is exactly as long as the narration."""
    duration = timing()["durationSec"]
    if duration is not None:
        wait_until(scene, duration)
