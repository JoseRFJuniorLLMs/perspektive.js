import * as flatbuffers from 'flatbuffers';

/**
 * Manual FlatBuffers Decoder for Perspektive.Binary.GraphDelta
 * Designed for NietzscheDB high-performance streaming.
 */
export class BinaryDecoder {
  static decodeDelta(data: Uint8Array) {
    const bb = new flatbuffers.ByteBuffer(data);
    const root = bb.readInt32(bb.position()) + bb.position();
    
    // GraphDelta table offsets
    const upsertNodesPos = this.getOffset(bb, root, 4);
    const upsertEdgesPos = this.getOffset(bb, root, 6);
    const deleteNodesPos = this.getOffset(bb, root, 8);

    const nodes = upsertNodesPos ? this.readNodeVector(bb, upsertNodesPos) : [];
    const edges = upsertEdgesPos ? this.readEdgeVector(bb, upsertEdgesPos) : [];
    const deletes = deleteNodesPos ? this.readStringVector(bb, deleteNodesPos) : [];

    return { nodes, edges, deletes };
  }

  private static getOffset(bb: flatbuffers.ByteBuffer, pos: number, voffset: number): number {
    const vtable = pos - bb.readInt32(pos);
    const vtableOffset = bb.readInt16(vtable + voffset);
    return vtableOffset !== 0 ? pos + vtableOffset : 0;
  }

  private static readNodeVector(bb: flatbuffers.ByteBuffer, pos: number) {
    const vectorPos = pos + bb.readInt32(pos) + 4;
    const length = bb.readInt32(pos + bb.readInt32(pos));
    const results = [];

    for (let i = 0; i < length; i++) {
        const nodeTablePos = vectorPos + i * 4 + bb.readInt32(vectorPos + i * 4);
        results.push({
            id: this.readString(bb, this.getOffset(bb, nodeTablePos, 4)),
            node_type: this.readString(bb, this.getOffset(bb, nodeTablePos, 6)),
            energy: this.readFloat(bb, this.getOffset(bb, nodeTablePos, 8)),
            x: this.readVec3(bb, this.getOffset(bb, nodeTablePos, 10))?.x,
            y: this.readVec3(bb, this.getOffset(bb, nodeTablePos, 10))?.y,
            embedding: this.readFloatVector(bb, this.getOffset(bb, nodeTablePos, 12)),
            arousal: this.readFloat(bb, this.getOffset(bb, nodeTablePos, 14)),
            valence: this.readFloat(bb, this.getOffset(bb, nodeTablePos, 16)),
        });
    }
    return results;
  }

  private static readVec3(bb: flatbuffers.ByteBuffer, pos: number) {
      if (!pos) return null;
      return {
          x: bb.readFloat32(pos),
          y: bb.readFloat32(pos + 4),
          z: bb.readFloat32(pos + 8),
      };
  }

  private static readFloatVector(bb: flatbuffers.ByteBuffer, pos: number) {
      if (!pos) return [];
      const vectorPos = pos + bb.readInt32(pos) + 4;
      const length = bb.readInt32(pos + bb.readInt32(pos));
      const results = new Float32Array(length);
      for (let i = 0; i < length; i++) {
          results[i] = bb.readFloat32(vectorPos + i * 4);
      }
      return Array.from(results);
  }

  private static readEdgeVector(bb: flatbuffers.ByteBuffer, pos: number) {
    const vectorPos = pos + bb.readInt32(pos) + 4;
    const length = bb.readInt32(pos + bb.readInt32(pos));
    const results = [];

    for (let i = 0; i < length; i++) {
        const edgeTablePos = vectorPos + i * 4 + bb.readInt32(vectorPos + i * 4);
        results.push({
            source: this.readString(bb, this.getOffset(bb, edgeTablePos, 4)),
            target: this.readString(bb, this.getOffset(bb, edgeTablePos, 6)),
            weight: this.readFloat(bb, this.getOffset(bb, edgeTablePos, 8)),
        });
    }
    return results;
  }

  private static readStringVector(bb: flatbuffers.ByteBuffer, pos: number) {
    const vectorPos = pos + bb.readInt32(pos) + 4;
    const length = bb.readInt32(pos + bb.readInt32(pos));
    const results = [];
    for (let i = 0; i < length; i++) {
        results.push(this.readString(bb, vectorPos + i * 4 + bb.readInt32(vectorPos + i * 4)));
    }
    return results;
  }

  private static readString(bb: flatbuffers.ByteBuffer, pos: number): string {
    if (!pos) return '';
    const stringPos = pos + bb.readInt32(pos) + 4;
    const length = bb.readInt32(pos + bb.readInt32(pos));
    const u8 = bb.bytes().subarray(stringPos, stringPos + length);
    return new TextDecoder().decode(u8);
  }

  private static readFloat(bb: flatbuffers.ByteBuffer, pos: number): number {
    return pos ? bb.readFloat32(pos) : 0;
  }
}
