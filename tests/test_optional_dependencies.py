import inspect
from pathlib import Path
import runpy
from types import SimpleNamespace

import numpy as np
import pytest
import torch


def test_gradio_demo_startup(monkeypatch):
    gr = pytest.importorskip("gradio")
    pytest.importorskip("spaces")
    import kokoro

    class Model:
        def to(self, device):
            return self

        def eval(self):
            return self

    class Pipeline:
        def __init__(self, **kwargs):
            self.g2p = SimpleNamespace(lexicon=SimpleNamespace(golds={}))

        def load_voice(self, voice):
            return torch.zeros(1, 1, 256)

    monkeypatch.setattr(kokoro, "KModel", Model)
    monkeypatch.setattr(kokoro, "KPipeline", Pipeline)
    monkeypatch.setattr(torch.cuda, "is_available", lambda: False)
    launch_signature = inspect.signature(gr.Blocks.launch)
    launches = []

    def launch(self, *args, **kwargs):
        launch_signature.bind(self, *args, **kwargs)
        launches.append(kwargs)

    monkeypatch.setattr(gr.Blocks, "launch", launch)
    demo = Path(__file__).resolve().parents[1] / "demo" / "app.py"
    namespace = runpy.run_path(str(demo), run_name="__main__")
    assert namespace["app"].config["components"]
    assert launches[0]["footer_links"] == ["api"]


def test_legacy_onnx_export(tmp_path):
    pytest.importorskip("onnx")
    ort = pytest.importorskip("onnxruntime")
    pytest.importorskip("sounddevice")
    from examples.export import export_onnx

    class Model(torch.nn.Module):
        def forward(self, input_ids, style, speed):
            waveform = input_ids.float().sum(dim=1, keepdim=True) + style.mean(dim=1, keepdim=True) + speed
            return waveform, input_ids + speed

    export_onnx(Model().eval(), str(tmp_path))
    session = ort.InferenceSession(str(tmp_path / "kokoro.onnx"), providers=["CPUExecutionProvider"])
    inputs = {
        "input_ids": np.array([[0, 1, 2, 0]], dtype=np.int64),
        "style": np.zeros((1, 256), dtype=np.float32),
        "speed": np.array([1], dtype=np.int32),
    }
    waveform, duration = session.run(None, inputs)
    np.testing.assert_allclose(waveform, [[4.0]])
    np.testing.assert_array_equal(duration, [[1, 2, 3, 1]])
