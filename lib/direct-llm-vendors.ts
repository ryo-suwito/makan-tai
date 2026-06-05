import { GoogleGenAI } from '@google/genai';

export type DirectLlmVendorSlug = 'gemini' | 'mimo' | 'deepseek';
export type DirectLlmFieldType = 'text' | 'password' | 'number' | 'boolean' | 'select' | 'textarea';

export interface DirectLlmFieldConfig {
  defaultValue?: unknown;
  label: string;
  name: string;
  required?: boolean;
  secret?: boolean;
  type: DirectLlmFieldType;
}

export interface DirectLlmVendorConfig {
  authFields: DirectLlmFieldConfig[];
  defaultModel: string;
  enabled: boolean;
  fields: DirectLlmFieldConfig[];
  label: string;
  modelList?: {
    authHeader: 'api-key' | 'authorization-bearer';
    endpoint: string;
  };
  models: DirectLlmModelOption[];
  slug: DirectLlmVendorSlug;
}

export interface GenerateDirectLlmTextParams {
  input: string;
  model?: string | null;
  slug: DirectLlmVendorSlug;
  systemInstruction?: string | null;
}

export interface GenerateDirectLlmTextResult {
  model: string;
  provider: DirectLlmVendorSlug;
  resolvedModel: string | null;
  text: string;
}

export interface DirectLlmModelOption {
  contextLength?: number | null;
  label: string;
  maxOutputTokens?: number | null;
  value: string;
}

interface OpenAiCompatibleChatResponse {
  choices?: Array<{
    message?: {
      content?: string | Array<{ text?: string; type?: string }>;
    };
  }>;
  error?: {
    message?: string;
  };
  model?: string;
}

interface OpenAiCompatibleModelsResponse {
  data?: Array<{
    context_length?: number;
    id?: string;
    name?: string;
  }>;
}

export const DIRECT_LLM_VENDOR_CONFIGS: Record<DirectLlmVendorSlug, DirectLlmVendorConfig> = {
  gemini: {
    slug: 'gemini',
    label: 'Gemini Direct',
    enabled: true,
    defaultModel: 'gemini-3.5-flash',
    authFields: [
      {
        name: 'key',
        label: 'API key',
        type: 'password',
        required: true,
        secret: true,
      },
    ],
    fields: [
      {
        name: 'model',
        label: 'Model',
        type: 'text',
        required: true,
        defaultValue: 'gemini-3.5-flash',
      },
      {
        name: 'temperature',
        label: 'Temperature',
        type: 'number',
        defaultValue: 0.7,
      },
    ],
    models: [
      {
        value: 'gemini-3.5-flash',
        label: 'Gemini 3.5 Flash',
        contextLength: null,
        maxOutputTokens: null,
      },
    ],
  },
  mimo: {
    slug: 'mimo',
    label: 'Xiaomi MiMo',
    enabled: true,
    defaultModel: 'mimo-v2.5-pro',
    authFields: [
      {
        name: 'key',
        label: 'API key',
        type: 'password',
        required: true,
        secret: true,
      },
    ],
    fields: [
      {
        name: 'model',
        label: 'Model',
        type: 'select',
        required: true,
        defaultValue: 'mimo-v2.5-pro',
      },
      {
        name: 'temperature',
        label: 'Temperature',
        type: 'number',
        defaultValue: 1.0,
      },
      {
        name: 'top_p',
        label: 'Top P',
        type: 'number',
        defaultValue: 0.95,
      },
      {
        name: 'max_completion_tokens',
        label: 'Max completion tokens',
        type: 'number',
        defaultValue: 1024,
      },
    ],
    modelList: {
      endpoint: 'https://api.xiaomimimo.com/v1/models',
      authHeader: 'api-key',
    },
    models: [
      {
        value: 'mimo-v2.5-pro',
        label: 'MiMo V2.5 Pro',
        contextLength: 1048576,
        maxOutputTokens: 131072,
      },
      {
        value: 'mimo-v2.5',
        label: 'MiMo V2.5',
        contextLength: 1048576,
        maxOutputTokens: 131072,
      },
      {
        value: 'mimo-v2-flash',
        label: 'MiMo V2 Flash',
        contextLength: 262144,
        maxOutputTokens: 65536,
      },
      {
        value: 'mimo-v2-pro',
        label: 'MiMo V2 Pro',
        contextLength: 1048576,
        maxOutputTokens: 131072,
      },
      {
        value: 'mimo-v2-omni',
        label: 'MiMo V2 Omni',
        contextLength: 262144,
        maxOutputTokens: 131072,
      },
    ],
  },
  deepseek: {
    slug: 'deepseek',
    label: 'DeepSeek',
    enabled: true,
    defaultModel: 'deepseek-v4-flash',
    authFields: [
      {
        name: 'key',
        label: 'API key',
        type: 'password',
        required: true,
        secret: true,
      },
    ],
    fields: [
      {
        name: 'model',
        label: 'Model',
        type: 'select',
        required: true,
        defaultValue: 'deepseek-v4-flash',
      },
      {
        name: 'temperature',
        label: 'Temperature',
        type: 'number',
        defaultValue: 1.0,
      },
      {
        name: 'top_p',
        label: 'Top P',
        type: 'number',
        defaultValue: 1.0,
      },
      {
        name: 'max_tokens',
        label: 'Max tokens',
        type: 'number',
        defaultValue: 1024,
      },
    ],
    modelList: {
      endpoint: 'https://api.deepseek.com/models',
      authHeader: 'authorization-bearer',
    },
    models: [
      {
        value: 'deepseek-v4-flash',
        label: 'DeepSeek V4 Flash',
        contextLength: 1048576,
        maxOutputTokens: 393216,
      },
      {
        value: 'deepseek-v4-pro',
        label: 'DeepSeek V4 Pro',
        contextLength: 1048576,
        maxOutputTokens: 393216,
      },
      {
        value: 'deepseek-chat',
        label: 'DeepSeek Chat (legacy non-thinking)',
        contextLength: 1048576,
        maxOutputTokens: 393216,
      },
    ],
  },
};

