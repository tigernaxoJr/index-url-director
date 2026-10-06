"""Ready-made Manim scenes (Skill rendering-guide.md#recipes). Subclass one in the scene's
assets/scene.py and set its fields; the subclass must be defined in that file:

    import math
    from manim_recipes import FormulaSteps, FunctionGraph

    class Main(FormulaSteps):
        STEPS = [r"{{a^2}} + {{b^2}} = {{c^2}}", r"{{c^2}} = {{a^2}} + {{b^2}}", r"{{c}} = \\sqrt{ {{a^2}} + {{b^2}} }"]
        CAPTION = "畢氏定理"

    # or
    class Main(FunctionGraph):
        LABEL = r"f(x) = \\sin x"
        X_RANGE = [-6, 6, 2]
        Y_RANGE = [-1.5, 1.5, 0.5]
        def f(self, x):
            return math.sin(x)

Each step starts when the narration reaches the matching line (cue i), so the picture follows
the voice; without narration the steps are spaced STEP_SEC apart.
"""
from manim import (
    BLUE_B, DOWN, DR, UP, UR, WHITE, Axes, Create, Dot, FadeIn, MathTex, Scene, Text, TransformMatchingTex,
    ValueTracker, Write, always_redraw, register_font,
)

from manim_timing import FONTS, finish, timing, wait_until

ACCENT = "#38bdf8"


def _cue_start(cues, i, fallback):
    return cues[i]["start"] if i < len(cues) else fallback


def _caption(scene, text):
    """A heading in the template's bundled font, at the top of the frame."""
    with register_font(str(FONTS / "NotoSansTC-Bold.otf")):
        title = Text(text, font="Noto Sans TC", color=ACCENT).scale(0.7).to_edge(UP)
    scene.play(FadeIn(title, shift=DOWN * 0.2), run_time=0.5)


class FormulaSteps(Scene):
    """A formula transforms step by step. Wrap the parts in {{ }} so that matching parts glide into
    place between steps (TransformMatchingTex); unwrapped parts just fade."""

    STEPS = [r"{{a^2}} + {{b^2}} = {{c^2}}", r"{{c}} = \sqrt{ {{a^2}} + {{b^2}} }"]
    CAPTION = None
    STEP_SEC = 2.0
    SCALE = 1.6
    # Optional (step index, tex part) pairs drawn in the accent color, e.g. [(1, "c")]; the part must be one of the {{ }} parts.
    HIGHLIGHT = []

    def construct(self):
        cues = timing()["cues"]
        if self.CAPTION:
            _caption(self, self.CAPTION)
        current = None
        for i, tex in enumerate(self.STEPS):
            wait_until(self, _cue_start(cues, i, 0.3 + i * self.STEP_SEC))
            eq = MathTex(tex, color=WHITE).scale(self.SCALE)
            for step, part in self.HIGHLIGHT:
                if step == i:
                    eq.set_color_by_tex(part, ACCENT)
            if current is None:
                self.play(Write(eq), run_time=1.2)
            else:
                self.play(TransformMatchingTex(current, eq), run_time=1.0)
            current = eq
        finish(self)


class FunctionGraph(Scene):
    """Axes, a function drawn left to right, then a dot that travels along it."""

    X_RANGE = [-4, 4, 1]
    Y_RANGE = [0, 4, 1]
    LABEL = r"f(x) = \tfrac{1}{4}x^2"
    CAPTION = None

    def f(self, x):
        """The function to plot; override it in the subclass."""
        return 0.25 * x**2

    def construct(self):
        cues = timing()["cues"]
        if self.CAPTION:
            _caption(self, self.CAPTION)
        axes = Axes(x_range=self.X_RANGE, y_range=self.Y_RANGE, x_length=10, y_length=5.5, tips=False,
                    axis_config={"color": BLUE_B, "include_numbers": True})
        axes.shift(DOWN * 0.4)
        graph = axes.plot(self.f, color=ACCENT, stroke_width=6)
        label = MathTex(self.LABEL, color=ACCENT).to_corner(DR if self.CAPTION else UR)
        self.play(Create(axes), run_time=1.0)
        wait_until(self, _cue_start(cues, 0, 0.3))
        self.play(Create(graph), FadeIn(label), run_time=1.6)
        wait_until(self, _cue_start(cues, 1, 3.0))
        x = ValueTracker(self.X_RANGE[0])
        dot = always_redraw(lambda: Dot(axes.c2p(x.get_value(), self.f(x.get_value())), color=WHITE, radius=0.1))
        self.add(dot)
        self.play(x.animate.set_value(self.X_RANGE[1]), run_time=2.5)
        finish(self)
