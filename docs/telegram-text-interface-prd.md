# Telegram Text Interface PRD

- Status: Draft for tomorrow
- Product area: Complementary Telegram interface
- Primary scope: Text/LLM workflow only
- Out of scope for this phase: image generation, voice generation, saving Telegram outputs to server storage

## Summary

Add a Telegram bot interface that acts as a phone-friendly companion to the existing web app. The bot will let users run the app's text-generation workflow from private chats or groups using slash commands, reply-driven input, and inline buttons.

This is not a replacement for the web UI. It is a second interface for the same text-generation capability.

## Background

The current app has a useful text-generation workflow in the browser:

- Provider selection: Gemini Direct or OpenRouter
- Optional saved system prompt
- One-shot text generation
- Output intended to become an image prompt or voice prompt later

For mobile or group usage, opening the web UI is friction-heavy. Telegram already gives us:

- slash commands
- inline keyboards
- reply-based flows
- webhook delivery for public deployments

The Telegram interface should make the text workflow reachable from a phone and from a group chat without introducing persistence requirements for generated output.

## Problem

Users need a low-friction, phone-first way to use the text-generation part of the app from Telegram, especially in groups, without opening the web UI.

## Goals

- Let a user generate text prompts from Telegram in private chat or group chat.
- Support the existing text providers:
  - Gemini Direct
  - OpenRouter
- Support choosing an existing saved system prompt as a preset.
- Use Telegram-native interaction patterns:
  - slash commands
  - inline buttons
  - replies where needed
- Keep Telegram-generated output ephemeral:
  - no saving generated text to SQLite
  - no writing generated Telegram output to files
- Be safe to expose on a public HTTPS endpoint.

## Non-Goals

- No Telegram support for image generation in this phase.
- No Telegram support for voice generation in this phase.
- No Telegram mini app / web app in this phase.
- No long-running chat memory or multi-turn agent behavior.
- No persistence of generated Telegram output.
- No admin tooling, analytics dashboard, or moderation workflow in v1.

## Product Principles

- Fast path first: a user should be able to go from command to generated text in as few taps as possible.
- Group-safe by default: the bot should not behave like a noisy full-chat listener.
- Settings should be visible and reversible from buttons.
- Output should be easy to copy and reuse manually.

## Users

### Primary user

- The app owner or team member using the bot from a phone
- Already understands the web app's text workflow
- Wants quick prompt generation in Telegram

### Secondary user

- A teammate in a shared Telegram group
- Wants to trigger prompt generation from a group context

## Supported Surfaces

### Private chat with the bot

- Fully supported in v1
- Best UX surface for guided flow

### Group / supergroup

- Supported in v1
- Flow starts from slash commands or replies to bot prompts
- Session state is per `chat_id + user_id`, not shared across the whole group

## Key Constraints

- The service is assumed to be publicly reachable over HTTPS.
- Telegram delivery should use webhooks, not polling.
- Telegram outputs do not need to be preserved on the server.
- Existing saved system prompts may still be reused as presets because they are already part of app state.

## High-Level UX

### Fast path

1. User sends `/generate cinematic jungle shrine prompt`
2. Bot uses current session settings:
   - provider
   - optional preset
   - optional OpenRouter model
3. Bot sends generated text back into the chat
4. Bot attaches inline buttons for follow-up actions

### Guided path

1. User sends `/write`
2. Bot responds with:
   - short instruction
   - `ForceReply` prompt asking for the request text
   - inline buttons for provider and preset selection
3. User replies with the actual request
4. Bot generates and returns output

## Functional Scope for V1

### Supported provider features

#### Gemini Direct

- Use the existing Gemini one-shot generation capability
- Fixed default model for v1:
  - `gemini-3.5-flash`

#### OpenRouter

- Use the existing OpenRouter one-shot generation capability
- Default route:
  - `openrouter/free`
- Quick switch options in v1:
  - `openrouter/free`
  - `openrouter/auto`
- Advanced custom slug support:
  - allowed through `/model <slug>`
  - not required through button-only flow

### Supported preset feature

- Bot can list and select saved system prompts from the existing `system_prompts` table
- Selected preset is session-scoped for Telegram flow
- Telegram output is not saved, but preset selection may reuse existing stored presets

## Slash Commands

### Required commands

- `/start`
  - Introduce the bot and explain the main flow
- `/help`
  - Show available commands and examples
- `/write`
  - Start guided prompt-generation flow
- `/generate <text>`
  - Generate immediately from inline text using current session settings
- `/provider`
  - Show inline buttons to switch provider
- `/preset`
  - Show inline buttons or paged list for saved system prompts
- `/model`
  - Show current model settings and OpenRouter quick options
- `/reset`
  - Clear ephemeral session state for the current user in the current chat
- `/status`
  - Show current session settings:
    - provider
    - preset
    - OpenRouter route/model if applicable

### Optional commands if time allows

- `/model <slug>`
  - Set a custom OpenRouter model slug directly
- `/regenerate`
  - Re-run the last request with the same settings if ephemeral session data still exists

## Inline Buttons

### Settings buttons

- `Provider: Gemini`
- `Provider: OpenRouter`
- `Preset`
- `Model`
- `Reset`

### OpenRouter model buttons

- `Free`
- `Auto`

### Output follow-up buttons

- `Regenerate`
- `Change Provider`
- `Change Preset`
- `Reset`

### Nice-to-have later

- `Copy text`
  - Telegram supports copy-text buttons, but this is not required for v1

## Group Behavior

### V1 decision

Keep privacy mode enabled unless testing proves it blocks the intended UX.

That means group interactions should rely on:

- slash commands
- replies to bot messages
- callback buttons on bot messages

This is the safer default for public groups and avoids making the bot a general-purpose listener.

