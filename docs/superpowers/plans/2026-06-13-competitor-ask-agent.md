# Competitor Ask Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `/competitor ask <competitor> "<question>"` so Slack users can ask source-backed technical questions about any tracked competitor.

**Architecture:** Keep the existing technical brief pipeline intact. Add a focused answer orchestration layer that combines stored intel, targeted Parallel Search/Extract research, and an OpenAI structured answer adapter with a deterministic fallback. Render answers as Slack Block Kit sections with evidence, inference, unknowns, confidence, and sources.

**Tech Stack:** TypeScript, Fastify, Slack Block Kit, Parallel Search/Extract API, OpenAI Responses API structured outputs, Vitest.

---

## Research Notes

- Slack slash commands send the full command text to the app, and usage hints should stay short because Slack may truncate them.
- Slack Block Kit messages have block count and text-size constraints. Answers must be summarized and chunked.
- Slack now has a `markdown` block for AI-generated markdown, but the safer cross-client path is still structured `section` blocks with `mrkdwn`.
- Parallel Search returns ranked LLM-oriented excerpts from a natural-language objective and optional search queries.
- Parallel Extract returns objective-aligned clean markdown/excerpts from URLs, including difficult pages.
- OpenAI Responses API supports structured output via `text.format.type = "json_schema"`, which is the right fit for evidence/inference/unknown separation.

## Files

- Create: `src/technical/question-answer.ts`
- Create: `src/technical/openai-question-answer.ts`
- Create: `src/slack/question-render.ts`
- Modify: `src/types.ts`
- Modify: `src/slack/technical-control.ts`
- Modify: `src/server.ts`
- Modify: `README.md`
- Modify: `slack/app-manifest.yml`
- Test: `test/technical/question-answer.test.ts`
- Test: `test/technical/openai-question-answer.test.ts`
- Test: `test/slack/question-control.test.ts`
- Test: `test/server.test.ts`

### Task 1: Question Answer Types And Deterministic Synthesizer

- [ ] Write failing tests for deterministic answer synthesis from stored evidence and extracted pages.
- [ ] Add `CompetitorQuestionAnswer`, `QuestionAnswerCitation`, and related types.
- [ ] Implement `DeterministicQuestionAnswerer`.
- [ ] Verify targeted tests pass.
- [ ] Commit.

### Task 2: Research Orchestration

- [ ] Write failing tests proving the orchestrator builds question-specific Parallel objectives, uses existing intel, extracts pages, and returns an answer.
- [ ] Implement `answerCompetitorQuestion`.
- [ ] Limit URL extraction to relevant stored sources plus search hits.
- [ ] Verify targeted tests pass.
- [ ] Commit.

### Task 3: OpenAI Structured Answer Adapter

- [ ] Write failing tests with mocked `fetch` for successful JSON schema response and fallback on invalid/failed response.
- [ ] Implement `OpenAIQuestionAnswerer` using Responses API structured output.
- [ ] Keep hallucination guardrails: answer only from provided context, mark private architecture as unknown.
- [ ] Verify targeted tests pass.
- [ ] Commit.

### Task 4: Slack Ask Command

- [ ] Write failing tests for `/competitor ask zip.com "question"` and missing-config behavior.
- [ ] Parse competitor query and quoted/freeform question.
- [ ] Render answer with short answer, confidence, evidence, inference, unknowns, citations, and action buttons.
- [ ] Verify Slack tests pass.
- [ ] Commit.

### Task 5: Server Wiring And Docs

- [ ] Write failing server test proving slash commands pass through the configured question-answer runner.
- [ ] Wire Parallel and optional OpenAI into the production server.
- [ ] Update README and Slack manifest usage hints.
- [ ] Run full verification: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.
- [ ] Commit, push, PR, merge, and verify Cloud Run.
