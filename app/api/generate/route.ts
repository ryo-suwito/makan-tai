import { Buffer } from 'buffer';
import { GoogleGenAI } from '@google/genai';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { extname, join } from 'path';
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import type { FalImageSettings } from '@/components/home/types';
import {
  clampFalImageBatchSize,
  getClosestFalImageAspectRatio,
  getFalImageModelConfig,
  isFalImageModelId,
} from '../../../lib/fal-image-models';
import { getClosestGeminiAspectRatio, isGeminiImageModel, isOpenAiImageModel } from '../../../lib/image-models';
import { isSelfHostImageModelId } from '../../../lib/self-host-image-models';

export const runtime = 'nodejs';

interface GenerateBody {
  prompt: string;
  width: number;
  height: number;
  batchSize: number;
  model: string;
  quality: string;
  inputImages?: string[];
  falImageSettings?: FalImageSettings;
}

interface GeminiInlineDataPart {
  inlineData: {
    data: string;
    mimeType: string;
  };
}

interface OpenAiImageReference {
  file_id?: string;
  image_url?: string;
}

function buildAbsoluteGeneratedUrl(req: NextRequest, filename: string) {
  const host = req.headers.get('host');
  const proto = req.headers.get('x-forwarded-proto') || 'http';
  return host ? `${proto}://${host}/generated/${filename}` : `/generated/${filename}`;
}

function extensionFromMimeType(mimeType: string) {
  const normalized = mimeType.toLowerCase();
  if (normalized.includes('png')) return '.png';
  if (normalized.includes('jpeg') || normalized.includes('jpg')) return '.jpg';
  if (normalized.includes('webp')) return '.webp';
  if (normalized.includes('gif')) return '.gif';
  return '.png';
}

function extensionFromImageFormat(format: string | null | undefined) {
  const normalized = format?.toLowerCase();
  if (normalized === 'jpeg' || normalized === 'jpg') return '.jpg';
  if (normalized === 'webp') return '.webp';
  if (normalized === 'gif') return '.gif';
  return '.png';
}

function mimeTypeFromExtension(filePath: string) {
  const extension = extname(filePath).toLowerCase();
  if (extension === '.png') return 'image/png';
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  if (extension === '.webp') return 'image/webp';
  if (extension === '.gif') return 'image/gif';
  return 'image/png';
}

async function persistGeneratedImage(req: NextRequest, buffer: Buffer, filename: string) {
  const generatedDir = join(process.cwd(), 'public', 'generated');
  await mkdir(generatedDir, { recursive: true });
  await writeFile(join(generatedDir, filename), buffer);
  return buildAbsoluteGeneratedUrl(req, filename);
}

