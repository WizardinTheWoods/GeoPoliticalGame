// Messages between the main thread (render/UI) and the sim worker. The UI never mutates
// sim state: it sends Commands, and the AI factions will use the same Command API.
import type { Stockpile } from './resources';

export type Command = { kind: 'digCanal'; i: number };
export type CommandResult = { ok: true; dirty: number[] } | { ok: false; reason: string };

export type ToWorker =
  | { type: 'init'; seed: number; w: number; h: number }
  | { type: 'cmd'; cmd: Command };

export interface WorldMessage {
  type: 'world';
  seed: number;
  w: number;
  h: number;
  terrain: Uint8Array;
  ground: Uint8Array;
  fertility: Float32Array;
  forest: Uint8Array;
  deposit: Uint8Array;
  genMs: number;
}

export interface HexUpdateMessage {
  type: 'hexes';
  idx: Int32Array;
  terrain: Uint8Array;
  ground: Uint8Array;
  fertility: Float32Array;
  forest: Uint8Array;
  deposit: Uint8Array;
}

export type FromWorker =
  | WorldMessage
  | HexUpdateMessage
  | { type: 'tick'; tick: number; stock: Stockpile; vehicles: Float32Array; stepMs: number }
  | { type: 'rejected'; reason: string };
