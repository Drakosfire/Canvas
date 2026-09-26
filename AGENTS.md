# Agent operating policy

This file is durable repository law for agents working in Canvas.

Canvas owns reusable React layout/measurement/pagination/map-canvas primitives and their public package contracts. Product workflow, domain meaning, persistence, backend behavior, and product-specific state remain in consuming repositories.

## Ecosystem execution core — overmind-agent-core-v1

These rules are intentionally shared across active DungeonMind ecosystem repositories. Repository-specific law may add constraints, but it must not weaken this core.

1. **Re-anchor before action.** Fetch the current remote default branch and inspect relevant open PRs/active work before editing, reviewing, or merging. Chat history, stale handoffs, and local `main` are not current authority.
2. **Respect ownership boundaries.** Cross-repository architecture and sequencing belong in DungeonOverMind; runtime/product implementation belongs in the repository that owns the capability. When a change crosses owners, name the contract.
3. **Handoffs are portable bounded contracts.** A handoff may live on `main`, a branch, a PR, or another durable pinned ref/location. Its location alone neither activates nor invalidates it. Execution authority comes from explicit authorization/status, a pinned authority/ref, and bounded scope/write ownership. Do not require a handoff to be merged to `main` unless the specific workstream explicitly makes that a gate.
4. **Finish authorized implementation work all the way to a PR.** Once implementation is authorized, ordinary completion includes: implement → test/verify → inspect the cumulative diff → commit intended changes → push the branch → open or update the assigned PR. If no PR exists, open it. Do not stop with intended work only local, uncommitted, or unpushed and wait for another prompt to commit/push/open the PR.
5. **Merge is separate authority.** Opening/updating a PR is part of implementation completion; merging it is not. Merge only when the user or the repository's explicit process authorizes merge.
6. **Use isolated Git lanes.** Do not develop on local `main`. Use a branch/worktree or equivalent isolated checkout, and treat file/runtime/state collisions as coordination problems rather than relying on Git conflicts.
7. **Keep slices bounded.** One implementation slice should deliver one independently useful capability. A second capability, new durable/public contract, or unplanned extra PR is a stop/split signal unless explicitly authorized.
8. **Verify at the owning boundary.** Review the exact cumulative base→head diff and prove behavior at the layer that owns the invariant. A green helper test is not evidence for a boundary it does not exercise.
9. **Settle after merge.** Re-anchor, synchronize mutable authority that now became stale, and prune superseded process/transition scaffolding. Git history is the default archive; preserve a separate archive copy only when it carries unique durable evidence.

## Authority and pickup

- Start with `README.md`, then `ARCHITECTURE.md` and `STATUS.md` for current library shape and health.
- Current public exports/types/tests beat archived learning/handoff material.
- Treat consumers as contract pressure, not as authority to move product semantics into the shared library.

## Library boundaries

- Keep `dungeonmind-canvas/layout`, `dungeonmind-canvas/map`, and supported public exports backward-compatible unless the assigned slice explicitly changes/version them.
- Reusable measurement, pagination, map interaction, masking, and rendering mechanics belong here when they have a genuine shared reason to change.
- Navigation, authentication, campaign/world meaning, product workflows, server calls, and owner-specific persistence do not belong here.
- Do not add Buddy/Web-specific state or styling shortcuts to simplify one consumer. Use adapters/projections in the consumer unless a second real consumer proves a reusable contract.
- Keep peer-dependency and subpath behavior explicit; avoid accidental dependency expansion for layout-only consumers.

## Engineering evidence

- Test the public package behavior and affected export/subpath, not only internal helpers.
- For layout changes, include deterministic measurement/pagination witnesses where applicable.
- For map changes, exercise the interaction/export seam affected by the change.
- Inspect package/build/type output when public exports or dependencies change.
- Historical learnings belong in archive/Git history once they no longer direct current work.