export function getDirectLlmVendorEnvKey(slug: string) {
  return `${slug.replace(/_/g, '').toUpperCase()}_KEY`;
}

export function getDirectLlmVendorSecret(slug: DirectLlmVendorSlug) {
  return process.env[getDirectLlmVendorEnvKey(slug)];
}

export function getDirectLlmVendorConfig(slug: DirectLlmVendorSlug) {
  return DIRECT_LLM_VENDOR_CONFIGS[slug];
}

function getFieldDefault<T>(config: DirectLlmVendorConfig, name: string, fallback: T) {
  const field = config.fields.find((item) => item.name === name);
  return (field?.defaultValue ?? fallback) as T;
}

function getAuthHeaders(config: DirectLlmVendorConfig, apiKey: string) {
  const authHeader = config.modelList?.authHeader;
  if (authHeader === 'authorization-bearer') {
    return { Authorization: `Bearer ${apiKey}` };
  }

  return { 'api-key': apiKey };
}

function extractOpenAiCompatibleText(content: OpenAiCompatibleChatResponse['choices'][number]['message']['content']) {
  if (typeof content === 'string') {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => item?.text?.trim())
      .filter((value): value is string => Boolean(value))
      .join('\n')
      .trim();
  }

  return '';
}

function normalizeDirectModels(models: DirectLlmModelOption[]) {
  const seen = new Set<string>();
  return models.filter((model) => {
    const value = model.value.trim();
    if (!value || seen.has(value)) {
      return false;
    }
    seen.add(value);
    return true;
  });
}