async function fetchImageSourceAsDataUrl(source: string): Promise<string> {
  const trimmedSource = source.trim();
  const dataUrlMatch = trimmedSource.match(/^data:(.+?);base64,(.+)$/);

  if (dataUrlMatch) {
    return trimmedSource;
  }

  const localPath = (() => {
    if (trimmedSource.startsWith('/uploads/') || trimmedSource.startsWith('/generated/')) {
      return join(process.cwd(), 'public', trimmedSource.replace(/^\//, ''));
    }

    try {
      const parsed = new URL(trimmedSource);
      if (parsed.pathname.startsWith('/uploads/') || parsed.pathname.startsWith('/generated/')) {
        return join(process.cwd(), 'public', parsed.pathname.replace(/^\//, ''));
      }
    } catch {
      // Fall back to network fetch below.
    }

    return null;
  })();

  if (localPath) {
    const buffer = await readFile(localPath);
    return `data:${mimeTypeFromExtension(localPath)};base64,${buffer.toString('base64')}`;
  }

  const response = await fetch(trimmedSource);
  if (!response.ok) {
    throw new Error(`Failed to fetch reference image: ${response.status} ${response.statusText}`);
  }

  const mimeType = response.headers.get('content-type') || 'image/png';
  const buffer = Buffer.from(await response.arrayBuffer());
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

async function fetchImageSourceAsInlineData(source: string): Promise<GeminiInlineDataPart> {
  const dataUrl = await fetchImageSourceAsDataUrl(source);
  const dataUrlMatch = dataUrl.match(/^data:(.+?);base64,(.+)$/);

  if (dataUrlMatch) {
    return {
      inlineData: {
        mimeType: dataUrlMatch[1],
        data: dataUrlMatch[2],
      },
    };
  }

  throw new Error('Failed to convert reference image to inline data.');
}

async function persistFalImageResult(
  req: NextRequest,
  images: Array<{ b64_json?: string; content_type?: string; url?: string }>,
) {
  const persisted: { url: string }[] = [];

  await Promise.all(
    images.map(async (item, index) => {
      try {
        let buffer: Buffer | null = null;
        let extension = extensionFromMimeType(item.content_type || 'image/png');

        if (item.url) {
          const resImg = await fetch(item.url);
          if (!resImg.ok) {
            throw new Error(`Failed to fetch image: ${resImg.statusText}`);
          }

          buffer = Buffer.from(await resImg.arrayBuffer());
          extension = extname(new URL(item.url).pathname) || extension;
        } else if (item.b64_json) {
          buffer = Buffer.from(item.b64_json, 'base64');
        }

        if (!buffer) {
          return;
        }

        const filename = `fal_${Date.now()}_${index}${extension}`;
        persisted.push({ url: await persistGeneratedImage(req, buffer, filename) });
      } catch (err) {
        console.error('Failed to persist Fal image', err);
      }
    }),
  );

  return persisted;
}

async function buildFalImageRequest(
  model: string,
  params: {
    batchSize: number;
    falImageSettings?: FalImageSettings;
    height: number;
    inputImages: string[];
    prompt: string;
    width: number;
  },
) {
  if (!isFalImageModelId(model)) {
    return null;
  }

  const config = getFalImageModelConfig(model);
  const safeBatchSize = clampFalImageBatchSize(model, params.batchSize);
  const aspectRatio = getClosestFalImageAspectRatio(params.width, params.height);
  const normalizedImages = await Promise.all(params.inputImages.map((source) => fetchImageSourceAsDataUrl(source)));

  if (model === 'seedream-v4') {
    return {
      endpoint: normalizedImages.length > 0 ? config.editEndpoint! : config.textEndpoint,
      payload: {
        prompt: params.prompt,
        image_size: {
          width: params.width,
          height: params.height,
        },
        num_images: safeBatchSize,
        max_images: 1,
        enable_safety_checker: true,
        enhance_prompt_mode: 'standard',
        ...(normalizedImages.length > 0 ? { image_urls: normalizedImages.slice(-10) } : {}),
      },
    };
  }

  if (model === 'flux-kontext-pro') {
    return {
      endpoint: normalizedImages.length > 0 ? config.editEndpoint! : config.textEndpoint,
      payload: {
        prompt: params.prompt,
        num_images: safeBatchSize,
        output_format: 'jpeg',
        safety_tolerance: '2',
        enhance_prompt: false,
        aspect_ratio: aspectRatio,
        ...(normalizedImages.length > 0 ? { image_url: normalizedImages[0] } : {}),
      },
    };
  }

  if (model === 'nano-banana') {
    return {
      endpoint: normalizedImages.length > 0 ? config.editEndpoint! : config.textEndpoint,
      payload: {
        prompt: params.prompt,
        num_images: safeBatchSize,
        aspect_ratio: aspectRatio,
        output_format: 'png',
        safety_tolerance: '4',
        sync_mode: false,
        limit_generations: false,
        ...(normalizedImages.length > 0 ? { image_urls: normalizedImages.slice(-10) } : {}),
      },
    };
  }

  if (model === 'qwen-image-edit-2511') {
    const settings = params.falImageSettings?.qwenImageEdit2511;
    return {
      endpoint: config.editEndpoint!,
      payload: {
        prompt: params.prompt,
        negative_prompt: settings?.negativePrompt || '',
        image_size: {
          width: params.width,
          height: params.height,
        },
        image_urls: normalizedImages,
        num_inference_steps: settings?.numInferenceSteps ?? 28,
        guidance_scale: settings?.guidanceScale ?? 4.5,
        num_images: safeBatchSize,
        enable_safety_checker: settings?.enableSafetyChecker ?? true,
        output_format: settings?.outputFormat ?? 'png',
        acceleration: settings?.acceleration ?? 'regular',
        ...(typeof settings?.seed === 'number' ? { seed: settings.seed } : {}),
      },
    };
  }

  if (model === 'qwen-image-edit-2511-lora') {
    const settings = params.falImageSettings?.qwenImageEdit2511;
    const loras = (params.falImageSettings?.qwenImageEdit2511Loras || []).slice(0, 3);
    return {
      endpoint: config.editEndpoint!,
      payload: {
        prompt: params.prompt,
        negative_prompt: settings?.negativePrompt || '',
        image_size: {
          width: params.width,
          height: params.height,
        },
        image_urls: normalizedImages,
        num_inference_steps: settings?.numInferenceSteps ?? 28,
        guidance_scale: settings?.guidanceScale ?? 4.5,
        num_images: safeBatchSize,
        enable_safety_checker: settings?.enableSafetyChecker ?? true,
        output_format: settings?.outputFormat ?? 'png',
        acceleration: settings?.acceleration ?? 'regular',
        loras: loras.map((item) => ({
          path: item.path,
          scale: item.scale,
        })),
        ...(typeof settings?.seed === 'number' ? { seed: settings.seed } : {}),
      },
    };
  }

  if (model === 'qwen-image-edit-2511-multiple-angles') {
    const settings = params.falImageSettings?.qwenImageEdit2511MultipleAngles;
    return {
      endpoint: config.editEndpoint!,
      payload: {
        image_urls: normalizedImages.slice(0, 1),
        horizontal_angle: settings?.horizontalAngle ?? 0,
        vertical_angle: settings?.verticalAngle ?? 0,
        zoom: settings?.zoom ?? 5,
        additional_prompt: params.prompt || undefined,
        lora_scale: settings?.loraScale ?? 1,
        image_size: {
          width: params.width,
          height: params.height,
        },
        guidance_scale: settings?.guidanceScale ?? 4.5,
        num_inference_steps: settings?.numInferenceSteps ?? 28,
        acceleration: settings?.acceleration ?? 'regular',
        negative_prompt: settings?.negativePrompt || '',
        enable_safety_checker: settings?.enableSafetyChecker ?? true,
        output_format: settings?.outputFormat ?? 'png',
        num_images: safeBatchSize,
        ...(typeof settings?.seed === 'number' ? { seed: settings.seed } : {}),
      },
    };
  }

  if (model === 'qwen-image-2-edit' || model === 'qwen-image-2-pro-edit') {
    const settings = params.falImageSettings?.qwenImage2Edit;
    return {
      endpoint: config.editEndpoint!,
      payload: {
        prompt: params.prompt,
        negative_prompt: settings?.negativePrompt || '',
        image_size: {
          width: params.width,
          height: params.height,
        },
        enable_prompt_expansion: settings?.enablePromptExpansion ?? true,
        enable_safety_checker: settings?.enableSafetyChecker ?? true,
        num_images: safeBatchSize,
        output_format: settings?.outputFormat ?? 'png',
        image_urls: normalizedImages.slice(0, 3),
        ...(typeof settings?.seed === 'number' ? { seed: settings.seed } : {}),
      },
    };
  }

  return {
    endpoint: normalizedImages.length > 0 ? config.editEndpoint! : config.textEndpoint,
    payload: {
      prompt: params.prompt,
      image_size: {
        width: params.width,
        height: params.height,
      },
      num_images: safeBatchSize,
      enable_safety_checker: true,
      output_format: 'png',
      use_turbo: true,
      ...(normalizedImages.length > 0 ? { image_url: normalizedImages[0] } : {}),
    },
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as GenerateBody;
    const { prompt, width, height, batchSize, model, quality, inputImages = [], falImageSettings } = body;
    const allowsEmptyPrompt = model === 'qwen-image-edit-2511-multiple-angles';

    if ((!prompt && !allowsEmptyPrompt) || !model) {
      return NextResponse.json({ error: 'Missing prompt or model' }, { status: 400 });
    }

    if (model === 'qwen-image-edit-2511' && inputImages.length === 0) {
      return NextResponse.json({ error: 'Qwen Image Edit 2511 requires at least one reference image.' }, { status: 400 });
    }

    if (model === 'qwen-image-edit-2511-lora' && inputImages.length === 0) {
      return NextResponse.json({ error: 'Qwen Image Edit 2511 LoRA requires at least one reference image.' }, { status: 400 });
    }

    if (model === 'qwen-image-edit-2511-lora' && (falImageSettings?.qwenImageEdit2511Loras.length || 0) === 0) {
      return NextResponse.json({ error: 'Qwen Image Edit 2511 LoRA requires at least one selected LoRA.' }, { status: 400 });
    }

    if (model === 'qwen-image-edit-2511-lora' && (falImageSettings?.qwenImageEdit2511Loras.length || 0) > 3) {
      return NextResponse.json({ error: 'Qwen Image Edit 2511 LoRA accepts at most 3 LoRAs.' }, { status: 400 });
    }

    if (model === 'qwen-image-edit-2511-multiple-angles' && inputImages.length !== 1) {
      return NextResponse.json({ error: 'Qwen Image Edit 2511 Multiple Angles requires exactly one reference image.' }, { status: 400 });
    }

    if (
      (model === 'qwen-image-2-edit' || model === 'qwen-image-2-pro-edit')
      && (inputImages.length < 1 || inputImages.length > 3)
    ) {
      return NextResponse.json({ error: 'Qwen Image 2 edit models require between 1 and 3 reference images.' }, { status: 400 });
    }

    if (isOpenAiImageModel(model)) {
      const apiKey = process.env.OPENAI_API_KEY;
      const base = process.env.OPENAI_API_BASE || 'https://api.openai.com/v1';

      if (!apiKey) {
        return NextResponse.json({ error: 'Missing OPENAI_API_KEY' }, { status: 500 });
      }

      const payload: {
        images?: OpenAiImageReference[];
        model: string;
        n: number;
        prompt: string;
        quality: string;
        size: string;
      } = {
        model,
        prompt,
        n: batchSize || 1,
        quality,
        size: `${width}x${height}`,
      };

      const endpoint = inputImages.length > 0 ? '/images/edits' : '/images/generations';
      if (inputImages.length > 0) {
        payload.images = await Promise.all(
          inputImages.map(async (source) => ({
            image_url: await fetchImageSourceAsDataUrl(source),
          })),
        );
      }

      const response = await axios.post(`${base}${endpoint}`, payload, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      const result = response.data;
      if (Array.isArray(result?.data)) {
        await Promise.all(
          result.data.map(async (item: { b64_json?: string; url?: string }, index: number) => {
            try {
              let buffer: Buffer | null = null;
              let extension = extensionFromImageFormat(result?.output_format);

              if (item?.url) {
                const resImg = await fetch(item.url);
                if (!resImg.ok) {
                  throw new Error(`Failed to fetch image: ${resImg.statusText}`);
                }

                buffer = Buffer.from(await resImg.arrayBuffer());
                extension = extname(new URL(item.url).pathname) || extension;
              } else if (item?.b64_json) {
                buffer = Buffer.from(item.b64_json, 'base64');
              }

              if (!buffer) {
                return;
              }

              const filename = `img_${Date.now()}_${index}${extension}`;
              item.url = await persistGeneratedImage(req, buffer, filename);
              delete item.b64_json;
            } catch (err) {
              console.error('Failed to persist generated image', err);
            }
          }),
        );
      }

      return NextResponse.json(result);
    }

    if (isGeminiImageModel(model)) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return NextResponse.json({ error: 'Missing GEMINI_API_KEY' }, { status: 500 });
      }

      const ai = new GoogleGenAI({ apiKey });
      const aspectRatio = getClosestGeminiAspectRatio(width, height);
      const referenceParts = await Promise.all(inputImages.map((source) => fetchImageSourceAsInlineData(source)));
      const safeBatchSize = Math.max(1, Math.min(Number(batchSize) || 1, 8));
      const persistedImages: { aspectRatio: string; url: string }[] = [];

      for (let index = 0; index < safeBatchSize; index += 1) {
        const response = await ai.models.generateContent({
          model,
          contents: [
            { text: prompt },
            ...referenceParts,
          ],
          config: {
            responseModalities: ['Image'],
            imageConfig: {
              aspectRatio,
            },
          },
        });

        const parts = response.candidates?.[0]?.content?.parts ?? [];
        const imageParts = parts.filter((part) => part.inlineData?.data);

        if (imageParts.length === 0) {
          const textFallback = parts
            .map((part) => part.text?.trim())
            .filter((value): value is string => Boolean(value))
            .join(' ');

          throw new Error(textFallback || 'Gemini returned no image data.');
        }

        for (let imageIndex = 0; imageIndex < imageParts.length; imageIndex += 1) {
          const part = imageParts[imageIndex];
          const mimeType = part.inlineData?.mimeType || 'image/png';
          const buffer = Buffer.from(part.inlineData?.data || '', 'base64');
          const extension = extensionFromMimeType(mimeType);
          const filename = `gemini_${Date.now()}_${index}_${imageIndex}${extension}`;
          const url = await persistGeneratedImage(req, buffer, filename);
          persistedImages.push({ url, aspectRatio });
        }
      }

      return NextResponse.json({
        data: persistedImages,
        meta: {
          aspectRatio,
          provider: 'gemini',
        },
      });
    }

    if (isSelfHostImageModelId(model)) {
      const selfHostBase = process.env.SELF_HOST_INFERENCE_BASE || 'http://localhost:8000';
      const normalizedImages = await Promise.all(inputImages.map((source) => fetchImageSourceAsDataUrl(source)));
      const response = await axios.post(
        `${selfHostBase}/api/generate`,
        {
          prompt,
          width,
          height,
          batchSize,
          model,
          quality,
          inputImages: normalizedImages,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 1000 * 60 * 10,
        },
      );

      const images = Array.isArray(response.data?.data)
        ? response.data.data.map((item: { b64_json?: string; content_type?: string; url?: string }) => ({
            ...item,
            url: item.url ? new URL(item.url, selfHostBase).toString() : item.url,
          }))
        : [];

      if (images.length === 0) {
        throw new Error('Self-host server did not return any images.');
      }

      return NextResponse.json({
        data: await persistFalImageResult(req, images),
        meta: {
          provider: 'selfhost',
          model,
        },
      });
    }

    const falRequest = await buildFalImageRequest(model, {
      prompt,
      width,
      height,
      batchSize,
      inputImages,
      falImageSettings,
    });

    if (falRequest) {
      const falKey = process.env.FAL_KEY;
      if (!falKey) {
        return NextResponse.json({ error: 'Missing FAL_KEY' }, { status: 500 });
      }

      const response = await axios.post(`https://fal.run/${falRequest.endpoint}`, falRequest.payload, {
        headers: {
          Authorization: `Key ${falKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 1000 * 60 * 10,
      });

      const images = Array.isArray(response.data?.images) ? response.data.images : [];
      if (images.length === 0) {
        throw new Error('Fal did not return any images.');
      }

      return NextResponse.json({
        data: await persistFalImageResult(req, images),
        meta: {
          provider: 'fal',
          model,
        },
      });
    }

    if (model === 'a2e') {
      const token = process.env.A2E_API_KEY;
      const base = process.env.A2E_API_BASE || 'https://video.a2e.ai/api/v1';

      if (!token) {
        return NextResponse.json({ error: 'Missing A2E_API_KEY' }, { status: 500 });
      }

      const now = new Date();
      const name = now.toLocaleString('en-GB').replace(/\//g, '-');
      const payload = {
        name,
        prompt,
        width,
        height,
        model_type: model,
        input_images: inputImages,
      };

      const startRes = await axios.post(`${base}/userText2Image/start`, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const startData = startRes.data;
      let taskId: string | undefined;

      if (startData?.data) {
        if (typeof startData.data === 'string') {
          taskId = startData.data;
        } else if (startData.data._id) {
          taskId = startData.data._id;
        } else if (startData.data.id) {
          taskId = startData.data.id;
        } else if (startData.data.task_id) {
          taskId = startData.data.task_id;
        }
      }

      if (!taskId) {
        return NextResponse.json(startRes.data);
      }

      const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
      let images: string[] = [];

      for (let attempt = 0; attempt < 30; attempt += 1) {
        try {
          const detailRes = await axios.get(`${base}/userText2Image/${taskId}`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          const detail = detailRes.data;
          let found: string[] = [];

          if (detail?.data) {
            const detailData = detail.data;
            if (detailData.output?.images && Array.isArray(detailData.output.images)) {
              found = detailData.output.images;
            } else if (Array.isArray(detailData.images)) {
              found = detailData.images;
            } else if (Array.isArray(detailData.urls)) {
              found = detailData.urls;
            }
          }

          if (found.length > 0) {
            images = found;
            break;
          }
        } catch {
          // Ignore transient polling failures.
        }

        await sleep(2000);
      }

      const result: { code: number; data: { id: string; images?: string[] }; message: string } = {
        code: 0,
        message: 'Task created successfully',
        data: { id: taskId },
      };

      if (images.length > 0) {
        const persisted: string[] = [];
        await Promise.all(
          images.map(async (imgUrl, idx) => {
            try {
              const resImg = await fetch(imgUrl);
              if (!resImg.ok) {
                return;
              }

              const buffer = Buffer.from(await resImg.arrayBuffer());
              const extension = extname(new URL(imgUrl).pathname) || '.png';
              const filename = `a2e_${taskId}_${idx}${extension}`;
              persisted.push(await persistGeneratedImage(req, buffer, filename));
            } catch {
              // Ignore individual save failures.
            }
          }),
        );

        result.data.images = persisted;
      }

      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Unsupported model' }, { status: 400 });
  } catch (err: unknown) {
    console.error(err);
    const details = axios.isAxiosError(err)
      ? err.response?.data?.error?.message
        ?? err.response?.data?.error
        ?? err.response?.data?.message
        ?? err.message
      : err instanceof Error
        ? err.message
        : 'Unknown error';
    return NextResponse.json({ error: 'Failed to generate image', details }, { status: 500 });
  }
}
