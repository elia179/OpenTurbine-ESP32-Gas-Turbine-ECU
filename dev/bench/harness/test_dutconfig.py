import unittest

from otbench.dutconfig import _nested_matches, _nested_mismatches


class CompactConfigVerificationTests(unittest.TestCase):
    def test_omitted_empty_collection_verifies_explicit_clear(self):
        current = {"engine": {"rpm_limit": 100000}}
        expected = {"rules": [], "engine": {"rpm_limit": 100000}}

        self.assertTrue(_nested_matches(current, expected))
        self.assertEqual(_nested_mismatches(current, expected), [])

    def test_omitted_scalar_does_not_verify(self):
        current = {"engine": {}}
        expected = {"engine": {"rpm_limit": 0.0}}

        self.assertFalse(_nested_matches(current, expected))
        self.assertNotEqual(_nested_mismatches(current, expected), [])


if __name__ == "__main__":
    unittest.main()
