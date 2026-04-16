import type { Action } from './Actions.js';
import type { Position } from './Position.js';

export default class Entity {
    public id: string;
    public pos: Position;

    public actionList: Action[] = [];

    constructor(id: string, pos: Position) {
        this.id = id;
        this.pos = pos;
    }
}
