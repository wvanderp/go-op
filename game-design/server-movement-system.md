# Server Movement System — Differential Updates

## Overview

The server maintains full authoritative game state and broadcasts only changes (diffs) to connected clients, rather than the complete game state each tick.

## Architecture Decisions

### 1. Tick loop iterates ALL entities

The server tick loop now visits every entity in the game state, not just those with active movements. This is an architectural foundation for future per-entity behaviors (combat, resource generation, status effects, etc.). Idle entities are visited but produce no state changes.

### 2. Differential state updates (`StateDiff`)

Instead of broadcasting the full `GameState` on every change, the server now:
- Sends a full `StateUpdate` on initial client connection (for bootstrapping)
- Broadcasts `StateDiff` messages during ticks, containing only the units that changed

A `StateDiff` includes:
- `tick` — monotonically increasing tick counter (for ordering and debugging)
- `unitUpdates` — array of `UnitDiff` entries, each containing only the changed fields (`pos`, `action`)

This reduces bandwidth proportionally to the number of actively changing entities.

### 3. Previous-state snapshotting across ticks

The server tracks `previousTickUnits` (snapshotted at the end of each tick) rather than at the start. This ensures that state changes made by request handlers between ticks (e.g., setting `action: "moving"` when a move request arrives) are captured in the next tick's diff. Without this, between-tick action changes would be lost.

### 4. `computeStateDiff` and `applyStateDiff` in protocol

Both functions live in `@go-op/protocol` since they're about state serialization/deserialization:
- `computeStateDiff(previousUnits, currentUnits, tick)` — pure comparison function used by the server
- `applyStateDiff(state, diff)` — immutable state transformer used by the client

### 5. `UnitStep` messages retained alongside diffs

`UnitStep` (animation hint: "animate from tile A to tile B over N ms") is kept as a separate message from `StateDiff` (authoritative position update). They serve different purposes:
- `StateDiff` tells the client where entities ARE
- `UnitStep` tells the client how to ANIMATE transitions smoothly

### 6. Anti-teleport guard preserved

The 1-tile-per-tick maximum advancement guard remains. After each tile step, elapsed time resets to 0, preventing units from skipping tiles during large time deltas.

## Message Flow

```
Client connects:
  Server → Client:  StateUpdate (full game state)

Client sends move:
  Server → All:     MoveResult
  Server → All:     UnitStep (first step animation hint)

Each tick where entities change:
  Server → All:     UnitStep (next step animation hints, if applicable)
  Server → All:     StateDiff { tick, unitUpdates: [{ unitId, pos?, action? }] }
```

## Files Changed

- `packages/protocol/src/index.ts` — Added `UnitDiff`, `StateDiff`, `computeStateDiff`, `applyStateDiff`
- `packages/server/src/index.ts` — Refactored tick loop, entity iteration, diff broadcasting
- `packages/client/src/main.ts` — Handles `stateDiff` messages via `applyStateDiff`
- `packages/protocol/src/index.test.ts` — 12 new tests for diff computation and application
- `packages/server/src/index.test.ts` — Updated all tests for diff-based protocol, added 6 new differential update tests
