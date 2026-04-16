import Entity from './Entity.js';
import type { Position } from './Position.js';

export default class Unit extends Entity {
    public hp: number

    constructor(id: string, pos: Position, hp: number) {
        super(id, pos);
        this.hp = hp;
    }

}
