# Map Objects & Resource Points — Draft v1

Map objects are not player-built. They exist on the map at match start (or form dynamically as goop spills). They define the economic geography of the battlefield and drive expansion decisions.

---

## Primary Goop Source

**Type:** Resource patch  
**Location:** Inside each player's starting base area  
**Contestability:** Low — protected by starting defenses

The large, safe goop patch every player begins near. It provides the initial and sustained goop income that funds early production, research, and expansion. Losing access to the primary source is effectively losing the game; destroying the enemy's primary source is the main victory condition.

**Key properties**

- High yield; sustains early and mid-game economy alone
- Located in a defensible position near the player's starting structures
- Carriers assigned to collect zones around it extract goop automatically
- Depletion rate and regeneration (if any) are balance levers

---

## Minor Goop Source

**Type:** Resource patch  
**Location:** Between player bases, closer to the map center  
**Contestability:** High — no natural defenses, open to both sides

Smaller goop patches scattered in contested ground. They provide supplemental income and reward expansion. Control is soft: any player can harvest from a Minor Source if their carriers can survive the route. Taking and holding these patches is the economic motivation for the artillery-creep loop.

**Key properties**

- Lower yield than the Primary Source
- Multiple patches per map; exact count is a map-design variable
- No ownership — whoever has carriers collecting there gets the goop
- Defending a Minor Source means defending the supply route, not the patch itself
- Losing access to contested patches slows but does not cripple a player

---

## Power Goop Source

**Type:** Resource patch (premium)  
**Location:** Center of the map  
**Contestability:** Very high — the most fought-over resource on the map

Power goop is geologically matured goop: denser, more energetic, and less stable. It forms where ordinary goop has spent decades under heat, pressure, and mineral contact. Power goop is five times more potent than normal goop and is required for the strongest endgame tech, super-gun restoration, and advanced research branches.

**Key properties**

- 5x potency compared to normal goop
- Required for endgame technology and super-gun activation
- Central map placement forces conflict; passive players forfeit access
- Same collection mechanics as normal goop but with distinct visual presentation (denser, more volatile appearance)
- A decisive strategic resource: the player who controls power goop outscales the opponent

---

## Goop Puddle

**Type:** Dynamic map feature  
**Location:** Anywhere goop spills, accumulates, or is delivered  
**Contestability:** Situational — depends on location

Goop puddles are pools of goop that form on the map surface. They appear when carriers die and spill their cargo, when Lobbers deliver goop inaccurately, when structures are destroyed, or when goop flows downhill from height. Puddles are a shared resource: any unit or structure from either side can drink from a nearby puddle.

**Key properties**

- Created dynamically through spills, Lobber fire, and gravity flow
- Any nearby unit or tower can draw goop from a puddle
- Puddles provide brief supply continuity when a main line is cut
- Terrain height matters: goop rolls downhill and pools in low ground
- Puddles evaporate or drain over time (rate is a balance lever)
- Both sides can steal enemy puddles; no ownership

---

## Collect Zone

**Type:** Player-defined control zone  
**Location:** Placed by the player over or near a goop source  
**Contestability:** N/A — a command abstraction, not a physical object

A collect zone tells carriers where to pick up goop. Any carrier assigned to a route that includes a collect zone will travel there, load goop, and then move to a linked delivery zone. Collect zones are the primary mechanism for organizing extraction without direct micro of individual units.

**Key properties**

- Placed and resized by the player
- Carriers in a collect zone load goop from the nearest source or puddle
- Multiple collect zones can overlap the same source for different delivery routes
- Priority settings determine which routes are staffed first when carriers are scarce
- No physical presence; purely a logistics-layer abstraction

---

## Delivery Zone

**Type:** Player-defined control zone  
**Location:** Placed by the player near structures, ghosts, or frontline positions  
**Contestability:** N/A — a command abstraction, not a physical object

A delivery zone tells carriers where to deposit goop. Structures, ghosts (structures under construction), and frontline supply depots all need delivery zones to receive goop. Player-set priority across delivery zones is the main lever for deciding what gets fed first.

**Key properties**

- Placed and resized by the player
- Carriers deliver goop to the nearest demand within the zone (structure, ghost, or reserve)
- Priority ranking determines which delivery zones are supplied first
- Flow maps can guide carrier pathing between collect and delivery zones
- Critical for frontline sustainment: a delivery zone at the front keeps towers firing

---

## Worldbreaker — Dormant Super-gun

**Type:** Map relic  
**Location:** Fixed positions on the map, typically in contested or hard-to-reach areas  
**Contestability:** Very high — activating one is a major strategic commitment

Worldbreakers are repurposed terraforming hardware — originally built to reshape weather, irrigation, and soil chemistry at enormous scale, then converted into artillery during the escalation of concession wars. They sit dormant on the map until a player supplies them with enough goop (including power goop) to reactivate them. Once active, they are devastatingly powerful but consume goop at a massive rate.

**Key properties**

- Dormant at match start; requires sustained goop delivery to activate
- Activation requires power goop; normal goop alone is insufficient
- Once active, fires automatically with extreme range and damage
- Enormous goop consumption; can drain a player's logistics if not carefully managed
- Fixed position; cannot be moved or rebuilt
- A restored Worldbreaker is a potential win condition but also a massive supply commitment
- Destruction of an active Worldbreaker is a major setback

---

## Terminology Notes

| Term | Meaning |
|------|---------|
| **Source / Patch** | A map-placed goop extraction point. "Source" and "patch" are interchangeable in v1 |
| **Power Goop** | Geologically matured goop, 5x potency. Not a different substance, just a denser state |
| **Puddle** | A dynamic goop pool on the map surface. Not a source; it drains over time |
| **Zone** | A player-defined logistics abstraction (collect or delivery). Has no physical presence |
| **Relic / Super-gun** | Both refer to Worldbreakers. "Super-gun" is the functional term; "relic" is the lore term |
