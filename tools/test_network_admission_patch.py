"""Verify the pinned dependency patch without importing PlatformIO/SCons."""
import ast
from pathlib import Path
import tempfile
import unittest


class FakeEnvironment(dict):
    def subst(self, value):
        return self["root"]


class AcceptReservePatchTests(unittest.TestCase):
    def setUp(self):
        script = Path(__file__).with_name("pio_s3_dynconfig.py")
        tree = ast.parse(script.read_text(encoding="utf-8"))
        function = next(node for node in tree.body if isinstance(node, ast.FunctionDef)
                        and node.name == "patch_asynctcp_accept_reserve")
        namespace = {}
        exec(compile(ast.Module(body=[function], type_ignores=[]), str(script), "exec"), namespace)
        self.patch = namespace[function.name]
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.env = FakeEnvironment(root=self.directory.name, PIOENV="fixture")
        self.source = Path(self.directory.name) / "fixture/AsyncTCP/src/AsyncTCP.cpp"
        self.source.parent.mkdir(parents=True)

    def test_reserve_precedes_allocation_and_aborts_on_lwip_thread(self):
        self.source.write_text(
            "  auto server = reinterpret_cast<AsyncServer *>(arg);\n"
            "  AsyncClient *c = new (std::nothrow) AsyncClient(pcb);\n")
        self.patch(self.env)
        patched = self.source.read_text()
        self.assertLess(patched.index("ESP.getFreeHeap()"), patched.index("AsyncClient *c"))
        self.assertIn("tcp_abort(pcb);\n    return ERR_ABRT;", patched)
        self.patch(self.env)
        self.assertEqual(self.source.read_text(), patched)

    def test_upgrades_existing_broad_reserve_without_leaving_stale_code(self):
        self.source.write_text("""#if defined(ARDUINO) && defined(ESP32)
  // OpenTurbine: reserve Wi-Fi/lwIP heap before queueing an accept.
  if (ESP.getFreeHeap() < 32768 || ESP.getMaxAllocHeap() < 8192) {
    tcp_abort(pcb);
    return ERR_ABRT;
  }
#endif
  auto server = reinterpret_cast<AsyncServer *>(arg);
""")
        self.patch(self.env)
        text = self.source.read_text()
        self.assertNotIn("32768", text)
        self.assertIn("minimumHeap = 8192, minimumBlock = 2048", text)
        self.assertIn("minimumHeap = 16384, minimumBlock = 4096", text)
        self.patch(self.env)
        self.assertEqual(text, self.source.read_text())

    def test_changed_dependency_requires_review(self):
        self.source.write_text("unrecognized accept implementation")
        with self.assertRaises(RuntimeError):
            self.patch(self.env)

    def test_missing_optional_library_is_untouched(self):
        self.patch(self.env)
        self.assertFalse(self.source.exists())


if __name__ == "__main__":
    unittest.main()
