import { describe, it, expect } from 'vitest';
import GameServer from '../index.js';

describe('moving a unit one step at the time', () => {
    it('should move the unit acording to the action', () => {
        const server = new GameServer();

        server.start();
        server.sendMessage();
    });
});
