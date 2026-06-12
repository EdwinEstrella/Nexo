# Skill Registry

Generated for SDD bootstrap.

## Project Conventions

| Source | Path | Notes |
| --- | --- | --- |
| Project instructions | `AGENTS.md` | Repo-level operating rules, language/tone, and SDD orchestration constraints. |
| Project guidance | `CLAUDE.md` | Claude-specific skill index and project conventions. |
| Project memory | `MEMORY.md` | Historical context and prior decisions (not modified by this init). |

## Detected Project Skills

| Skill | Scope | Trigger / Description | Path |
| --- | --- | --- | --- |
| accessibility | project | Audit and improve web accessibility following WCAG 2.2 guidelines. | `.agents/skills/accessibility/SKILL.md` |
| frontend-design | project | Create distinctive, production-grade frontend interfaces with high design quality. | `.agents/skills/frontend-design/SKILL.md` |
| nodejs-backend-patterns | project | Build production-ready Node.js backend services with Express/Fastify and best practices. | `.agents/skills/nodejs-backend-patterns/SKILL.md` |
| nodejs-best-practices | project | Node.js development principles and decision-making. | `.agents/skills/nodejs-best-practices/SKILL.md` |
| seo | project | Optimize for search engine visibility and ranking. | `.agents/skills/seo/SKILL.md` |

## Notes

- `sdd-*`, `_shared`, and `skill-registry` entries were excluded from this index.
- No project-local `.codex/skills/`, `.qwen/skills/`, `.kiro/skills/`, `.openclaw/skills/`, `.pi/skills/`, or `.agent/skills/` directories were detected.
- This registry is an index for future delegated work; subagents should load the exact skill paths above.