export async function listDirectLlmModels(slug: DirectLlmVendorSlug) {
  const config = getDirectLlmVendorConfig(slug);
  const apiKey = getDirectLlmVendorSecret(config.slug);

  if (!apiKey || !config.modelList) {
    return config.models;
  }

  try {
    const response = await fetch(config.modelList.endpoint, {
      headers: getAuthHeaders(config, apiKey),
      cache: 'no-store',
    });
    const data = (await response.json().catch(() => ({}))) as OpenAiCompatibleModelsResponse;
    if (!response.ok || !Array.isArray(data.data)) {
      return config.models;
    }

    const remoteModels = data.data
      .filter((item) => item?.id)
      .map((item) => ({
        value: item.id as string,
        label: item.name || item.id as string,
        contextLength: item.context_length ?? null,
        maxOutputTokens: null,
      }));

    return normalizeDirectModels([...remoteModels, ...config.models]);
  } catch {
    return config.models;
  }
}

export async function generateDirectLlmText(params: GenerateDirectLlmTextParams): Promise<GenerateDirectLlmTextResult> {
  const config = getDirectLlmVendorConfig(params.slug);
  const apiKey = getDirectLlmVendorSecret(config.slug);

  if (!apiKey) {
    throw new Error(`Missing ${getDirectLlmVendorEnvKey(config.slug)}`);
  }

  if (config.slug === 'gemini') {
    const model = params.model?.trim() || getFieldDefault(config, 'model', config.defaultModel);
    const temperature = getFieldDefault(config, 'temperature', 0.7);
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model,
      contents: params.input,
      config: {
        systemInstruction: params.systemInstruction?.trim() || undefined,
        temperature,
      },
    });

    return {
      text: response.text ?? '',
      model,
      provider: config.slug,
      resolvedModel: null,
    };
  }

  if (config.slug === 'mimo') {
    const model = params.model?.trim() || getFieldDefault(config, 'model', config.defaultModel);
    const temperature = getFieldDefault(config, 'temperature', 1.0);
    const topP = getFieldDefault(config, 'top_p', 0.95);
    const maxCompletionTokens = getFieldDefault(config, 'max_completion_tokens', 1024);
    const messages = [
      ...(params.systemInstruction?.trim()
        ? [{ role: 'system', content: params.systemInstruction.trim() }]
        : []),
      { role: 'user', content: params.input },
    ];
    const response = await fetch('https://api.xiaomimimo.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        ...getAuthHeaders(config, apiKey),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        max_completion_tokens: maxCompletionTokens,
        temperature,
        top_p: topP,
        stream: false,
        stop: null,
        frequency_penalty: 0,
        presence_penalty: 0,
      }),
    });

    const data = (await response.json().catch(() => ({}))) as OpenAiCompatibleChatResponse;
    if (!response.ok) {
      throw new Error(data.error?.message || 'MiMo request failed.');
    }

    return {
      text: extractOpenAiCompatibleText(data.choices?.[0]?.message?.content),
      model,
      provider: config.slug,
      resolvedModel: data.model || null,
    };
  }

  if (config.slug === 'deepseek') {
    const model = params.model?.trim() || getFieldDefault(config, 'model', config.defaultModel);
    const temperature = getFieldDefault(config, 'temperature', 1.0);
    const topP = getFieldDefault(config, 'top_p', 1.0);
    const maxTokens = getFieldDefault(config, 'max_tokens', 1024);
    const messages = [
      ...(params.systemInstruction?.trim()
        ? [{ role: 'system', content: params.systemInstruction.trim() }]
        : []),
      { role: 'user', content: params.input },
    ];
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        ...getAuthHeaders(config, apiKey),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        thinking: { type: 'disabled' },
        max_tokens: maxTokens,
        temperature,
        top_p: topP,
        stream: false,
      }),
    });

    const data = (await response.json().catch(() => ({}))) as OpenAiCompatibleChatResponse;
    if (!response.ok) {
      throw new Error(data.error?.message || 'DeepSeek request failed.');
    }

    return {
      text: extractOpenAiCompatibleText(data.choices?.[0]?.message?.content),
      model,
      provider: config.slug,
      resolvedModel: data.model || null,
    };
  }

  throw new Error(`Unsupported direct LLM vendor: ${config.slug}`);
}
