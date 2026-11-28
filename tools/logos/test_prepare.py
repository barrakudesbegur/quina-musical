"""The logo preparation's pixel work, on small synthetic images.

    tools/logos/.venv/bin/python -m unittest discover -s tools/logos
"""

import unittest

import numpy as np

from prepare import contrast_on_white, hex_rgb, key_luma, readable, recolor, remove_color, trim, unblend

WHITE = np.array([1.0, 1.0, 1.0])


def canvas(h: int, w: int, rgb) -> np.ndarray:
    px = np.ones((h, w, 4))
    px[..., :3] = rgb
    return px


class Unblend(unittest.TestCase):
    def test_a_colour_unblended_from_its_ground_composites_back(self):
        rgb = np.array([[[0.6, 0.7, 0.8]]])
        bg = np.array([1.0, 1.0, 1.0])
        alpha = unblend(rgb, bg)
        colour = bg + (rgb - bg) / alpha[..., None]
        np.testing.assert_allclose(alpha[..., None] * colour + (1 - alpha[..., None]) * bg, rgb)

    def test_the_ground_itself_is_fully_transparent(self):
        self.assertEqual(unblend(np.array([[[0.2, 0.4, 0.6]]]), np.array([0.2, 0.4, 0.6]))[0, 0], 0)


class RemoveColour(unittest.TestCase):
    def setUp(self):
        # A black ring on white, with white inside the ring: an "O".
        self.px = canvas(40, 40, WHITE)
        y, x = np.mgrid[0:40, 0:40]
        r = np.hypot(x - 19.5, y - 19.5)
        self.px[(r > 8) & (r < 14), :3] = 0

    def test_edges_keeps_the_white_inside_the_logo(self):
        out = remove_color(self.px, WHITE, 0.1, everywhere=False)
        self.assertEqual(out[0, 0, 3], 0)  # the ground
        self.assertEqual(out[20, 20, 3], 1)  # the hole of the "O"
        self.assertEqual(out[20, 9, 3], 1)  # the ring

    def test_edges_clears_a_letters_counter_but_not_a_drawings_fill(self):
        # On 200×200 white: an "O" on the ground (its counter goes), and a big black frame whose white fill stays,
        # with an "O" drawn on that fill (its counter stays too, or the fill would have dark holes on a dark ground).
        px = canvas(200, 200, WHITE)
        y, x = np.mgrid[0:200, 0:200]

        def ring(cx, cy):
            r = np.hypot(x - cx, y - cy)
            px[(r > 5) & (r < 9), :3] = 0

        ring(30, 30)
        px[80:190, 80:190, :3] = 0
        px[86:184, 86:184, :3] = 1
        ring(135, 135)
        out = remove_color(px, WHITE, 0.1, everywhere=False)
        self.assertEqual(out[30, 30, 3], 0)  # the counter of the "O" on the ground
        self.assertEqual(out[100, 100, 3], 1)  # the frame's fill
        self.assertEqual(out[135, 135, 3], 1)  # the counter of the "O" on the fill

    def test_keep_white_keeps_the_patches_in_its_box_only(self):
        # Two "O"s on white: the left one's counter is in the keep box and stays; the right one's goes.
        px = canvas(200, 200, WHITE)
        y, x = np.mgrid[0:200, 0:200]
        for cx in (40, 160):
            r = np.hypot(x - cx, y - 100)
            px[(r > 5) & (r < 9), :3] = 0
        out = remove_color(px, WHITE, 0.1, everywhere=False, keep=[[0.0, 0.0, 0.5, 1.0]])
        self.assertEqual(out[100, 40, 3], 1)
        self.assertEqual(out[100, 160, 3], 0)

    def test_holes_zero_keeps_every_counter(self):
        px = canvas(200, 200, WHITE)
        y, x = np.mgrid[0:200, 0:200]
        r = np.hypot(x - 30, y - 30)
        px[(r > 5) & (r < 9), :3] = 0
        self.assertEqual(remove_color(px, WHITE, 0.1, everywhere=False, holes=0)[30, 30, 3], 1)

    def test_all_clears_the_colour_inside_too(self):
        out = remove_color(self.px, WHITE, 0.1, everywhere=True)
        self.assertEqual(out[20, 20, 3], 0)
        self.assertEqual(out[20, 9, 3], 1)


class Ink(unittest.TestCase):
    def test_light_ink_keeps_white_lettering_off_a_dark_ground(self):
        px = canvas(4, 4, [0.1, 0.1, 0.1])
        px[1:3, 1:3, :3] = 1
        out = key_luma(px, 60, 160, light=True)
        self.assertEqual(out[0, 0, 3], 0)
        self.assertEqual(out[1, 1, 3], 1)

    def test_recolouring_light_pixels_keeps_the_coloured_ones(self):
        px = canvas(1, 2, WHITE)
        px[0, 1, :3] = [0.9, 0.3, 0.5]  # a pink mark
        teal = hex_rgb("#225060")
        out = recolor(px, teal, "light")
        np.testing.assert_allclose(out[0, 0, :3], teal)
        np.testing.assert_allclose(out[0, 1, :3], [0.9, 0.3, 0.5])

    def test_a_box_colour_too_light_for_white_is_darkened_until_it_reads(self):
        orange = hex_rgb("#f17201")
        self.assertLess(contrast_on_white(orange), 4.5)
        dark = readable(orange)
        self.assertGreaterEqual(contrast_on_white(dark), 4.5)
        np.testing.assert_allclose(dark / dark.max(), orange / orange.max())  # the same hue

    def test_a_dark_box_colour_is_kept(self):
        navy = hex_rgb("#2b354f")
        np.testing.assert_allclose(readable(navy), navy)


class Trim(unittest.TestCase):
    def test_trims_to_the_visible_pixels(self):
        px = np.zeros((10, 10, 4))
        px[3:5, 2:8, 3] = 1
        self.assertEqual(trim(px).shape[:2], (2, 6))

    def test_nothing_left_is_none(self):
        self.assertIsNone(trim(np.zeros((3, 3, 4))))


if __name__ == "__main__":
    unittest.main()
