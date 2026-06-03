import type { FalImageLoraOption } from '@/components/home/types';

export const FAL_IMAGE_LORA_OPTIONS: FalImageLoraOption[] = [
  {
    id: 'flymy-qwen-image-edit-inscene-lora',
    label: 'FlyMy In-Scene LoRA',
    description: 'Scene-coherent in-scene image editing tuned for Qwen Image Edit.',
    defaultScale: 1,
    path: 'https://huggingface.co/flymy-ai/qwen-image-edit-inscene-lora/resolve/main/flymy_qwen_image_edit_inscene_lora.safetensors',
    repoUrl: 'https://huggingface.co/flymy-ai/qwen-image-edit-inscene-lora',
    safetensorsUrl: 'https://huggingface.co/flymy-ai/qwen-image-edit-inscene-lora/blob/main/flymy_qwen_image_edit_inscene_lora.safetensors',
  },
];
