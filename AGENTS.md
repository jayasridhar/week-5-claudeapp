# Codex Instructions

Read ALL of these files before doing anything else:
- @skills/rules/rules.md
- @knowledge/design-system.md
- @knowledge/azure-endpoint.md
- @skills/implementation/implementation.md
- @skills/create-spec/reference/database-spec-template.md
- @skills/create-spec/reference/auth-spec-template.md
- @skills/create-spec/reference/chat-spec-template.md
- @skills/create-spec/reference/dashboard-spec-template.md
- @skills/create-spec/reference/file-upload-spec-template.md
- @skills/create-spec/reference/feedback-spec-template.md

## Current State

- PRD: complete in PRD.md (sections: Problem, Solution, Functional Requirements, Roadmap, Risks, Evaluations, Responsible AI, Pricing, Open Questions, Assumptions)
- Database schema: @skills/create-spec/reference/database-spec-template.md
- Implementation: not started — project is a bare Next.js + TypeScript scaffold
- Design system: @knowledge/design-system.md
- Azure endpoint: @knowledge/azure-endpoint.md (fill in env vars before running)

## Session Flow

1. ~~Use @skills/specs/specs.md to generate all feature specs~~ — DONE
2. ~~Generate plan~~ — DONE
3. Use @skills/implementation/implementation.md to build the app
   - Follow phases in order (Phase 1 through 9)
   - Always read @knowledge/design-system.md before writing any UI code
4. Test all flows after implementation

## Key References

| File | Purpose |
|---|---|
| @skills/rules/rules.md | Tech stack and hard rules |
| @knowledge/design-system.md | All colors, fonts, dimensions, component specs |
| @knowledge/azure-endpoint.md | Azure AI client setup and /api/chat implementation |
| @skills/implementation/implementation.md | Phased build plan — follow exactly |
| @skills/create-spec/reference/database-spec-template.md | Database schema (users, sessions, messages, feedback) |
| @skills/create-spec/reference/auth-spec-template.md | Auth feature spec |
| @skills/create-spec/reference/chat-spec-template.md | Chat feature spec |
| @skills/create-spec/reference/dashboard-spec-template.md | Dashboard feature spec |
| @skills/create-spec/reference/file-upload-spec-template.md | File upload feature spec |
| @skills/create-spec/reference/feedback-spec-template.md | Feedback feature spec |

## Before Starting Implementation

Confirm these are ready:
- [ ] Supabase project URL and anon key (for .env)
- [ ] All credentials stored in .env file — never commit to source control

