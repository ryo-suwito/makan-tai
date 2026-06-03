# Fal Qwen Image Rollout Todo

Date opened: 2026-06-03

Goal: add the requested Qwen Fal.ai edit models to the image UI one at a time, with model-specific inputs and a git commit after each completed model.

## Rollout order

- [x] Add this tracker file.
- [x] Add `fal-ai/qwen-image-edit-2511` and expose its edit-only settings in the image UI.
- [x] Commit `fal-ai/qwen-image-edit-2511`.
- [x] Add `fal-ai/qwen-image-edit-2511-multiple-angles` with angle and camera controls.
- [x] Commit `fal-ai/qwen-image-edit-2511-multiple-angles`.
- [x] Add `fal-ai/qwen-image-2/edit` with its prompt-expansion and edit constraints.
- [x] Commit `fal-ai/qwen-image-2/edit`.
- [x] Add `fal-ai/qwen-image-2/pro/edit` with the same edit UI and distinct pricing/selection metadata.
- [x] Commit `fal-ai/qwen-image-2/pro/edit`.
- [ ] Add `fal-ai/qwen-image-edit-2511/lora`.
- [ ] Add a LoRA registry/table with safetensors links and a simple picker widget for the LoRA endpoint.
- [ ] Commit `fal-ai/qwen-image-edit-2511/lora` and the LoRA registry widget.

## Notes

- Keep changes concentrated in the image studio UI plus the Fal image request path.
- Do not expose a new model in the selector until its request payload and UI controls are wired.
- Use Fal docs as the source of truth for required params and defaults.
