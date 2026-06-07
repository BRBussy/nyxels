import * as __compactRuntime from '@midnight-ntwrk/compact-runtime';
__compactRuntime.checkRuntimeVersion('0.16.0');

const _descriptor_0 = new __compactRuntime.CompactTypeBytes(32);

const _descriptor_1 = new __compactRuntime.CompactTypeUnsignedInteger(4294967295n, 4);

class _tuple_0 {
  alignment() {
    return _descriptor_1.alignment().concat(_descriptor_1.alignment().concat(_descriptor_1.alignment()));
  }
  fromValue(value_0) {
    return [
      _descriptor_1.fromValue(value_0),
      _descriptor_1.fromValue(value_0),
      _descriptor_1.fromValue(value_0)
    ]
  }
  toValue(value_0) {
    return _descriptor_1.toValue(value_0[0]).concat(_descriptor_1.toValue(value_0[1]).concat(_descriptor_1.toValue(value_0[2])));
  }
}

const _descriptor_2 = new _tuple_0();

class _Coordinate_0 {
  alignment() {
    return _descriptor_1.alignment().concat(_descriptor_1.alignment());
  }
  fromValue(value_0) {
    return {
      x: _descriptor_1.fromValue(value_0),
      y: _descriptor_1.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_1.toValue(value_0.x).concat(_descriptor_1.toValue(value_0.y));
  }
}

const _descriptor_3 = new _Coordinate_0();

const _descriptor_4 = __compactRuntime.CompactTypeOpaqueUint8Array;

class _Square_0 {
  alignment() {
    return _descriptor_0.alignment().concat(_descriptor_1.alignment().concat(_descriptor_4.alignment()));
  }
  fromValue(value_0) {
    return {
      owner: _descriptor_0.fromValue(value_0),
      nonce: _descriptor_1.fromValue(value_0),
      strokeData: _descriptor_4.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_0.toValue(value_0.owner).concat(_descriptor_1.toValue(value_0.nonce).concat(_descriptor_4.toValue(value_0.strokeData)));
  }
}

const _descriptor_5 = new _Square_0();

class _tuple_1 {
  alignment() {
    return _descriptor_3.alignment();
  }
  fromValue(value_0) {
    return [
      _descriptor_3.fromValue(value_0)
    ]
  }
  toValue(value_0) {
    return _descriptor_3.toValue(value_0[0]);
  }
}

const _descriptor_6 = new _tuple_1();

const _descriptor_7 = __compactRuntime.CompactTypeBoolean;

const _descriptor_8 = new __compactRuntime.CompactTypeVector(4, _descriptor_0);

const _descriptor_9 = new __compactRuntime.CompactTypeUnsignedInteger(18446744073709551615n, 8);

class _Either_0 {
  alignment() {
    return _descriptor_7.alignment().concat(_descriptor_0.alignment().concat(_descriptor_0.alignment()));
  }
  fromValue(value_0) {
    return {
      is_left: _descriptor_7.fromValue(value_0),
      left: _descriptor_0.fromValue(value_0),
      right: _descriptor_0.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_7.toValue(value_0.is_left).concat(_descriptor_0.toValue(value_0.left).concat(_descriptor_0.toValue(value_0.right)));
  }
}

const _descriptor_10 = new _Either_0();

const _descriptor_11 = new __compactRuntime.CompactTypeUnsignedInteger(340282366920938463463374607431768211455n, 16);

class _ContractAddress_0 {
  alignment() {
    return _descriptor_0.alignment();
  }
  fromValue(value_0) {
    return {
      bytes: _descriptor_0.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_0.toValue(value_0.bytes);
  }
}

const _descriptor_12 = new _ContractAddress_0();

const _descriptor_13 = new __compactRuntime.CompactTypeUnsignedInteger(255n, 1);

export class Contract {
  witnesses;
  constructor(...args_0) {
    if (args_0.length !== 1) {
      throw new __compactRuntime.CompactError(`Contract constructor: expected 1 argument, received ${args_0.length}`);
    }
    const witnesses_0 = args_0[0];
    if (typeof(witnesses_0) !== 'object') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor is not an object');
    }
    if (typeof(witnesses_0.operatorSecretKey) !== 'function') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named operatorSecretKey');
    }
    this.witnesses = witnesses_0;
    this.circuits = {
      extendCanvas: (...args_1) => {
        if (args_1.length !== 1) {
          throw new __compactRuntime.CompactError(`extendCanvas: expected 1 argument (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('extendCanvas',
                                     'argument 1 (as invoked from Typescript)',
                                     'shared-canvas.compact line 35 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: { value: [], alignment: [] },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._extendCanvas_0(context, partialProofData);
        partialProofData.output = { value: _descriptor_6.toValue(result_0), alignment: _descriptor_6.alignment() };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      },
      updateSquare: (...args_1) => {
        if (args_1.length !== 3) {
          throw new __compactRuntime.CompactError(`updateSquare: expected 3 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const coordinate_0 = args_1[1];
        const strokeData_0 = args_1[2];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('updateSquare',
                                     'argument 1 (as invoked from Typescript)',
                                     'shared-canvas.compact line 66 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(typeof(coordinate_0) === 'object' && typeof(coordinate_0.x) === 'bigint' && coordinate_0.x >= 0n && coordinate_0.x <= 4294967295n && typeof(coordinate_0.y) === 'bigint' && coordinate_0.y >= 0n && coordinate_0.y <= 4294967295n)) {
          __compactRuntime.typeError('updateSquare',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'shared-canvas.compact line 66 char 1',
                                     'struct Coordinate<x: Uint<0..4294967296>, y: Uint<0..4294967296>>',
                                     coordinate_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: {
            value: _descriptor_3.toValue(coordinate_0).concat(_descriptor_4.toValue(strokeData_0)),
            alignment: _descriptor_3.alignment().concat(_descriptor_4.alignment())
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._updateSquare_0(context,
                                              partialProofData,
                                              coordinate_0,
                                              strokeData_0);
        partialProofData.output = { value: [], alignment: [] };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      },
      generateOwnerCommittment(context, ...args_1) {
        return { result: pureCircuits.generateOwnerCommittment(...args_1), context };
      },
      incrementCoordinate(context, ...args_1) {
        return { result: pureCircuits.incrementCoordinate(...args_1), context };
      }
    };
    this.impureCircuits = {
      extendCanvas: this.circuits.extendCanvas,
      updateSquare: this.circuits.updateSquare
    };
    this.provableCircuits = {
      extendCanvas: this.circuits.extendCanvas,
      updateSquare: this.circuits.updateSquare
    };
  }
  initialState(...args_0) {
    if (args_0.length !== 1) {
      throw new __compactRuntime.CompactError(`Contract state constructor: expected 1 argument (as invoked from Typescript), received ${args_0.length}`);
    }
    const constructorContext_0 = args_0[0];
    if (typeof(constructorContext_0) !== 'object') {
      throw new __compactRuntime.CompactError(`Contract state constructor: expected 'constructorContext' in argument 1 (as invoked from Typescript) to be an object`);
    }
    if (!('initialPrivateState' in constructorContext_0)) {
      throw new __compactRuntime.CompactError(`Contract state constructor: expected 'initialPrivateState' in argument 1 (as invoked from Typescript)`);
    }
    if (!('initialZswapLocalState' in constructorContext_0)) {
      throw new __compactRuntime.CompactError(`Contract state constructor: expected 'initialZswapLocalState' in argument 1 (as invoked from Typescript)`);
    }
    if (typeof(constructorContext_0.initialZswapLocalState) !== 'object') {
      throw new __compactRuntime.CompactError(`Contract state constructor: expected 'initialZswapLocalState' in argument 1 (as invoked from Typescript) to be an object`);
    }
    const state_0 = new __compactRuntime.ContractState();
    let stateValue_0 = __compactRuntime.StateValue.newArray();
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    state_0.data = new __compactRuntime.ChargedState(stateValue_0);
    state_0.setOperation('extendCanvas', new __compactRuntime.ContractOperation());
    state_0.setOperation('updateSquare', new __compactRuntime.ContractOperation());
    const context = __compactRuntime.createCircuitContext(__compactRuntime.dummyContractAddress(), constructorContext_0.initialZswapLocalState.coinPublicKey, state_0.data, constructorContext_0.initialPrivateState);
    const partialProofData = {
      input: { value: [], alignment: [] },
      output: undefined,
      publicTranscript: [],
      privateTranscriptOutputs: []
    };
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_13.toValue(0n),
                                                                                              alignment: _descriptor_13.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(0n),
                                                                                              alignment: _descriptor_1.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_13.toValue(1n),
                                                                                              alignment: _descriptor_13.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(0n),
                                                                                              alignment: _descriptor_1.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_13.toValue(2n),
                                                                                              alignment: _descriptor_13.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(0n),
                                                                                              alignment: _descriptor_1.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_13.toValue(3n),
                                                                                              alignment: _descriptor_13.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newMap(
                                                          new __compactRuntime.StateMap()
                                                        ).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    const tmp_0 = 0n;
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_13.toValue(2n),
                                                                                              alignment: _descriptor_13.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(tmp_0),
                                                                                              alignment: _descriptor_1.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    const tmp_1 = 0n;
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_13.toValue(0n),
                                                                                              alignment: _descriptor_13.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(tmp_1),
                                                                                              alignment: _descriptor_1.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    const tmp_2 = 0n;
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_13.toValue(1n),
                                                                                              alignment: _descriptor_13.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(tmp_2),
                                                                                              alignment: _descriptor_1.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    state_0.data = new __compactRuntime.ChargedState(context.currentQueryContext.state.state);
    return {
      currentContractState: state_0,
      currentPrivateState: context.currentPrivateState,
      currentZswapLocalState: context.currentZswapLocalState
    }
  }
  _persistentHash_0(value_0) {
    const result_0 = __compactRuntime.persistentHash(_descriptor_8, value_0);
    return result_0;
  }
  _operatorSecretKey_0(context, partialProofData) {
    const witnessContext_0 = __compactRuntime.createWitnessContext(ledger(context.currentQueryContext.state), context.currentPrivateState, context.currentQueryContext.address);
    const [nextPrivateState_0, result_0] = this.witnesses.operatorSecretKey(witnessContext_0);
    context.currentPrivateState = nextPrivateState_0;
    if (!(result_0.buffer instanceof ArrayBuffer && result_0.BYTES_PER_ELEMENT === 1 && result_0.length === 32)) {
      __compactRuntime.typeError('operatorSecretKey',
                                 'return value',
                                 'shared-canvas.compact line 27 char 1',
                                 'Bytes<32>',
                                 result_0)
    }
    partialProofData.privateTranscriptOutputs.push({
      value: _descriptor_0.toValue(result_0),
      alignment: _descriptor_0.alignment()
    });
    return result_0;
  }
  _extendCanvas_0(context, partialProofData) {
    const newCoordinate_0 = { x:
                                _descriptor_1.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                          partialProofData,
                                                                                          [
                                                                                           { dup: { n: 0 } },
                                                                                           { idx: { cached: false,
                                                                                                    pushPath: false,
                                                                                                    path: [
                                                                                                           { tag: 'value',
                                                                                                             value: { value: _descriptor_13.toValue(0n),
                                                                                                                      alignment: _descriptor_13.alignment() } }] } },
                                                                                           { popeq: { cached: false,
                                                                                                      result: undefined } }]).value),
                              y:
                                _descriptor_1.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                          partialProofData,
                                                                                          [
                                                                                           { dup: { n: 0 } },
                                                                                           { idx: { cached: false,
                                                                                                    pushPath: false,
                                                                                                    path: [
                                                                                                           { tag: 'value',
                                                                                                             value: { value: _descriptor_13.toValue(1n),
                                                                                                                      alignment: _descriptor_13.alignment() } }] } },
                                                                                           { popeq: { cached: false,
                                                                                                      result: undefined } }]).value) };
    const newSquare_0 = { owner:
                            this._generateOwnerCommittment_0(this._operatorSecretKey_0(context,
                                                                                       partialProofData),
                                                             newCoordinate_0.x,
                                                             newCoordinate_0.y,
                                                             0n),
                          nonce: 0n,
                          strokeData: new Uint8Array(0) };
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_13.toValue(3n),
                                                                  alignment: _descriptor_13.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_3.toValue(newCoordinate_0),
                                                                                              alignment: _descriptor_3.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_5.toValue(newSquare_0),
                                                                                              alignment: _descriptor_5.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } }]);
    const __compact_pattern_tmp1_0 = this._incrementCoordinate_0(_descriptor_1.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                                                           partialProofData,
                                                                                                                           [
                                                                                                                            { dup: { n: 0 } },
                                                                                                                            { idx: { cached: false,
                                                                                                                                     pushPath: false,
                                                                                                                                     path: [
                                                                                                                                            { tag: 'value',
                                                                                                                                              value: { value: _descriptor_13.toValue(2n),
                                                                                                                                                       alignment: _descriptor_13.alignment() } }] } },
                                                                                                                            { popeq: { cached: false,
                                                                                                                                       result: undefined } }]).value),
                                                                 _descriptor_1.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                                                           partialProofData,
                                                                                                                           [
                                                                                                                            { dup: { n: 0 } },
                                                                                                                            { idx: { cached: false,
                                                                                                                                     pushPath: false,
                                                                                                                                     path: [
                                                                                                                                            { tag: 'value',
                                                                                                                                              value: { value: _descriptor_13.toValue(0n),
                                                                                                                                                       alignment: _descriptor_13.alignment() } }] } },
                                                                                                                            { popeq: { cached: false,
                                                                                                                                       result: undefined } }]).value),
                                                                 _descriptor_1.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                                                           partialProofData,
                                                                                                                           [
                                                                                                                            { dup: { n: 0 } },
                                                                                                                            { idx: { cached: false,
                                                                                                                                     pushPath: false,
                                                                                                                                     path: [
                                                                                                                                            { tag: 'value',
                                                                                                                                              value: { value: _descriptor_13.toValue(1n),
                                                                                                                                                       alignment: _descriptor_13.alignment() } }] } },
                                                                                                                            { popeq: { cached: false,
                                                                                                                                       result: undefined } }]).value));
    const incDepth_0 = __compact_pattern_tmp1_0[0];
    const incX_0 = __compact_pattern_tmp1_0[1];
    const incY_0 = __compact_pattern_tmp1_0[2];
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_13.toValue(2n),
                                                                                              alignment: _descriptor_13.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(incDepth_0),
                                                                                              alignment: _descriptor_1.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_13.toValue(0n),
                                                                                              alignment: _descriptor_13.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(incX_0),
                                                                                              alignment: _descriptor_1.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_13.toValue(1n),
                                                                                              alignment: _descriptor_13.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(incY_0),
                                                                                              alignment: _descriptor_1.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    return [newCoordinate_0];
  }
  _updateSquare_0(context, partialProofData, coordinate_0, strokeData_0) {
    __compactRuntime.assert(_descriptor_7.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                      partialProofData,
                                                                                      [
                                                                                       { dup: { n: 0 } },
                                                                                       { idx: { cached: false,
                                                                                                pushPath: false,
                                                                                                path: [
                                                                                                       { tag: 'value',
                                                                                                         value: { value: _descriptor_13.toValue(3n),
                                                                                                                  alignment: _descriptor_13.alignment() } }] } },
                                                                                       { push: { storage: false,
                                                                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_3.toValue(coordinate_0),
                                                                                                                                              alignment: _descriptor_3.alignment() }).encode() } },
                                                                                       'member',
                                                                                       { popeq: { cached: true,
                                                                                                  result: undefined } }]).value),
                            'no canvas square at given coordinate');
    const square_0 = _descriptor_5.fromValue(__compactRuntime.queryLedgerState(context,
                                                                               partialProofData,
                                                                               [
                                                                                { dup: { n: 0 } },
                                                                                { idx: { cached: false,
                                                                                         pushPath: false,
                                                                                         path: [
                                                                                                { tag: 'value',
                                                                                                  value: { value: _descriptor_13.toValue(3n),
                                                                                                           alignment: _descriptor_13.alignment() } }] } },
                                                                                { idx: { cached: false,
                                                                                         pushPath: false,
                                                                                         path: [
                                                                                                { tag: 'value',
                                                                                                  value: { value: _descriptor_3.toValue(coordinate_0),
                                                                                                           alignment: _descriptor_3.alignment() } }] } },
                                                                                { popeq: { cached: false,
                                                                                           result: undefined } }]).value);
    __compactRuntime.assert(this._equal_0(square_0.owner,
                                          this._generateOwnerCommittment_0(this._operatorSecretKey_0(context,
                                                                                                     partialProofData),
                                                                           coordinate_0.x,
                                                                           coordinate_0.y,
                                                                           square_0.nonce)),
                            'attempted to update square, but not the current owner');
    const tmp_0 = { owner:
                      this._generateOwnerCommittment_0(this._operatorSecretKey_0(context,
                                                                                 partialProofData),
                                                       coordinate_0.x,
                                                       coordinate_0.y,
                                                       ((t1) => {
                                                         if (t1 > 4294967295n) {
                                                           throw new __compactRuntime.CompactError('shared-canvas.compact line 92 char 17: cast from Field or Uint value to smaller Uint value failed: ' + t1 + ' is greater than 4294967295');
                                                         }
                                                         return t1;
                                                       })(square_0.nonce + 1n)),
                    nonce:
                      ((t1) => {
                        if (t1 > 4294967295n) {
                          throw new __compactRuntime.CompactError('shared-canvas.compact line 94 char 20: cast from Field or Uint value to smaller Uint value failed: ' + t1 + ' is greater than 4294967295');
                        }
                        return t1;
                      })(square_0.nonce + 1n),
                    strokeData: strokeData_0 };
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_13.toValue(3n),
                                                                  alignment: _descriptor_13.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_3.toValue(coordinate_0),
                                                                                              alignment: _descriptor_3.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_5.toValue(tmp_0),
                                                                                              alignment: _descriptor_5.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } }]);
    return [];
  }
  _generateOwnerCommittment_0(sk_0, x_0, y_0, nonce_0) {
    return this._persistentHash_0([sk_0,
                                   __compactRuntime.convertFieldToBytes(32,
                                                                        x_0,
                                                                        'shared-canvas.compact line 108 char 9'),
                                   __compactRuntime.convertFieldToBytes(32,
                                                                        y_0,
                                                                        'shared-canvas.compact line 109 char 9'),
                                   __compactRuntime.convertFieldToBytes(32,
                                                                        nonce_0,
                                                                        'shared-canvas.compact line 110 char 9')]);
  }
  _incrementCoordinate_0(depth_0, x_0, y_0) {
    if (this._equal_1(x_0, 0n) && this._equal_2(y_0, depth_0)) {
      return [((t1) => {
                if (t1 > 4294967295n) {
                  throw new __compactRuntime.CompactError('shared-canvas.compact line 119 char 9: cast from Field or Uint value to smaller Uint value failed: ' + t1 + ' is greater than 4294967295');
                }
                return t1;
              })(depth_0 + 1n),
              ((t1) => {
                if (t1 > 4294967295n) {
                  throw new __compactRuntime.CompactError('shared-canvas.compact line 120 char 9: cast from Field or Uint value to smaller Uint value failed: ' + t1 + ' is greater than 4294967295');
                }
                return t1;
              })(depth_0 + 1n),
              0n];
    } else {
      if (y_0 < depth_0) {
        return [depth_0,
                x_0,
                ((t1) => {
                  if (t1 > 4294967295n) {
                    throw new __compactRuntime.CompactError('shared-canvas.compact line 125 char 22: cast from Field or Uint value to smaller Uint value failed: ' + t1 + ' is greater than 4294967295');
                  }
                  return t1;
                })(y_0 + 1n)];
      } else {
        return [depth_0,
                (__compactRuntime.assert(x_0 >= 1n,
                                         'result of subtraction would be negative'),
                 x_0 - 1n),
                y_0];
      }
    }
  }
  _equal_0(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _equal_1(x0, y0) {
    if (x0 !== y0) { return false; }
    return true;
  }
  _equal_2(x0, y0) {
    if (x0 !== y0) { return false; }
    return true;
  }
}
export function ledger(stateOrChargedState) {
  const state = stateOrChargedState instanceof __compactRuntime.StateValue ? stateOrChargedState : stateOrChargedState.state;
  const chargedState = stateOrChargedState instanceof __compactRuntime.StateValue ? new __compactRuntime.ChargedState(stateOrChargedState) : stateOrChargedState;
  const context = {
    currentQueryContext: new __compactRuntime.QueryContext(chargedState, __compactRuntime.dummyContractAddress()),
    costModel: __compactRuntime.CostModel.initialCostModel()
  };
  const partialProofData = {
    input: { value: [], alignment: [] },
    output: undefined,
    publicTranscript: [],
    privateTranscriptOutputs: []
  };
  return {
    get nextX() {
      return _descriptor_1.fromValue(__compactRuntime.queryLedgerState(context,
                                                                       partialProofData,
                                                                       [
                                                                        { dup: { n: 0 } },
                                                                        { idx: { cached: false,
                                                                                 pushPath: false,
                                                                                 path: [
                                                                                        { tag: 'value',
                                                                                          value: { value: _descriptor_13.toValue(0n),
                                                                                                   alignment: _descriptor_13.alignment() } }] } },
                                                                        { popeq: { cached: false,
                                                                                   result: undefined } }]).value);
    },
    get nextY() {
      return _descriptor_1.fromValue(__compactRuntime.queryLedgerState(context,
                                                                       partialProofData,
                                                                       [
                                                                        { dup: { n: 0 } },
                                                                        { idx: { cached: false,
                                                                                 pushPath: false,
                                                                                 path: [
                                                                                        { tag: 'value',
                                                                                          value: { value: _descriptor_13.toValue(1n),
                                                                                                   alignment: _descriptor_13.alignment() } }] } },
                                                                        { popeq: { cached: false,
                                                                                   result: undefined } }]).value);
    },
    get depth() {
      return _descriptor_1.fromValue(__compactRuntime.queryLedgerState(context,
                                                                       partialProofData,
                                                                       [
                                                                        { dup: { n: 0 } },
                                                                        { idx: { cached: false,
                                                                                 pushPath: false,
                                                                                 path: [
                                                                                        { tag: 'value',
                                                                                          value: { value: _descriptor_13.toValue(2n),
                                                                                                   alignment: _descriptor_13.alignment() } }] } },
                                                                        { popeq: { cached: false,
                                                                                   result: undefined } }]).value);
    },
    canvasIdx: {
      isEmpty(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`isEmpty: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_7.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_13.toValue(3n),
                                                                                                     alignment: _descriptor_13.alignment() } }] } },
                                                                          'size',
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_9.toValue(0n),
                                                                                                                                 alignment: _descriptor_9.alignment() }).encode() } },
                                                                          'eq',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      size(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`size: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_9.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_13.toValue(3n),
                                                                                                     alignment: _descriptor_13.alignment() } }] } },
                                                                          'size',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      member(...args_0) {
        if (args_0.length !== 1) {
          throw new __compactRuntime.CompactError(`member: expected 1 argument, received ${args_0.length}`);
        }
        const key_0 = args_0[0];
        if (!(typeof(key_0) === 'object' && typeof(key_0.x) === 'bigint' && key_0.x >= 0n && key_0.x <= 4294967295n && typeof(key_0.y) === 'bigint' && key_0.y >= 0n && key_0.y <= 4294967295n)) {
          __compactRuntime.typeError('member',
                                     'argument 1',
                                     'shared-canvas.compact line 24 char 1',
                                     'struct Coordinate<x: Uint<0..4294967296>, y: Uint<0..4294967296>>',
                                     key_0)
        }
        return _descriptor_7.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_13.toValue(3n),
                                                                                                     alignment: _descriptor_13.alignment() } }] } },
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_3.toValue(key_0),
                                                                                                                                 alignment: _descriptor_3.alignment() }).encode() } },
                                                                          'member',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      lookup(...args_0) {
        if (args_0.length !== 1) {
          throw new __compactRuntime.CompactError(`lookup: expected 1 argument, received ${args_0.length}`);
        }
        const key_0 = args_0[0];
        if (!(typeof(key_0) === 'object' && typeof(key_0.x) === 'bigint' && key_0.x >= 0n && key_0.x <= 4294967295n && typeof(key_0.y) === 'bigint' && key_0.y >= 0n && key_0.y <= 4294967295n)) {
          __compactRuntime.typeError('lookup',
                                     'argument 1',
                                     'shared-canvas.compact line 24 char 1',
                                     'struct Coordinate<x: Uint<0..4294967296>, y: Uint<0..4294967296>>',
                                     key_0)
        }
        return _descriptor_5.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_13.toValue(3n),
                                                                                                     alignment: _descriptor_13.alignment() } }] } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_3.toValue(key_0),
                                                                                                     alignment: _descriptor_3.alignment() } }] } },
                                                                          { popeq: { cached: false,
                                                                                     result: undefined } }]).value);
      },
      [Symbol.iterator](...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`iter: expected 0 arguments, received ${args_0.length}`);
        }
        const self_0 = state.asArray()[3];
        return self_0.asMap().keys().map(  (key) => {    const value = self_0.asMap().get(key).asCell();    return [      _descriptor_3.fromValue(key.value),      _descriptor_5.fromValue(value.value)    ];  })[Symbol.iterator]();
      }
    }
  };
}
const _emptyContext = {
  currentQueryContext: new __compactRuntime.QueryContext(new __compactRuntime.ContractState().data, __compactRuntime.dummyContractAddress())
};
const _dummyContract = new Contract({
  operatorSecretKey: (...args) => undefined
});
export const pureCircuits = {
  generateOwnerCommittment: (...args_0) => {
    if (args_0.length !== 4) {
      throw new __compactRuntime.CompactError(`generateOwnerCommittment: expected 4 arguments (as invoked from Typescript), received ${args_0.length}`);
    }
    const sk_0 = args_0[0];
    const x_0 = args_0[1];
    const y_0 = args_0[2];
    const nonce_0 = args_0[3];
    if (!(sk_0.buffer instanceof ArrayBuffer && sk_0.BYTES_PER_ELEMENT === 1 && sk_0.length === 32)) {
      __compactRuntime.typeError('generateOwnerCommittment',
                                 'argument 1',
                                 'shared-canvas.compact line 100 char 1',
                                 'Bytes<32>',
                                 sk_0)
    }
    if (!(typeof(x_0) === 'bigint' && x_0 >= 0n && x_0 <= 4294967295n)) {
      __compactRuntime.typeError('generateOwnerCommittment',
                                 'argument 2',
                                 'shared-canvas.compact line 100 char 1',
                                 'Uint<0..4294967296>',
                                 x_0)
    }
    if (!(typeof(y_0) === 'bigint' && y_0 >= 0n && y_0 <= 4294967295n)) {
      __compactRuntime.typeError('generateOwnerCommittment',
                                 'argument 3',
                                 'shared-canvas.compact line 100 char 1',
                                 'Uint<0..4294967296>',
                                 y_0)
    }
    if (!(typeof(nonce_0) === 'bigint' && nonce_0 >= 0n && nonce_0 <= 4294967295n)) {
      __compactRuntime.typeError('generateOwnerCommittment',
                                 'argument 4',
                                 'shared-canvas.compact line 100 char 1',
                                 'Uint<0..4294967296>',
                                 nonce_0)
    }
    return _dummyContract._generateOwnerCommittment_0(sk_0, x_0, y_0, nonce_0);
  },
  incrementCoordinate: (...args_0) => {
    if (args_0.length !== 3) {
      throw new __compactRuntime.CompactError(`incrementCoordinate: expected 3 arguments (as invoked from Typescript), received ${args_0.length}`);
    }
    const depth_0 = args_0[0];
    const x_0 = args_0[1];
    const y_0 = args_0[2];
    if (!(typeof(depth_0) === 'bigint' && depth_0 >= 0n && depth_0 <= 4294967295n)) {
      __compactRuntime.typeError('incrementCoordinate',
                                 'argument 1',
                                 'shared-canvas.compact line 114 char 1',
                                 'Uint<0..4294967296>',
                                 depth_0)
    }
    if (!(typeof(x_0) === 'bigint' && x_0 >= 0n && x_0 <= 4294967295n)) {
      __compactRuntime.typeError('incrementCoordinate',
                                 'argument 2',
                                 'shared-canvas.compact line 114 char 1',
                                 'Uint<0..4294967296>',
                                 x_0)
    }
    if (!(typeof(y_0) === 'bigint' && y_0 >= 0n && y_0 <= 4294967295n)) {
      __compactRuntime.typeError('incrementCoordinate',
                                 'argument 3',
                                 'shared-canvas.compact line 114 char 1',
                                 'Uint<0..4294967296>',
                                 y_0)
    }
    return _dummyContract._incrementCoordinate_0(depth_0, x_0, y_0);
  }
};
export const contractReferenceLocations =
  { tag: 'publicLedgerArray', indices: { } };
//# sourceMappingURL=index.js.map
