"""Ask regression pack from fixtures (#33) — synthetic corpus only."""
from __future__ import annotations

import os
import unittest

from lorekeeper_ask_regression import (
    assert_regression_case,
    load_regression_cases,
    run_regression_case,
)


class AskRegressionTests(unittest.TestCase):
    def setUp(self) -> None:
        self._env = os.environ.copy()
        os.environ["LOREKEEPER_RAG"] = "0"

    def tearDown(self) -> None:
        os.environ.clear()
        os.environ.update(self._env)

    def test_regression_fixtures(self) -> None:
        cases = load_regression_cases()
        self.assertTrue(cases, "ask_regression_cases.json must define at least one case")
        failures: list[str] = []
        for case in cases:
            res = run_regression_case(case)
            failures.extend(assert_regression_case(case, res))
        if failures:
            self.fail("\n".join(failures))


if __name__ == "__main__":
    unittest.main()
