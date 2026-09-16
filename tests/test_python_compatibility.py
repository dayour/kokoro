from importlib.metadata import version
import wave

import numpy as np
import pytest
import torch
from transformers import AlbertConfig

from kokoro import KModel, KPipeline
from kokoro.__main__ import generate_and_save_audio
from kokoro.modules import CustomAlbert


def test_local_misaki_is_installed():
    assert version("misaki") == "0.9.4+py314.1"


def test_albert_forward():
    model = CustomAlbert(AlbertConfig(
        vocab_size=32,
        embedding_size=8,
        hidden_size=16,
        num_hidden_layers=1,
        num_hidden_groups=1,
        num_attention_heads=2,
        intermediate_size=32,
        max_position_embeddings=16,
    )).eval()
    input_ids = torch.tensor([[0, 1, 2, 0]])
    with torch.no_grad():
        output = model(input_ids, attention_mask=torch.ones_like(input_ids))
    assert output.shape == (1, 4, 16)
    assert torch.isfinite(output).all()


def test_numpy_torch_interop():
    array = np.linspace(-1, 1, 32, dtype=np.float32)
    np.testing.assert_array_equal(torch.from_numpy(array).numpy(), array)


def test_quiet_espeak_pipeline():
    pipeline = KPipeline(lang_code="e", model=False, repo_id="hexgrad/Kokoro-82M")
    results = list(pipeline("Hola mundo."))
    assert len(results) == 1
    assert results[0].phonemes
    assert results[0].audio is None
    assert tuple(results[0]) == ("Hola mundo.", results[0].phonemes, None)


def test_local_voice_tensor_loading(tmp_path):
    pipeline = KPipeline(lang_code="e", model=False, repo_id="hexgrad/Kokoro-82M")
    voice = torch.zeros(4, 1, 256)
    path = tmp_path / "voice.pt"
    torch.save(voice, path)
    torch.testing.assert_close(pipeline.load_voice(str(path)), voice)


def test_cli_writes_pcm_wav(monkeypatch, tmp_path):
    from kokoro import __main__ as cli

    audio = torch.tensor([-0.5, 0.0, 0.5])
    result = KPipeline.Result("hello", "hello", output=KModel.Output(audio=audio))
    monkeypatch.setattr(cli, "generate_audio", lambda *args, **kwargs: iter([result]))
    path = tmp_path / "audio.wav"
    generate_and_save_audio(path, "hello", "a", "af_heart")
    with wave.open(str(path), "rb") as wav:
        assert wav.getparams()[:4] == (1, 2, 24000, 3)
        samples = np.frombuffer(wav.readframes(3), dtype="<i2")
    np.testing.assert_array_equal(samples, [-16383, 0, 16383])


@pytest.mark.integration
@pytest.mark.parametrize("device", [
    "cpu",
    pytest.param("cuda", marks=pytest.mark.skipif(
        not torch.cuda.is_available(), reason="CUDA-enabled PyTorch and GPU required"
    )),
])
def test_pretrained_inference(device):
    pipeline = KPipeline(lang_code="a", device=device, repo_id="hexgrad/Kokoro-82M")
    assert pipeline.model.device.type == device
    result = next(pipeline("Hello world.", voice="af_heart"))
    assert result.phonemes
    assert result.audio.ndim == 1
    assert result.audio.numel() > 2400
    assert torch.isfinite(result.audio).all()
    assert result.audio.abs().max() > 0
