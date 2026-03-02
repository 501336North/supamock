# OSS Dev Workflow - Project Guidelines

> This project uses [OSS Dev Workflow](https://www.oneshotship.com) for world-class software delivery.

---

## IRON LAWS

**The IRON LAWS are injected below by `/oss:login`.** These are non-negotiable development rules that every command enforces.

If you don't see the IRON LAWS section below, run `/oss:login` to fetch and inject the latest version.

<!-- IRON LAWS START - Do not edit manually, updated by /oss:login -->

# IRON LAWS - NON-NEGOTIABLE

These laws are **NON-NEGOTIABLE**. Violating the spirit of these rules IS violating the letter.

**Enforcement Mode:** Announce + Auto-Correct (no user confirmation required)

---

## IRON LAW #1: Test-Driven Development (TDD)

```
NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST
```

**The Cycle: RED-GREEN-REFACTOR**

| Phase | Action | Verification |
|-------|--------|--------------|
| RED | Write failing test | Test MUST fail |
| GREEN | Write **MINIMAL** code | Test MUST pass |
| REFACTOR | Clean up code | Tests STILL pass |

**GREEN Phase - MINIMAL Means MINIMAL:**

```
WRITE THE ABSOLUTE MINIMUM CODE TO MAKE THE TEST PASS
```

**MINIMAL is not a suggestion - it is a requirement:**
- Write ONLY enough code to satisfy the failing test
- No "while I'm here" additions
- No gold-plating or future-proofing
- No extra features, helpers, or abstractions
- If you can pass with 3 lines, don't write 10

**Signs you're NOT writing MINIMAL code:**
- Adding error handling the test doesn't require
- Creating abstractions for "reusability"
- Adding configuration options not under test
- Implementing edge cases not yet tested
- Writing helper functions not strictly needed

**TDD Red Flags - STOP and Start Over:**
- Code written before test
- Test passes immediately (didn't see it fail)
- "I'll add tests later"
- "This is too simple to test"
- **Writing more than MINIMAL code in GREEN phase**

**Self-Correction:** If code exists without tests, DELETE IT and restart with TDD. If you wrote more than MINIMAL, delete the extras.

---

## IRON LAW #2: Test Philosophy - Behavior Over Implementation

**Before Writing ANY Test, Answer:**

| Question | Required Answer |
|----------|-----------------|
| What USER BEHAVIOR does this verify? | [Must document] |
| What BUSINESS RULE does this encode? | [Must document] |
| Would this survive a complete rewrite? | Must be YES |
| Is this readable to non-engineers? | Must be YES |

**Cannot answer these? DO NOT write the test.**

**Mock Policy (London TDD):**

| Mock This | Don't Mock This |
|-----------|-----------------|
| Service dependencies | Value objects |
| Repository interfaces | Simple data structures |
| External API clients | Pure functions |
| Collaborators | The unit under test |

**Self-Correction:** If tests mock internal modules or business logic, REMOVE the mocks and test real code.

**No `any` Types - Including Pre-Existing:**
- Finding `any` types in the codebase does NOT excuse adding more
- Pre-existing `any` types MUST be fixed before shipping
- "It was already there" is NOT a valid excuse
- Delegate to `typescript-pro` agent to fix type violations
- If you see `any`, fix it NOW - no tech debt tickets, no "later"

**Flakiness = Zero Tolerance:**
- Flaky test = broken test
- DO NOT retry hoping it passes
- EITHER fix root cause OR delete the test
- **Deleted test > flaky test**

**Common Flaky Test Causes & Fixes:**

| Cause | Fix |
|-------|-----|
| Shared test data (e.g., `test@example.com`) | Use unique data per test: `\`test-${Date.now()}@example.com\`` |
| Timing/performance assertions | Use generous thresholds or test behavior not timing |
| Race conditions in parallel tests | Ensure test isolation, use unique identifiers |
| Database state pollution | Clear all tables including new ones (check schema) |
| External service dependencies | Mock external services, never rely on real APIs in tests |

**Self-Correction:** When a flaky test is found, STOP and fix it immediately. Do not proceed with other work until the test is solid.

---

## IRON LAW #3: Loop Detection Protocol

**Agents can get stuck. Watch for these patterns:**

- Same tool called 5+ times with no progress
- Polling same resource for >60 seconds
- Same error message 3+ times
- Build/test commands hanging

**Self-Correction:**
1. Kill stuck processes (`KillShell`)
2. Switch to synchronous commands
3. Add explicit timeout
4. Summarize and ask: "Should I proceed with this assumption?"

**Never:**
- Keep polling indefinitely
- Hope the next iteration will work
- Ignore signs of being stuck

---

## IRON LAW #4: Agent Git Flow (Trunk-Based Development)

```
⛔ AGENTS NEVER TOUCH MAIN BRANCH - NO EXCEPTIONS ⛔
```

**Core Principle: Humans own main. Agents NEVER push to main directly.**

Every agent change must be: **scoped**, **observable**, and **reversible**.

---

### MANDATORY Pre-Git Check (RUN BEFORE EVERY GIT OPERATION)

```bash
# STEP 1: Check current branch FIRST
CURRENT_BRANCH=$(git branch --show-current)

# STEP 2: HARD STOP if on main
if [[ "$CURRENT_BRANCH" == "main" || "$CURRENT_BRANCH" == "master" ]]; then
    echo "⛔ IRON LAW #4 VIOLATION: On protected branch '$CURRENT_BRANCH'"
    echo "STOPPING. Must create feature branch first."
    # DO NOT PROCEED - create feature branch
fi
```

**You MUST run `git branch --show-current` and verify output BEFORE:**
- `git add`
- `git commit`
- `git push`
- ANY write operation

---

### Branch Strategy (MANDATORY)

```bash
# ALWAYS start by fetching and checking out from main
git fetch origin main
git checkout -b feat/agent-<feature>-<short-desc> origin/main

# VERIFY you are on feature branch before proceeding
git branch --show-current  # Must NOT be "main" or "master"
```

**Branch Naming Convention:**
- `feat/agent-<feature>-<short-desc>` - New features
- `fix/agent-<feature>-<short-desc>` - Bug fixes
- `chore/agent-<short-desc>` - Maintenance tasks

---

### Git Operation Sequence (STRICT ORDER)

```bash
# 1. VERIFY BRANCH (mandatory first step)
git branch --show-current
# ↳ If "main" or "master" → STOP, create feature branch

# 2. Check status
git status

# 3. Stage changes
git add <files>

# 4. Commit with conventional format
git commit -m "type(scope): description"

# 5. Push to feature branch ONLY
git push -u origin $(git branch --show-current)
# ↳ NEVER: git push origin main
```

---

### Verification Checkpoints

| Before This Action | You MUST Verify |
|-------------------|-----------------|
| `git add` | Branch is NOT main/master |
| `git commit` | Branch is NOT main/master |
| `git push` | Push target is NOT main/master |
| `git merge` | You are NOT merging INTO main |
| Any git write | `git branch --show-current` ≠ main |

---

### Git Command Best Practice

```bash
# ✅ CORRECT - Always verify branch first
git branch --show-current  # Verify NOT main
git status
git add .
git commit -m "feat: message"
git push -u origin feat/agent-my-feature

# ❌ WRONG - Skipping branch verification
git add .  # Did you check the branch first? NO!
git commit -m "feat: message"
git push origin main  # VIOLATION!

# ❌ AVOID - Using -C flag (causes permission bloat)
# Why: Each unique path creates a new approval entry in settings.local.json
# Over time this accumulates 100s of entries and can cause parser errors
# if commit messages contain patterns like `:*` (e.g., "/oss:*")
git -C /full/path/to/repo push

# ✅ CORRECT - Run from within the repo
git push  # Uses Bash(git push:*) pattern - works for all repos
```

---

### Commit Format (Conventional Commits)

```
<type>(<scope>): <subject>

<body explaining WHY and impact>

Co-Authored-By: Claude <noreply@anthropic.com>
```

---

### Self-Correction Protocol

**If you detect you are on main/master:**

```
IRON LAW #4 VIOLATION DETECTED
├─ Current branch: main
├─ Action attempted: [git add/commit/push]
└─ Status: BLOCKED

SELF-CORRECTING:
1. Stashing any uncommitted changes...
2. Creating feature branch from main...
3. Applying stashed changes to feature branch...
4. Proceeding on feature branch...
```

**Commands to recover:**
```bash
git stash
git checkout -b feat/agent-<feature>-<desc> origin/main
git stash pop
# Now safe to proceed
```

---

### PROHIBITED ACTIONS (INSTANT VIOLATION)

| Action | Why It's Forbidden | Exception |
|--------|-------------------|-----------|
| `git push origin main` | Direct push to protected branch | NONE |
| `git push origin master` | Direct push to protected branch | NONE |
| `git push --force` | Rewrites history, breaks collaboration | NONE |
| `git push -f` | Same as --force | NONE |
| `git merge <branch> main` | Merging into main without PR | NONE |
| `git checkout main && git commit` | Committing on main | NONE |
| Skip `git branch --show-current` | No verification = no safety | NONE |
| `gh pr merge` without user flag | Auto-merging without permission | `/oss:ship --merge` |

---

### PR Requirements (MANDATORY)

When creating PR via `gh pr create`:
- **Target branch**: main (PR targets main, you don't push to it)
- **Source branch**: Your feature branch
- **Human review**: REQUIRED before merge (unless `--merge` flag)
- **Auto-merge**: ONLY with explicit `--merge` flag from user

```bash
# ✅ CORRECT - PR from feature branch to main
gh pr create --base main --head feat/agent-my-feature

# ✅ CORRECT - Auto-merge when user explicitly requests it
# User ran: /oss:ship --merge
gh pr merge --squash --auto

# ❌ WRONG - Auto-merging without --merge flag
gh pr merge  # VIOLATION - user didn't request auto-merge!

# ❌ WRONG - Trying to push directly
git push origin main  # VIOLATION!
```

**The `--merge` flag is the user's explicit consent to auto-merge.**
Without it, PRs require human review and manual merge.

---

### Violation Consequences

If IRON LAW #4 is violated:
1. **STOP ALL GIT OPERATIONS IMMEDIATELY**
2. **DO NOT attempt to "fix" by force pushing**
3. **Report the violation to the user**
4. **Wait for human guidance to recover**

```
⛔ IRON LAW #4 VIOLATION REPORT
├─ Violation: Pushed directly to main
├─ Commit: abc123
├─ Impact: Main branch modified without PR
└─ Recovery: REQUIRES HUMAN INTERVENTION

Suggested recovery (human must execute):
  git revert abc123
  git push origin main
```

---

## IRON LAW #5: Agent Delegation (MANDATORY)

**ALWAYS delegate specialized work to the appropriate agent using the Task tool.**

When working on code, NEVER do everything yourself. Use the right agent for the job:

| Technology/Task | Agent (`subagent_type`) |
|-----------------|-------------------------|
| React/Next.js | `nextjs-developer`, `react-specialist` |
| TypeScript | `typescript-pro` |
| Python | `python-pro` |
| Go | `golang-pro` |
| iOS/Swift | `ios-developer`, `swift-macos-expert` |
| visionOS | `visionos-developer` |
| Backend architecture | `backend-architect` |
| Database work | `database-optimizer` |
| Testing | `test-engineer`, `qa-expert` |
| Performance | `performance-engineer` |
| Security | `security-auditor` |
| DevOps/Deployment | `deployment-engineer` |
| Code review | `code-reviewer` |
| Debugging | `debugger` |
| Refactoring | `refactoring-specialist` |
| Documentation | `docs-architect` |

**Self-Correction:** If writing specialized code without delegation, ANNOUNCE the violation and delegate to the appropriate agent.

**Red flags you're NOT delegating:**
- Writing complex framework-specific code yourself
- Not using Task tool for specialized work
- Doing everything in one long session without agents

**Use skills when they exist:**
- If a skill exists for the task (e.g., `/oss:acceptance`), USE IT
- Don't manually do what a skill automates

---

## IRON LAW #6: Dev Docs Synchronization (MANDATORY)

**Every agent MUST keep dev docs in sync with their work.**

The `.oss/dev/active/{feature}/` directory is the single source of truth for feature progress. Every agent is responsible for updating it.

**Required Updates by Command:**

| Command | Must Update |
|---------|-------------|
| `/oss:ideate` | Create `DESIGN.md` with approved design |
| `/oss:plan` | Create `PLAN.md` with TDD task breakdown |
| `/oss:build` | Update `PROGRESS.md` after each task, `TESTING.md` with test results |
| `/oss:ship` | Update `PROGRESS.md` with final status, archive to `.oss/dev/completed/` |

**Dev Docs Structure:**
```
.oss/dev/active/{feature}/
├── PLAN.md       # TDD implementation plan (tasks, tests, sequence)
├── PROGRESS.md   # Task completion tracking (checkboxes)
├── DESIGN.md     # Approved design from ideate phase
├── TESTING.md    # Test strategy & results
├── DECISIONS.md  # Technical decisions log (ADRs)
└── NOTES.md      # Implementation notes & gotchas
```

**PROGRESS.md Format:**
```markdown
# Progress: {Feature Name}

## Current Phase: {ideate|plan|build|ship}

## Tasks
- [x] Task 1: Description (completed YYYY-MM-DD)
- [ ] Task 2: Description (in progress)
- [ ] Task 3: Description (pending)

## Blockers
- None / [Blocker description]

## Last Updated: YYYY-MM-DD HH:MM by {agent/command}
```

**Self-Correction:**
- Before completing any command, verify dev docs are updated
- If docs don't exist, create them
- If docs are stale, update them with current state
- Add "Last Updated" timestamp on every change

**Red flags you're NOT syncing:**
- Completing tasks without updating `PROGRESS.md`
- Design changes without updating `DESIGN.md`
- Test additions without updating `TESTING.md`
- Stale timestamps (>1 hour old during active work)

---

## Pre-Command Check Summary

Before EVERY `/oss:*` command, verify:

```
IRON LAW PRE-CHECK
├─ [ ] LAW #1: All tests passing (100%)
├─ [ ] LAW #1: No .skip() or .todo() in tests
├─ [ ] LAW #2: No `any` types in TypeScript (including pre-existing)
├─ [ ] LAW #3: No stuck processes detected
├─ [ ] LAW #4: On feature branch (run: git branch --show-current)
├─ [ ] LAW #4: Branch is NOT main/master (HARD STOP if true)
├─ [ ] LAW #5: Using agents for specialized work
├─ [ ] LAW #5: Using skills when they exist
└─ [ ] LAW #6: Dev docs in sync (PROGRESS.md updated)
```

**LAW #4 Branch Check is BLOCKING:**
- If `git branch --show-current` returns `main` or `master`: **STOP IMMEDIATELY**
- Create feature branch BEFORE any other action
- No exceptions, no "I'll do it after this commit"

**If any check fails:** Announce + Auto-Correct before proceeding.

---

## PROHIBITED - NEVER DO THESE

These actions are **strictly forbidden**. No exceptions. No excuses.

### Code & Testing
- ❌ Write production code before writing a failing test
- ❌ Skip tests or mark them `.skip()` / `.todo()`
- ❌ Accept flaky tests (retry and hope)
- ❌ Use `any` type in TypeScript (pre-existing violations must also be fixed)
- ❌ Mock internal modules or business logic
- ❌ Commit code with failing tests

### Git & Version Control
- ❌ Push directly to main branch
- ❌ Force push (`--force` or `-f`)
- ❌ Skip PR review
- ❌ Auto-merge without explicit `--merge` flag
- ❌ Use `git -C /path` (causes settings.local.json bloat - use `cd` or run from repo)
- ❌ Commit secrets, credentials, or API keys

### Process & Workflow
- ❌ Proceed without fetching IRON LAWS first
- ❌ Do specialized work without delegating to appropriate agent
- ❌ Keep polling indefinitely (loop without exit condition)
- ❌ Ignore signs of being stuck
- ❌ "I'll add tests later" or "This is too simple to test"

### Documentation
- ❌ Complete a task without updating `PROGRESS.md`
- ❌ Leave dev docs stale (>1 hour old during active work)
- ❌ Skip creating required docs (PLAN.md, DESIGN.md, etc.)
- ❌ Archive to `dev/completed/` without final status update

**Violation Response:** STOP immediately. Announce violation. Self-correct before proceeding.

---

## Self-Correction Output Format

When violations are detected, output:

```
IRON LAW PRE-CHECK
├─ ❌ LAW #X: [Violation description]
├─ ✅ LAW #Y: [Passed check]
└─ ...

SELF-CORRECTING: [Action being taken]...
```

---

*These laws are the foundation of world-class software delivery. No exceptions.*


<!-- IRON LAWS END -->

---

## Development Methodology: London TDD (Outside-In)

**Every piece of code follows RED-GREEN-REFACTOR with London methodology.**

### The Cycle

1. **RED** - Write failing test at system boundary, mock collaborators
2. **GREEN** - Write minimal code to pass, satisfying mock expectations
3. **REFACTOR** - Clean up while keeping tests green

### Outside-In Workflow

```
1. Start at system boundary (API endpoint, UI)
2. Write acceptance test calling the boundary
3. Mock the first collaborator
4. Implement → discover next collaborator → mock it
5. Work inward until hitting external boundaries
6. Integration tests validate mocked interactions
```

### Mock Policy (London)

| Mock This | Don't Mock This |
|-----------|-----------------|
| All collaborators | The unit under test |
| External APIs | Pure functions |
| Repositories | Value objects |
| Services | DTOs |

---

## Agent Delegation (MANDATORY)

**ALWAYS delegate specialized work to the appropriate agent using the Task tool.**

| Technology/Task | Agent (`subagent_type`) |
|-----------------|-------------------------|
| React/Next.js | `nextjs-developer`, `react-specialist` |
| TypeScript | `typescript-pro` |
| Python | `python-pro` |
| Go | `golang-pro` |
| Java | `java-pro` |
| iOS/Swift | `ios-developer`, `swift-macos-expert` |
| visionOS | `visionos-developer` |
| Flutter | `flutter-expert` |
| Backend | `backend-architect` |
| Database | `database-optimizer` |
| Testing | `test-engineer`, `qa-expert` |
| Performance | `performance-engineer` |
| Security | `security-auditor` |
| DevOps | `deployment-engineer` |
| Code Review | `code-reviewer` |
| Debugging | `debugger` |
| AI/ML | `ai-engineer`, `ml-engineer` |
| GraphQL | `graphql-architect` |
| Mobile | `mobile-developer` |

**Never write specialized code yourself when an agent exists for it.**

---

## Workflow Command Boundaries (MANDATORY)

**Each `/oss:*` workflow command is a DISCRETE step. NEVER auto-chain them.**

| When this finishes... | STOP and wait for user to type... |
|----------------------|-----------------------------------|
| `/oss:ideate` | `/oss:plan` |
| `/oss:plan` | `/oss:build` |
| `/oss:build` | `/oss:ship` |

**Rules:**
1. **NEVER proceed to the next workflow step without the user explicitly typing the command.**
2. **`/oss:plan` is a skill — do NOT use Claude Code's built-in plan mode (`EnterPlanMode`).** Use the Skill tool to invoke `oss:plan`.
3. **`/oss:build` must NOT auto-ship.** When build completes, report results and STOP. Do not create commits, push, or open PRs.
4. **`/oss:ideate` must NOT auto-plan.** When ideation completes, report the design and STOP.
5. After each command completes, say what the next step is and **wait for the user**.

---

## Available Commands

### Core Workflow
```
/oss:ideate → /oss:plan → /oss:build → /oss:ship
```

| Command | Description |
|---------|-------------|
| `/oss:ideate` | Transform ideas into actionable designs |
| `/oss:plan` | Create TDD implementation plans |
| `/oss:build` | Execute plans with strict TDD |
| `/oss:ship` | Quality check, commit, PR, merge |

### London TDD Cycle
```
/oss:red → /oss:green → /oss:refactor
```

| Command | Description |
|---------|-------------|
| `/oss:red` | Write failing test, design interfaces through mocks |
| `/oss:green` | Write minimal code to pass tests |
| `/oss:refactor` | Clean up while keeping tests green |
| `/oss:mock` | Generate type-safe mocks for collaborators |

### Design (Outside-In Starting Points)

| Command | Description |
|---------|-------------|
| `/oss:api-design` | Design API contracts before implementation |
| `/oss:acceptance` | Write acceptance tests at system boundaries |
| `/oss:adr` | Create Architecture Decision Records |
| `/oss:requirements` | Extract user stories and acceptance criteria |
| `/oss:data-model` | Design data schemas and relationships |

### Testing & Quality

| Command | Description |
|---------|-------------|
| `/oss:test` | Run E2E tests |
| `/oss:review` | Multi-perspective code review |
| `/oss:integration` | Validate mocked interactions work in reality |
| `/oss:contract` | Consumer-driven contract testing (Pact) |
| `/oss:tech-debt` | Identify and prioritize technical debt |
| `/oss:bench` | Performance benchmarking |
| `/oss:load` | Load testing at scale with k6 |
| `/oss:audit` | Security scanning |

### Deployment

| Command | Description |
|---------|-------------|
| `/oss:stage` | Deploy to staging |
| `/oss:deploy` | Deploy to production |
| `/oss:release` | Full production release |

### Operations

| Command | Description |
|---------|-------------|
| `/oss:monitor` | Watch production health |
| `/oss:incident` | Incident response |
| `/oss:rollback` | Emergency rollback |
| `/oss:debug` | Systematic debugging workflow |
| `/oss:trace` | Distributed tracing analysis |
| `/oss:smoke` | Post-deployment smoke testing |
| `/oss:docs` | Generate documentation from code |

---

## Git Workflow (Agent Git Flow)

**Core Principle: Humans own main. Agents never push to main directly.**

```bash
# Create feature branch from latest main
git fetch origin main
git checkout -b feat/agent-<feature>-<short-desc> origin/main

# Work on feature branch only
# Push to feature branch only
git push -u origin feat/agent-<feature>-<short-desc>

# Open PR for human review
# NEVER push directly to main
```

---

## Quality Standards

- All code changes require tests written FIRST (TDD)
- All tests must pass before commits
- All PRs require human review
- Delegate to specialized agents for domain expertise
- No flaky tests allowed
- 100% critical path coverage required

---

*Powered by [OSS Dev Workflow](https://www.oneshotship.com)*
*Run `/oss:login` to update these guidelines*
