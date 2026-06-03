import type { SelfHostImageModelId, SelfHostImageModelOption } from '@/components/home/types';

const SELF_HOST_IMAGE_MODEL_OPTIONS: SelfHostImageModelOption[] = [
  {
    value: 'flux-schnell',
    label: 'FLUX Schnell',
    note: 'Fastest local FLUX path on the self-host server.',
  },
  {
    value: 'flux-dev',
    label: 'FLUX Dev',
    note: 'Higher quality local FLUX path on the self-host server.',
  },
];

export { SELF_HOST_IMAGE_MODEL_OPTIONS };
export const DEFAULT_SELF_HOST_IMAGE_MODEL = SELF_HOST_IMAGE_MODEL_OPTIONS[0];

export function isSelfHostImageModelId(value: string): value is SelfHostImageModelId {
  return SELF_HOST_IMAGE_MODEL_OPTIONS.some((option) => option.value === value);
}
