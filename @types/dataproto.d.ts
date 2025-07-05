// Type definitions for binary data serialization library
declare module "dataproto" {
	export const decoder: TextDecoder;
	export const encoder: TextEncoder;

	// Primitive type constructors
	global {
		const Double: NumberConstructor;
		const Float64: NumberConstructor;
		const Float: (value: number) => number;
		const Float32: (value: number) => number;
		const Int: (value: number) => number;
		const Int32: (value: number) => number;
		const Short: (value: number) => number;
		const Uint16: (value: number) => number;
		const Byte: (value: number) => number;
		const Uint8: (value: number) => number;
		const Uint32: (value: number) => number;
		const Int16: (value: number) => number;
		const Int8: (value: number) => number;
		const Bool: BooleanConstructor;
		const DataReader: DataReader;
		const DataWriter: DataWriter;
	}

	// Type definitions for encodable values
	type PrimitiveType = 
		| typeof Uint8 
		| typeof Int8 
		| typeof Uint16 
		| typeof Int16 
		| typeof Uint32 
		| typeof Int32 
		| typeof Float32 
		| typeof Float64 
		| typeof Boolean 
		| typeof String 
		| typeof Uint8Array;

	type ArrayType<T> = [T] | [T, number];
	type ObjectType = { [key: string]: DataType };

	interface EncodableType {
		decode(reader: DataReader, target?: any): any;
		encode(writer: DataWriter, value: any): void;
	}

	type DataType = 
		| PrimitiveType
		| [DataType] | [DataType, number]  // Array types
		| { [key: string]: DataType }      // Object types  
		| EncodableType;

	export class DataReader extends DataView {
		i: number;
		
		constructor(arr: ArrayBuffer | ArrayBufferView);
		
		// Generic read method
		read<T = any>(type: DataType, target?: T): T;
		readVer<T = any>(history: DataType[], target?: T): T;
		
		// Primitive readers
		byte(): number;
		uint8(): number;
		int8(): number;
		uint16(): number;
		short(): number;
		int16(): number;
		int(): number;
		uint32(): number;
		int32(): number;
		float(): number;
		float32(): number;
		double(): number;
		float64(): number;
		bool(): boolean;
		boolean(): boolean;
		
		// Variable-length integer
		flint(): number;
		
		// Complex types
		uint8array(len?: number): Uint8Array;
		string(): string;
		
		// Utility
		get left(): number;
		toWriter(from?: number, to?: number): DataWriter;
	}

	export class DataWriter extends Array<Uint8Array> {
		cur: DataView;
		i: number;
		
		constructor();
		
		// Internal methods
		allocnew(): void;
		
		// Generic write method
		write(type: DataType, value: any): void;
		writeVer(history: DataType[], value: any): void;
		
		// Primitive writers
		byte(n: number): void;
		uint8(n: number): void;
		int8(n: number): void;
		short(n: number): void;
		uint16(n: number): void;
		int16(n: number): void;
		int(n: number): void;
		uint32(n: number): void;
		int32(n: number): void;
		float(n: number): void;
		float32(n: number): void;
		double(n: number): void;
		float64(n: number): void;
		bool(n: boolean): void;
		boolean(n: boolean): void;
		
		// Variable-length integer
		flint(n: number): void;
		
		// Complex types
		uint8array(v: Uint8Array, len?: number): void;
		string(v: string): void;
		
		// Utility
		get byteLength(): number;
		toReader(paddingStart?: number, paddingEnd?: number): DataReader;
		build(paddingStart?: number, paddingEnd?: number): Uint8Array;
	}

	// Type registration
	export function registerTypes(dict: { [key: string]: any }): void;

	// JSON serialization for types
	export function typeToJson(type: DataType): string;
	export function jsonToType(json: string): DataType;

	// Encodable helper
	export function Encodable(
		decode: (reader: DataReader, target?: any) => any,
		encode: (writer: DataWriter, value: any) => void
	): EncodableType;

	// Export type aliases for convenience
	export type { DataType, PrimitiveType, ArrayType, ObjectType, EncodableType };
}