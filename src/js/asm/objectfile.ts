import {Expr} from './expr.js';

export interface ObjectFile {
  /** All chunks, in a determinstic (indexable) order. */
  chunks: Chunk[];
  /** All symbols, in a deterministic (indexable) order. */
  symbols: Symbol[];
  /** All segments.  Indexed by name, but we don't use a map. */
  segments: Segment[];
}

export interface Chunk {
  /** Which segments this chunk may be located in. */
  segments: string[];
  /** Absolute address of the start of the chunk, if not relocatable. */
  org?: number;
  /** Data for the chunk, either a Uint8Array or a Base64-encoded string. */
  data: string|Uint8Array;
  /** Substitutions to insert into the data. */
  subs?: Substitution[];
  /** Assertions within this chunk. Each expression must be nonzero. */
  asserts?: Expr[];
}

export interface Symbol {
  /** Name to export this symbol as, for importing into other objects. */
  export?: string;
  /** Name to import this symbol as from another object. */
  import?: string;
  /** Index of the chunk this symbol is defined in. */
  chunk?: number; // TODO - is this actually necessary?
  /** Byte offset into the chunk for the definition. */
  offset?: number;
  /** Value of the symbol. */
  expr?: Expr;
}

export interface Segment {
  /** Name of the segment, as used in .segment directives. */
  name: string;
  /** Bank for the segment. */
  bank: number;
  /** Segment size in bytes. */
  size: number;
  /** Offset of the segment in the rom image. */
  offset: number;
  /** Memory location of the segment in the CPU. */
  memory: number;
}

export interface Substitution {
  /** Offset into the chunk to substitute the expression into. */
  offset: number;
  /** Number of bytes to substitute. */
  size: number;
  /** Expression to substitute. */
  expr: Expr;
}
