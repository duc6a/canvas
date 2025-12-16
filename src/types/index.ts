export type Point = {
  x: number;
  y: number;
};

export type Entity = {
  id: number;
  type: string;
  layer: "segment" | "sewing";
  vertexes: Point[];
  segmentId?: number; // Cho sewing entities - tham chiếu đến segment cha
  startRatio?: number; // Tỉ lệ bắt đầu (0..1) theo chiều dài segment cha
  endRatio?: number; // Tỉ lệ kết thúc (0..1) theo chiều dài segment cha
};

export interface Block {
  id: number;
  name: string;
  entities: Entity[];
}
