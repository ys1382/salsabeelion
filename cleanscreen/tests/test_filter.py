#!/usr/bin/env python3
from __future__ import annotations

import unittest

from cleanscreen_filter import VettedYoutubeChannel, filter_result


class CleanScreenFilterTests(unittest.TestCase):
    def test_blocks_profanity_in_snippet(self) -> None:
        v = filter_result(
            "Easy chicken soup",
            "https://example.com/recipe",
            "A shit comfort food recipe for winter.",
        )
        self.assertFalse(v.allow)
        self.assertEqual(v.reason, "profanity")

    def test_blocks_youtube(self) -> None:
        v = filter_result(
            "How to knit",
            "https://www.youtube.com/watch?v=abc",
            "A calm knitting tutorial.",
        )
        self.assertFalse(v.allow)
        self.assertEqual(v.reason, "video_heavy")

    def test_blocks_fanfic_host(self) -> None:
        v = filter_result(
            "Harry Potter fanfic",
            "https://archiveofourown.org/works/123",
            "A story archive.",
        )
        self.assertFalse(v.allow)
        self.assertEqual(v.reason, "fanfic_host")

    def test_blocks_romance_on_open_web(self) -> None:
        v = filter_result(
            "Best romance novels 2026",
            "https://example.com/lists",
            "Love stories and dating fiction picks.",
        )
        self.assertFalse(v.allow)
        self.assertEqual(v.reason, "romance")

    def test_vetted_site_allows_educational_lgbtq_mention(self) -> None:
        v = filter_result(
            "LGBTQ health resources for teens",
            "https://www.cdc.gov/lgbthealth/youth.htm",
            "Information for parents about identity and health.",
            vetted=["cdc.gov"],
        )
        self.assertTrue(v.allow)

    def test_vetted_site_still_blocks_profanity(self) -> None:
        v = filter_result(
            "Article",
            "https://kidshealth.org/en/example.html",
            "This shit is unacceptable language in the snippet.",
            vetted=["kidshealth.org"],
        )
        self.assertFalse(v.allow)

    def test_vetted_youtube_channel_page(self) -> None:
        v = filter_result(
            "Yaqeen Institute - YouTube",
            "https://www.youtube.com/@yaqeeninstituteofficial",
            "Islamic research and education.",
            vetted_youtube=[VettedYoutubeChannel(handle="yaqeeninstituteofficial", names=("Yaqeen Institute",))],
        )
        self.assertTrue(v.allow)
        self.assertEqual(v.reason, "vetted_youtube_channel")

    def test_vetted_youtube_watch_when_title_names_channel(self) -> None:
        v = filter_result(
            "Our New Look | Reintroducing Yaqeen | Yaqeen Institute",
            "https://www.youtube.com/watch?v=rivAbFLrdfo",
            "Yaqeen Institute reintroduces its identity.",
            vetted_youtube=[VettedYoutubeChannel(handle="yaqeeninstituteofficial", names=("Yaqeen Institute",))],
        )
        self.assertTrue(v.allow)

    def test_unvetted_youtube_watch_still_blocked(self) -> None:
        v = filter_result(
            "How to knit",
            "https://www.youtube.com/watch?v=abc",
            "A calm knitting tutorial.",
            vetted_youtube=[VettedYoutubeChannel(handle="yaqeeninstituteofficial", names=("Yaqeen Institute",))],
        )
        self.assertFalse(v.allow)
        self.assertEqual(v.reason, "video_heavy")

    def test_kid_mode_blocks_amazon(self) -> None:
        v = filter_result(
            "Yarn sale",
            "https://www.amazon.com/dp/example",
            "Shop craft supplies.",
            parent_mode=False,
            parent_only=["amazon.com"],
        )
        self.assertFalse(v.allow)
        self.assertEqual(v.reason, "parent_only_site")

    def test_parent_mode_allows_amazon(self) -> None:
        v = filter_result(
            "Yarn sale",
            "https://www.amazon.com/dp/example",
            "Shop craft supplies.",
            parent_mode=True,
            parent_only=["amazon.com"],
        )
        self.assertTrue(v.allow)

    def test_parent_mode_still_blocks_disney_plus(self) -> None:
        v = filter_result(
            "Watch Frozen",
            "https://www.disneyplus.com/movies/frozen",
            "Stream on Disney+.",
            parent_mode=True,
            blocks={"video_heavy": ["disneyplus.com"], "fanfic": [], "substance_retail": []},
        )
        self.assertFalse(v.allow)
        self.assertEqual(v.reason, "video_heavy")

    def test_parent_mode_still_blocks_random_blog_romance(self) -> None:
        v = filter_result(
            "Best romance blogs",
            "https://randomblog.example.com/post",
            "Love stories and dating fiction.",
            parent_mode=True,
            parent_only=["amazon.com"],
        )
        self.assertFalse(v.allow)
        self.assertEqual(v.reason, "romance")

    def test_kid_mode_allows_vetted_library(self) -> None:
        v = filter_result(
            "Borrow ebooks",
            "https://www.overdrive.com/apps/libby",
            "Library reading app.",
            parent_mode=False,
            vetted=["overdrive.com"],
            parent_only=["amazon.com"],
        )
        self.assertTrue(v.allow)
        self.assertEqual(v.reason, "vetted_site")

    def test_kid_mode_blocks_reddit(self) -> None:
        v = filter_result(
            "Beeswax wraps worth it?",
            "https://www.reddit.com/r/ZeroWaste/comments/example",
            "Discussion thread.",
            parent_mode=False,
            parent_only=["reddit.com"],
        )
        self.assertFalse(v.allow)
        self.assertEqual(v.reason, "parent_only_site")

    def test_kid_mode_blocks_fox_news(self) -> None:
        v = filter_result(
            "School board vote",
            "https://www.foxnews.com/us/example-story",
            "Latest headlines.",
            parent_mode=False,
            parent_only=["foxnews.com"],
        )
        self.assertFalse(v.allow)
        self.assertEqual(v.reason, "parent_only_site")

    def test_parent_mode_blocks_fanservice_hub(self) -> None:
        v = filter_result(
            "Game download",
            "https://www.nutaku.net/example",
            "Adult game portal.",
            parent_mode=True,
            blocks={"fanservice_sites": ["nutaku.net"], "fanfic": [], "video_heavy": [], "substance_retail": []},
        )
        self.assertFalse(v.allow)
        self.assertEqual(v.reason, "fanservice_site")

    def test_both_modes_block_pastebin(self) -> None:
        for parent_mode in (False, True):
            v = filter_result(
                "Notes",
                "https://pastebin.com/example",
                "Shared text.",
                parent_mode=parent_mode,
                blocks={"bypass_tools": ["pastebin.com"], "fanfic": [], "video_heavy": [], "substance_retail": []},
            )
            self.assertFalse(v.allow)
            self.assertEqual(v.reason, "bypass_tool")

    def test_kid_mode_blocks_roblox(self) -> None:
        v = filter_result(
            "Free games",
            "https://www.roblox.com/games/example",
            "Play online.",
            parent_mode=False,
            parent_only=["roblox.com"],
        )
        self.assertFalse(v.allow)
        self.assertEqual(v.reason, "parent_only_site")

    def test_kid_mode_allows_minecraft_official(self) -> None:
        v = filter_result(
            "Download Minecraft",
            "https://www.minecraft.net/en-us/download",
            "Official game site.",
            parent_mode=False,
            vetted=["minecraft.net"],
        )
        self.assertTrue(v.allow)
        self.assertEqual(v.reason, "vetted_site")


if __name__ == "__main__":
    unittest.main()
