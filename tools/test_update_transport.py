import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
import urllib.error

sys.path.insert(0, str(Path(__file__).resolve().parent))
import update_transport as transport
import upload_web_assets as web
import upload_firmware_ota as firmware


class UpdateTransportTests(unittest.TestCase):
    def test_acknowledgement_requires_boolean_success(self):
        for body in [b"", b"broken", b"null", b"[]", b"{}", b'{"ok":"true"}', b'{"ok":false,"error":"denied"}']:
            with self.subTest(body=body), self.assertRaises(RuntimeError):
                transport.read_acknowledgement(io.BytesIO(body))
        self.assertEqual(transport.read_acknowledgement(io.BytesIO(b'{"ok":true}')), {"ok": True})

    def test_body_transport_failure_remains_retryable(self):
        with patch('update_transport.json.loads') as loads:
            class LostBody:
                def read(self):
                    raise OSError("lost body")
            with self.assertRaises(OSError):
                transport.read_acknowledgement(LostBody())
            loads.assert_not_called()

    def test_web_chunk_retries_only_transport_at_same_offset(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            for name in web.ASSETS:
                (root/name).write_bytes(b"image")
            for error, expected in [(RuntimeError("denied"), 1), (urllib.error.HTTPError('http://ecu',400,'denied',{},None), 1), (urllib.error.URLError("lost"), 13)]:
                calls=[]
                def send(*args):
                    calls.append(args)
                    if len(calls)==1:
                        raise error
                    return {"ok":True}
                with self.subTest(error=error), patch.object(web,'post_chunk',side_effect=send), patch.object(web.time,'sleep'), patch('sys.stdout',new=io.StringIO()):
                    if expected==1:
                        with self.assertRaises(type(error)):
                            web.upload_once('http://ecu',root,4096,1,False,False)
                    else:
                        web.upload_once('http://ecu',root,4096,1,False,False)
                        self.assertEqual(calls[0], calls[1])
                    self.assertEqual(len(calls),expected)

    def test_firmware_rejection_and_exact_offset_transport_retry(self):
        with tempfile.TemporaryDirectory() as tmp:
            image=Path(tmp)/'firmware.bin';image.write_bytes(b"12345678")
            for failure, count in [(b"broken",1),(b'{"ok":false}',1),(urllib.error.URLError("lost"),3)]:
                offsets=[]
                def open_request(req,**kwargs):
                    offsets.append(req.full_url)
                    if len(offsets)==1:
                        if isinstance(failure,Exception):raise failure
                        return io.BytesIO(failure)
                    return io.BytesIO(b'{"ok":true}')
                with self.subTest(failure=failure), patch.object(firmware.urllib.request,'urlopen',side_effect=open_request), patch.object(firmware.time,'sleep'), patch('sys.argv',['upload',str(image),'--chunk','4']), patch('sys.stdout',new=io.StringIO()):
                    if count==1:
                        with self.assertRaises(RuntimeError):firmware.main()
                    else:
                        self.assertEqual(firmware.main(),0)
                        self.assertEqual(offsets[0],offsets[1])
                    self.assertEqual(len(offsets),count)


if __name__ == '__main__':
    unittest.main()
