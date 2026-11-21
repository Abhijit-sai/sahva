"""Offline inference against two revision-pinned Hub snapshots."""
import os
import time

MODELS = {
    "en-IN": ("ai4bharat/indictrans2-en-indic-dist-200M", "2cfd0a20057756d756bf3e53528f492afc52f91a"),
    "te-IN": ("ai4bharat/indictrans2-indic-en-dist-200M", "d66a2122ad6d28184f3dc3797b652bd80ae3f65f"),
}
TAGS = {"en-IN": "eng_Latn", "te-IN": "tel_Telu"}


class LengthLimit(Exception):
    pass


class Translator:
    def __init__(self):
        import torch
        from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

        self.device = os.environ.get("SAHVA_MT_DEVICE", "cuda")
        if self.device not in ("cpu", "cuda"):
            raise ValueError("SAHVA_MT_DEVICE must be cpu or cuda")
        if self.device == "cuda" and not torch.cuda.is_available():
            raise RuntimeError("CUDA_REQUIRED")
        dtype = torch.float32 if self.device == "cpu" else torch.float16
        self.torch = torch
        self.models = {}
        for source, (name, revision) in MODELS.items():
            options = dict(revision=revision, code_revision=revision, local_files_only=True, trust_remote_code=True)
            tokenizer = AutoTokenizer.from_pretrained(name, **options)
            model = AutoModelForSeq2SeqLM.from_pretrained(
                name, **options, use_safetensors=True, torch_dtype=dtype
            ).to(self.device).eval()
            self.models[source] = (tokenizer, model)
        self.translate("en-IN", "te-IN", "Please wait.")
        self.translate("te-IN", "en-IN", "దయచేసి ఆగండి.")

    def translate(self, source, target, text):
        from IndicTransToolkit.processor import IndicProcessor

        started = time.monotonic()
        processor = IndicProcessor(inference=True)
        tokenizer, model = self.models[source]
        batch = processor.preprocess_batch([text], src_lang=TAGS[source], tgt_lang=TAGS[target])
        tokens = tokenizer(batch, return_tensors="pt", return_attention_mask=True, truncation=False).to(self.device)
        if tokens.input_ids.shape[1] > 256:
            raise LengthLimit()
        with self.torch.inference_mode():
            ids = model.generate(**tokens, max_length=256, num_beams=5, do_sample=False, use_cache=True)
        if ids.shape[1] >= 256:
            raise LengthLimit()
        decoded = tokenizer.batch_decode(ids.cpu(), skip_special_tokens=True, clean_up_tokenization_spaces=True)
        output = processor.postprocess_batch(decoded, lang=TAGS[target])[0].strip()
        if not output:
            raise RuntimeError("EMPTY_OUTPUT")
        name, revision = MODELS[source]
        cuda = self.device == "cuda"
        return dict(translatedText=output, model=name, revision=revision,
                    inferenceMs=round((time.monotonic() - started) * 1000),
                    gpuAllocatedBytes=self.torch.cuda.memory_allocated() if cuda else 0,
                    runtime=dict(device=self.torch.cuda.get_device_name() if cuda else "cpu",
                                 torch=str(self.torch.__version__), cuda=self.torch.version.cuda if cuda else None,
                                 dtype="float16" if cuda else "float32", threads=self.torch.get_num_threads(),
                                 beams=5, batch=1))