If later we want the bot to react to arbitrary non-command messages in groups, privacy mode would need to be reconsidered.

## Session Model

### What must be session-scoped

- provider
- selected preset id
- OpenRouter route/model
- last request text
- last generated text
- pending step state for guided flow

### Persistence rule

- Generated Telegram outputs are not persisted to DB or filesystem
- Session state may be stored ephemerally with TTL

### Recommended storage for session state

Preferred:

- Redis or another TTL key-value store

Fallback for local development only:

- in-memory process store

Reason:

- a public Next.js deployment may run across restarts or multiple instances
- in-memory session state is too fragile for production

### TTL recommendation

- 15 to 30 minutes per chat-user session

## Technical Design

### Server architecture

Add a Telegram-specific server layer without putting Telegram logic inside the page component.

Recommended new pieces:

- `app/api/telegram/webhook/route.ts`
  - receives Telegram updates
- `lib/telegram/client.ts`
  - sendMessage, editMessageText, answerCallbackQuery, sendChatAction helpers
- `lib/telegram/router.ts`
  - update dispatch logic
- `lib/telegram/session.ts`
  - ephemeral session read/write
- `lib/text-generation.ts`
  - shared text-generation service used by:
    - web routes
    - Telegram webhook flow

### Do not duplicate provider logic

Tomorrow's implementation should extract shared text-generation logic instead of re-calling HTTP routes internally.

Preferred shared interface:

```ts
generateText({
  provider,
  model,
  systemPromptId,
  input,
}): Promise<{
  provider: 'gemini' | 'openrouter';
  model: string;
  resolvedModel?: string | null;
  systemPromptName?: string | null;
  text: string;
}>
```

### Webhook transport

Use Telegram webhooks, not `getUpdates`.

Webhook endpoint:

- `POST /api/telegram/webhook`

Security requirements:

- validate `X-Telegram-Bot-Api-Secret-Token`
- reject requests without the expected secret

Recommended `setWebhook` configuration:

- `allowed_updates` limited to only what we need, e.g.:
  - `message`
  - `callback_query`
  - optionally `my_chat_member`

## Messaging Rules

### Request collection

Use `ForceReply` for guided flows so the bot can receive the next user input cleanly even with privacy mode enabled.

### Callback handling

Every callback button press must be acknowledged with `answerCallbackQuery`, even if no visible notification is shown.

### Long output handling

Telegram `sendMessage` supports text up to 4096 characters after entities parsing. If generated text exceeds that, split it into multiple messages.

### Formatting

V1 default:

- send plain text or conservatively escaped formatting

Avoid brittle formatting bugs from unescaped model output. If formatting is introduced, use a dedicated escaping helper.

### Typing feedback

If generation takes noticeable time, use `sendChatAction` with typing status before final message delivery.

## Data Handling

### Read from existing app state

- saved system prompts from SQLite

### Do not write from Telegram flow

- no generated Telegram outputs to SQLite
- no Telegram outputs to `public/`
- no auto-save of prompts generated from Telegram

### Optional exception

- ephemeral session state with TTL is allowed

## Environment Variables

Planned additions:

```env
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
TELEGRAM_BOT_USERNAME=
TELEGRAM_PUBLIC_WEBHOOK_URL=

# Optional if using Redis/Upstash for ephemeral sessions
REDIS_URL=
REDIS_TOKEN=
```

## Bot Setup Requirements

Expected setup steps:

1. Create bot with @BotFather
2. Enable group joining if needed
3. Configure commands
4. Configure webhook to public HTTPS endpoint
5. Set webhook secret token
6. Optionally review privacy mode

## Success Criteria

V1 is successful if:

- A user can generate text in private chat with `/generate <text>`
- A user can start a guided flow with `/write`
- A user can switch provider from buttons
- A user can choose a saved preset
- A user can run the flow in a group using commands/replies
- No Telegram output is persisted to server storage

## Risks

### Public group noise

Risk:

- Bot could become noisy in groups

Mitigation:

- support commands and replies only in v1
- keep privacy mode enabled unless needed otherwise

### Session fragility

Risk:

- in-memory state breaks across restarts or multiple instances

Mitigation:

- use TTL store for production

### Formatting bugs

Risk:

- LLM text can break Telegram markdown formatting

Mitigation:

- send plain text first

### Provider latency / failures

Risk:

- Telegram UX feels broken when provider is slow

Mitigation:

- show typing indicator
- send clean error messages
- keep regenerate button available

## Tomorrow Build Plan

### Phase 1

- Extract shared text-generation service from current Gemini/OpenRouter routes
- Add Telegram env vars
- Add Telegram webhook route
- Add Telegram client helper

### Phase 2

- Implement command routing:
  - `/start`
  - `/help`
  - `/write`
  - `/generate`
  - `/provider`
  - `/preset`
  - `/model`
  - `/reset`
  - `/status`

### Phase 3

- Implement inline keyboard flows
- Implement ForceReply-based guided input
- Implement ephemeral session storage

### Phase 4

- Register webhook
- Register command list
- Manual test in:
  - private chat
  - group chat
  - callback button flow
  - provider switching

## Open Questions

- Should generated text always be posted back into the group, or should the bot encourage private-chat continuation for long outputs?
- Do we want custom OpenRouter model slug entry in v1, or is `free` and `auto` enough for tomorrow?
- Should Telegram presets mirror all saved system prompts, or only a curated subset?
- Do we want per-group default settings later, or only per-user-per-chat session settings?
- Do we need admin-only restrictions for group usage in v1?

## References

- Telegram Bot API: https://core.telegram.org/bots/api
- Telegram bot features: https://core.telegram.org/bots/features
- Telegram commands: https://core.telegram.org/api/bots/commands
