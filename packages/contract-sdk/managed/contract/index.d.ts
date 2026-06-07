import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type Witnesses<PS> = {
  operatorSecretKey(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
}

export type ImpureCircuits<PS> = {
  extendCanvas(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, [{ x: bigint,
                                                                                                     y: bigint
                                                                                                   }]>;
  updateSquare(context: __compactRuntime.CircuitContext<PS>,
               coordinate_0: { x: bigint, y: bigint },
               strokeData_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
}

export type ProvableCircuits<PS> = {
  extendCanvas(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, [{ x: bigint,
                                                                                                     y: bigint
                                                                                                   }]>;
  updateSquare(context: __compactRuntime.CircuitContext<PS>,
               coordinate_0: { x: bigint, y: bigint },
               strokeData_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
}

export type PureCircuits = {
  generateOwnerCommittment(sk_0: Uint8Array,
                           x_0: bigint,
                           y_0: bigint,
                           nonce_0: bigint): Uint8Array;
  incrementCoordinate(depth_0: bigint, x_0: bigint, y_0: bigint): [bigint,
                                                                   bigint,
                                                                   bigint];
}

export type Circuits<PS> = {
  extendCanvas(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, [{ x: bigint,
                                                                                                     y: bigint
                                                                                                   }]>;
  updateSquare(context: __compactRuntime.CircuitContext<PS>,
               coordinate_0: { x: bigint, y: bigint },
               strokeData_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  generateOwnerCommittment(context: __compactRuntime.CircuitContext<PS>,
                           sk_0: Uint8Array,
                           x_0: bigint,
                           y_0: bigint,
                           nonce_0: bigint): __compactRuntime.CircuitResults<PS, Uint8Array>;
  incrementCoordinate(context: __compactRuntime.CircuitContext<PS>,
                      depth_0: bigint,
                      x_0: bigint,
                      y_0: bigint): __compactRuntime.CircuitResults<PS, [bigint,
                                                                         bigint,
                                                                         bigint]>;
}

export type Ledger = {
  readonly nextX: bigint;
  readonly nextY: bigint;
  readonly depth: bigint;
  canvasIdx: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: { x: bigint, y: bigint }): boolean;
    lookup(key_0: { x: bigint, y: bigint }): { owner: Uint8Array,
                                               nonce: bigint,
                                               strokeData: Uint8Array
                                             };
    [Symbol.iterator](): Iterator<[{ x: bigint, y: bigint }, { owner: Uint8Array, nonce: bigint, strokeData: Uint8Array }]>
  };
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
