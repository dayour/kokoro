---
title: Kokoro TTS
emoji: ❤️
colorFrom: indigo
colorTo: pink
sdk: gradio
sdk_version: 6.26.0
python_version: "3.14"
app_file: app.py
pinned: true
license: apache-2.0
short_description: Upgraded to v1.0!
disable_embedding: true
---

Check out the configuration reference at https://huggingface.co/docs/hub/spaces-config-reference

This version requires Python 3.14 and the patched sibling Misaki checkout.
From the Kokoro repository root, run `uv sync --locked --group demo`, then
`uv run --no-sync python demo\app.py`. Alternatively, install
`python -m pip install -r demo\requirements.txt` from the same directory.
Deployments must include both modified projects; copying this demo directory alone
does not install the local Python 3.14 fork.