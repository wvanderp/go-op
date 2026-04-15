# Client Rendering Architecture

## Goal

The client keeps a stable Pixi scene graph so camera movement and server updates do not allocate a new set of display objects every frame.

## Scene Ownership

- `main.ts` owns browser wiring: Pixi application startup, pointer input, WebSocket lifecycle, and teardown.
- `renderer.ts` owns the world scene graph and all display-object reuse.

## Layer Structure

- `stage`
- `worldContainer`
- `mapLayer`
- `unitLayer`

`worldContainer` is created once and moved by camera updates. The stage is not cleared during normal gameplay.

## Update Model

- Camera drag updates only `worldContainer.x` and `worldContainer.y`.
- `state` messages trigger a scene sync for map and unit positions.
- `moveResult` messages trigger a scene sync so path highlighting updates immediately.

## Rendering Strategy

- The map layer uses one reusable `Graphics` object.
- The map graphics are redrawn only when the map reference changes or the highlighted path changes.
- Units are tracked by unit id.
- Each unit owns one reusable marker graphic and one reusable label.
- Removed units are explicitly detached and destroyed.

## Cleanup Boundaries

- Pointer listeners return a teardown function from `setupInput()`.
- WebSocket listeners return a teardown function from `connectToServer()`.
- Browser unload tears down listeners and destroys the scene renderer.

## Why This Fixes The OOM

The old client rebuilt thousands of Pixi `Graphics` and `Text` objects on every ticker frame. The current design keeps a bounded number of long-lived objects, which removes the unbounded allocation pattern that was driving the out-of-memory failure.
