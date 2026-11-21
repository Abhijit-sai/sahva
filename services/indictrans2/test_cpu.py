"""Offline device regression. The checkpoint loaders are replaced with test doubles."""
import os
import unittest
from unittest.mock import MagicMock, patch

import torch
from transformers import BatchEncoding

from model import MODELS, Translator


class CpuWorkerTest(unittest.TestCase):
    def test_both_directions_run_on_cpu_and_report_the_pinned_model(self):
        tokenizer = MagicMock()
        tokenizer.return_value = BatchEncoding({"input_ids": torch.tensor([[1, 2]])})
        tokenizer.batch_decode.return_value = ["12"]
        model = MagicMock()
        model.to.return_value.eval.return_value = model
        model.generate.side_effect = lambda input_ids, **kwargs: input_ids
        with (
            patch.dict(os.environ, SAHVA_MT_DEVICE="cpu"),
            patch("transformers.AutoTokenizer.from_pretrained", return_value=tokenizer),
            patch("transformers.AutoModelForSeq2SeqLM.from_pretrained", return_value=model) as load,
            patch("torch.cuda.get_device_name", side_effect=AssertionError("CUDA on CPU")),
            patch("torch.cuda.memory_allocated", side_effect=AssertionError("CUDA on CPU")),
        ):
            worker = Translator()
            self.assertEqual(load.call_count, 2)
            for call, (name, revision) in zip(load.call_args_list, MODELS.values(), strict=True):
                self.assertEqual(call.args, (name,))
                self.assertEqual(call.kwargs["revision"], revision)
                self.assertEqual(call.kwargs["torch_dtype"], torch.float32)
                self.assertTrue(call.kwargs["local_files_only"])
            for source, target in (("en-IN", "te-IN"), ("te-IN", "en-IN")):
                result = worker.translate(source, target, "12")
                self.assertEqual((result["model"], result["revision"]), MODELS[source])
                self.assertEqual(result["runtime"]["device"], "cpu")
                self.assertEqual(result["runtime"]["dtype"], "float32")
                self.assertIsNone(result["runtime"]["cuda"])
                self.assertEqual(result["gpuAllocatedBytes"], 0)
                self.assertTrue(result["translatedText"])


if __name__ == "__main__":
    unittest.main()
