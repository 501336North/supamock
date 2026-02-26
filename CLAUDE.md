# Project Development Guide

This project uses OSS Dev Workflow for world-class software delivery.

## Development Commands

- `/oss:ideate` - Design and plan features
- `/oss:plan` - Create TDD implementation plans
- `/oss:build` - Execute plans with TDD
- `/oss:ship` - Quality check, commit, PR

## Agent Delegation (MANDATORY)

**ALWAYS delegate specialized work to the appropriate agent using the Task tool.**

When implementing code, use these specialized agents:

| Technology | Agent (`subagent_type`) |
|------------|-------------------------|
| React/Next.js | `nextjs-developer`, `react-specialist` |
| TypeScript | `typescript-pro` |
| Python | `python-pro` |
| Go | `golang-pro` |
| iOS/Swift | `ios-developer`, `swift-macos-expert` |
| visionOS | `visionos-developer` |
| Backend | `backend-architect` |
| Database | `database-optimizer` |
| Testing | `test-engineer`, `qa-expert` |
| Security | `security-auditor` |
| DevOps | `deployment-engineer` |
| Code Review | `code-reviewer` |

**Never write specialized code yourself when an agent exists for it.**

## Quality Standards

- All code changes require tests written FIRST (TDD)
- All tests must pass before commits
- All PRs require CI checks to pass
- Delegate to specialized agents for domain expertise

---

*Powered by [OSS Dev Workflow](https://www.oneshotship.com)*
