import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F


class CustomSTFT(nn.Module):
    """ONNX-compatible real-valued lowering of PyTorch's Hann STFT/iSTFT.

    Use one-sided inverse DFT weights and squared-window overlap normalization
    to preserve native reconstruction amplitudes.
    """

    def __init__(
        self,
        filter_length=800,
        hop_length=200,
        win_length=800,
        window="hann",
        center=True,
        pad_mode="reflect",
    ):
        super().__init__()
        if filter_length <= 0 or hop_length <= 0 or not 0 < win_length <= filter_length:
            raise ValueError("Require positive FFT/hop sizes and 0 < win_length <= filter_length")
        if window != "hann":
            raise ValueError("Only the Hann window is supported")
        self.filter_length = filter_length
        self.hop_length = hop_length
        self.win_length = win_length
        self.n_fft = filter_length
        self.center = center
        self.pad_mode = pad_mode
        self.freq_bins = filter_length // 2 + 1

        window_tensor = torch.hann_window(win_length, periodic=True)
        extra = filter_length - win_length
        window_tensor = F.pad(window_tensor, (extra // 2, extra - extra // 2))
        self.register_buffer("window", window_tensor)

        angle = 2 * np.pi * np.outer(
            np.arange(self.freq_bins), np.arange(filter_length)
        ) / filter_length
        cosine = torch.from_numpy(np.cos(angle)).float()
        sine = torch.from_numpy(np.sin(angle)).float()
        if filter_length % 2 == 0:
            # Nyquist is purely real; residue would wrap its phase by 2*pi.
            sine[-1].zero_()
            cosine[-1] = torch.where(
                torch.arange(filter_length) % 2 == 0, 1.0, -1.0
            )
        self.register_buffer("weight_forward_real", (cosine * window_tensor).unsqueeze(1))
        self.register_buffer("weight_forward_imag", (-sine * window_tensor).unsqueeze(1))

        # Interior bins represent both halves of the real-valued spectrum.
        weights = torch.full((self.freq_bins, 1), 2.0 / filter_length)
        weights[0] = 1.0 / filter_length
        if filter_length % 2 == 0:
            weights[-1] = 1.0 / filter_length
        self.register_buffer(
            "weight_backward_real", (cosine * weights * window_tensor).unsqueeze(1)
        )
        self.register_buffer(
            "weight_backward_imag", (sine * weights * window_tensor).unsqueeze(1)
        )
        self.register_buffer("window_squared", window_tensor.square().reshape(1, 1, -1))

    def transform(self, waveform: torch.Tensor):
        if self.center:
            waveform = F.pad(
                waveform, (self.n_fft // 2, self.n_fft // 2), mode=self.pad_mode
            )
        x = waveform.unsqueeze(1)
        real = F.conv1d(x, self.weight_forward_real, stride=self.hop_length)
        imag = F.conv1d(x, self.weight_forward_imag, stride=self.hop_length)
        phase = torch.atan2(imag, real)
        # Exported atan2 must retain the native phase of purely real bins.
        phase = torch.where(
            imag == 0, torch.where(real < 0, torch.pi, 0.0), phase
        )
        return torch.sqrt(real.square() + imag.square()), phase

    def inverse(self, magnitude: torch.Tensor, phase: torch.Tensor, length=None):
        if length is not None and length <= 0:
            raise ValueError("Output length must be positive")
        real = magnitude * torch.cos(phase)
        imag = magnitude * torch.sin(phase)
        waveform = F.conv_transpose1d(
            real, self.weight_backward_real, stride=self.hop_length
        ) - F.conv_transpose1d(
            imag, self.weight_backward_imag, stride=self.hop_length
        )
        envelope = F.conv_transpose1d(
            torch.ones_like(magnitude[:, :1, :]),
            self.window_squared,
            stride=self.hop_length,
        )
        start = self.n_fft // 2 if self.center else 0
        end = start + length if length is not None else waveform.shape[-1] - start
        waveform = waveform[..., start:end]
        envelope = envelope[..., start:end]
        if not torch.jit.is_tracing() and torch.any(envelope <= 1e-11):
            raise ValueError("Window/hop combination fails nonzero overlap-add")
        waveform = waveform / envelope
        if length is not None and waveform.shape[-1] < length:
            waveform = F.pad(waveform, (0, length - waveform.shape[-1]))
        return waveform

    def forward(self, x: torch.Tensor):
        magnitude, phase = self.transform(x)
        return self.inverse(magnitude, phase, length=x.shape[-1])
