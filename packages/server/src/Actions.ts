export interface Action {
    type: string;
    payload: any;
}

export interface MoveAction extends Action {
    type: "MOVE";
    payload: {
        unitId: string;
        targetPos: {
            x: number;
            y: number;
        };
    };
}
