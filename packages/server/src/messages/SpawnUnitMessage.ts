import { z } from "zod";

const spawnUnitMessage = z.object({
    type: z.literal("spawnUnit"),
    playerId: z.string(),
    unitType: z.string(),
    x: z.number(),
    y: z.number(),
});
