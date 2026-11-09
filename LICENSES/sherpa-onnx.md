# sherpa-onnx and its keyword model

Her wake word (`src/main/wake.js`, `assets/wake/`) uses:

- [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) (`sherpa-onnx-node` on npm), Apache License 2.0.
- ONNX Runtime, MIT License, included in `sherpa-onnx-win-x64`.
- The model `sherpa-onnx-kws-zipformer-gigaspeech-3.3M-2024-01-01` from the sherpa-onnx `kws-models` release, Apache License 2.0 (its int8 encoder, decoder and joiner, and tokens.txt, unchanged, renamed).
