import threading
import unittest
from uuid import uuid4

from starlette.testclient import TestClient

from model import MODELS
from worker import create_app


class Stub:
    def translate(self, source, target, text):
        model, revision = MODELS[source]
        return dict(model=model, revision=revision, translatedText="fixture output", inferenceMs=1)


class WorkerContract(unittest.TestCase):
    token = "t" * 32
    headers = {"authorization": "Bearer " + token}
    path = "/v1/mt/translate"

    def request(self, **changes):
        return dict(dict(requestId=str(uuid4()), sourceLanguage="te-IN", targetLanguage="en-IN", text="fixture"), **changes)

    def test_auth_capability_and_both_directions(self):
        with TestClient(create_app(Stub, secret=self.token)) as client:
            for path in ("/live", "/ready", "/v1/capabilities"):
                self.assertEqual(client.get(path).status_code, 401)
                self.assertEqual(client.get(path, headers=self.headers).status_code, 200)
            for source, target in (("te-IN", "en-IN"), ("en-IN", "te-IN")):
                body = self.request(sourceLanguage=source, targetLanguage=target)
                self.assertEqual(client.post(self.path, json=body).status_code, 401)
                r = client.post(self.path, json=body, headers=self.headers)
                self.assertEqual((r.status_code, r.json()["revision"], r.json()["requestId"]),
                                 (200, MODELS[source][1], body["requestId"]))

    def test_validation_and_rate_limit(self):
        with TestClient(create_app(Stub, secret=self.token, rate=1), headers=self.headers) as c:
            for change, status in (({"targetLanguage":"te-IN"},422), ({"text":"a"*1001},422),
                                   ({"text":" "},422), ({"requestId":"bad"},400), ({"sourceLanguage":"hi-IN"},422)):
                self.assertEqual(c.post(self.path, json=self.request(**change)).status_code, status)
            self.assertEqual(c.post(self.path, json=self.request(text="a"*9000)).status_code,413)
            self.assertEqual(c.post(self.path, json=self.request()).status_code,200)
            self.assertEqual(c.post(self.path, json=self.request()).json()["error"]["code"],"RATE_LIMIT")

    def test_timeout_retains_gpu_slot_until_work_finishes(self):
        gate = threading.Event()
        class Slow(Stub):
            def translate(self, *args):
                gate.wait(1)
                return super().translate(*args)
        with TestClient(create_app(Slow, secret=self.token, deadline=0.02), headers=self.headers) as c:
            try:
                self.assertEqual(c.post(self.path, json=self.request()).status_code,504)
                self.assertEqual(c.post(self.path, json=self.request()).json()["error"]["code"],"BUSY")
            finally:
                gate.set()

    def test_configuration_and_model_load_fail_closed(self):
        with self.assertRaises(RuntimeError):
            create_app(Stub, secret="short")
        def unavailable():
            raise RuntimeError("missing weights")
        with self.assertRaises(RuntimeError):
            with TestClient(create_app(unavailable, secret=self.token)):
                pass


if __name__ == "__main__":
    unittest.main()
