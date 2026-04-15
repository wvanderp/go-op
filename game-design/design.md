# Design Summary

## Core Premise

Transport is the bottleneck of the game. Goop is the single real resource and acts as power, currency, ammunition, repair material, and construction feedstock. The main victory condition is destroying the enemy's primary goop source. Playable sides are mostly symmetric, and the meaningful differences come from policy, research, and logistics doctrine rather than distinct faction gimmicks.

## Match Flow

The core loop is artillery creep. Players place long-range towers to break open space, establish a tougher anchor tower to secure new ground, then repeat the process. The frontline is defined less by where units stand and more by where the logistics network can continue to feed guns. Passive play is punished by the map itself: players who turtle give up access to power goop and dormant super-guns, which lets the opponent outscale them.

## Resource Model

Each player begins near a large, safe goop patch. Smaller patches exist closer to the middle of the map, and the center also contains power goop. Power goop is geologically matured goop, five times more potent than normal goop, and required for the strongest endgame tech and super-weapons.

Goop can spill and accumulate as puddles on the map. Units and towers can draw from nearby puddles, either side can steal them, and terrain height matters because goop can roll down ramps. Expansion is soft control rather than hard ownership: any side can harvest from a patch if collectors can survive the route.

## Logistics Model

The game supports several transport methods.

- Small carriers move goop by hand.
- Larger transport creatures move higher volumes.
- Pipelines carry goop efficiently but are expensive and vulnerable infrastructure.
- Cannons can launch goop to distant bastions, trading efficiency for range and accuracy.

Players manage logistics primarily through policy rather than direct micro. Build orders are placed as ghosts, then workers deliver goop until the structure becomes real. Zones mainly define collection and delivery behavior, while explicit player-set priority determines which demands are fed first. Longer routes can also be guided with flow maps.

## Combat Model

Heavy weapons are primarily static. Cannons fire automatically according to player-set targeting priorities. Their ammunition is literally converted goop, so if supply is cut and local reserves run dry they stop shooting.

Harassment and line-breaking focus on logistics disruption rather than brute-force tower killing. Players can flank with long-range towers or use fully controllable exploding units whose fuse is lit the moment they spawn. Frontlines should not always collapse instantly after a cut: puddles, internal storage, and nearby reserves can keep a push alive briefly, creating delayed and more dramatic supply failure.

## Information Model

The game uses fog of war. Scouts and radar-style units lift the fog, and once a target is visible to the network it becomes targetable by the weapon systems that can reach it. Height matters for sight lines, firing, and liquid behavior.

## Production and Tech

Factories grow units by combining goop with metal, though metal is narrative flavor rather than a second resource. Research buildings convert goop into research, forcing a direct tradeoff between present strength and future capability.

Research should create hard strategic forks. Expected branches include logistics, cannon strength, durability, raiding, efficiency, creature evolution, and super-gun restoration, with the intent that a player's doctrine becomes legible by midgame rather than remaining a loose pile of upgrades.

## Multiplayer and Command

If multiplayer exists, players share control of the same army with no unit ownership. Coordination is solved socially through pings, planning tools, and visible intent markers rather than permissions or hard locks. This should feel like multiple operators working one war table, not several players partitioning a base.

## Technical and Structural Pillars

- Square grid board to simplify deterministic liquid simulation.
- No true randomness; complexity should emerge from interacting systems.
- No air layer.
- Both unit AI and player-side automation are core pillars.
