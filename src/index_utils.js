export function tensorDataTypeFromProto(typeProto, TensorProtoLibrary) {
    switch (typeProto) {
    case TensorProtoLibrary.DataType.INT8:
    return 'int8';
    case TensorProtoLibrary.DataType.UINT8:
    return 'uint8';
    case TensorProtoLibrary.DataType.BOOL:
    return 'bool';
    case TensorProtoLibrary.DataType.INT16:
    return 'int16';
    case TensorProtoLibrary.DataType.UINT16:
    return 'uint16';
    case TensorProtoLibrary.DataType.INT32:
    return 'int32';
    case TensorProtoLibrary.DataType.UINT32:
    return 'uint32';
    case TensorProtoLibrary.DataType.FLOAT:
    return 'float32';
    case TensorProtoLibrary.DataType.DOUBLE:
    return 'float64';
    case TensorProtoLibrary.DataType.STRING:
    return 'string';

    // For INT64/UINT64, reduce their value to 32-bits.
    // Should throw exception when overflow
    case TensorProtoLibrary.DataType.INT64:
    return 'int32';
    case TensorProtoLibrary.DataType.UINT64:
    return 'uint32';

    default:
    throw new Error(`unsupported data type: ${TensorProtoLibrary.DataType[typeProto]}`);
    }
}

export function tensorDimsFromProto(dims) {
    // get rid of Long type for dims
    return dims.map(d => d);
}

export function sizeofProto(type, TensorProtoLibrary) {
    switch (type) {
      case TensorProtoLibrary.DataType.UINT8:
      case TensorProtoLibrary.DataType.INT8:
      case TensorProtoLibrary.DataType.BOOL:
        return 1;
      case TensorProtoLibrary.DataType.UINT16:
      case TensorProtoLibrary.DataType.INT16:
        return 2;
      case TensorProtoLibrary.DataType.FLOAT:
      case TensorProtoLibrary.DataType.INT32:
      case TensorProtoLibrary.DataType.UINT32:
        return 4;
      case TensorProtoLibrary.DataType.INT64:
      case TensorProtoLibrary.DataType.DOUBLE:
      case TensorProtoLibrary.DataType.UINT64:
        return 8;
      default:
        throw new Error(`cannot calculate sizeof() on type ${TensorProtoLibrary.DataType[type]}`);
    }
}
  
  // read one value from TensorProto
export function readProto(view, type, byteOffset, TensorProtoLibrary) {
    switch (type) {
      case TensorProtoLibrary.DataType.BOOL:
      case TensorProtoLibrary.DataType.UINT8:
        return view.getUint8(byteOffset);
      case TensorProtoLibrary.DataType.INT8:
        return view.getInt8(byteOffset);
      case TensorProtoLibrary.DataType.UINT16:
        return view.getUint16(byteOffset, true);
      case TensorProtoLibrary.DataType.INT16:
        return view.getInt16(byteOffset, true);
      case TensorProtoLibrary.DataType.FLOAT:
        return view.getFloat32(byteOffset, true);
      case TensorProtoLibrary.DataType.INT32:
        return view.getInt32(byteOffset, true);
      case TensorProtoLibrary.DataType.UINT32:
        return view.getUint32(byteOffset, true);
      case TensorProtoLibrary.DataType.INT64:
        return longToNumber(
            Long.fromBits(view.getUint32(byteOffset, true), view.getUint32(byteOffset + 4, true), false), type);
      case TensorProtoLibrary.DataType.DOUBLE:
        return view.getFloat64(byteOffset, true);
      case TensorProtoLibrary.DataType.UINT64:
        return longToNumber(
            Long.fromBits(view.getUint32(byteOffset, true), view.getUint32(byteOffset + 4, true), true), type);
      default:
        throw new Error(`cannot read from DataView for type ${TensorProtoLibrary.DataType[type]}`);
    }
}

export function longToNumber(i, type, TensorProtoLibrary) {
    // INT64, UINT32, UINT64
    if (type === TensorProtoLibrary.DataType.INT64) {
      if (i.greaterThanOrEqual(2147483648) || i.lessThan(-2147483648)) {
        throw new TypeError('int64 is not supported');
      }
    } else if (
        type === TensorProtoLibrary.DataType.UINT32 ||
        type === TensorProtoLibrary.DataType.UINT64) {
      if (i.greaterThanOrEqual(4294967296) || i.lessThan(0)) {
        throw new TypeError('uint64 is not supported');
      }
    } else {
      throw new TypeError(`not a LONG type: ${TensorProtoLibrary.DataType[type]}`);
    }
  
    return i.toNumber();
}
  