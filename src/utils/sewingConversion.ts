import type { Block, Entity } from "../types";
import { calculateEntityLength, buildSewingVertexesFromSegment } from "./geometry";

/**
 * Chuyển đổi các sewing entity từ dạng offset (px) sang dạng ratio (0..1).
 * Đọc offset từ dữ liệu JSON cũ (nếu có) và chuyển sang ratio.
 */
export const convertOffsetsToRatios = (blocks: Block[]): Block[] => {
  return blocks.map((block) => {
    return {
      ...block,
      entities: block.entities.map((entity) => {
        if (entity.layer !== "sewing" || entity.segmentId == null) return entity;

        // Nếu đã có ratio thì bỏ qua
        if (typeof entity.startRatio === "number" && typeof entity.endRatio === "number") {
          return entity;
        }

        // Tìm segment cha
        const parent = block.entities.find((e) => e.id === entity.segmentId);
        if (!parent) return entity;
        const length = calculateEntityLength(parent.vertexes);
        if (length <= 0) return entity;

        // Đọc offset từ dữ liệu cũ (có thể tồn tại trong JSON nhưng không có trong type)
        const rawEntity = entity as Record<string, unknown>;
        const startOffset = typeof rawEntity.startOffset === "number" ? rawEntity.startOffset : 0;
        const endOffset = typeof rawEntity.endOffset === "number" ? rawEntity.endOffset : length;

        // Clamp
        const clampedStart = Math.max(0, Math.min(length, startOffset));
        const clampedEnd = Math.max(clampedStart, Math.min(length, endOffset));
        const startRatio = clampedStart / length;
        const endRatio = clampedEnd / length;

        return {
          ...entity,
          startRatio,
          endRatio,
        } as Entity;
      }),
    };
  });
};

/**
 * Dựng lại vertexes cho sewing entity dựa trên ratio.
 * Nếu entity có startRatio/endRatio thì generate lại vertexes đồng bộ với segment cha.
 */
export const rebuildSewingFromRatio = (block: Block, entity: Entity): Entity => {
  if (entity.layer !== "sewing" || entity.segmentId == null) return entity;
  if (typeof entity.startRatio !== "number" || typeof entity.endRatio !== "number") return entity;
  const parent = block.entities.find((e) => e.id === entity.segmentId);
  if (!parent) return entity;
  const length = calculateEntityLength(parent.vertexes);
  if (length <= 0) return entity;

  const startOffset = entity.startRatio * length;
  const endOffset = entity.endRatio * length;
  const vertexes = buildSewingVertexesFromSegment(parent, startOffset, endOffset);
  return { ...entity, vertexes };
};

/**
 * Duyệt toàn bộ blocks và rebuild tất cả sewing có ratio.
 */
export const rebuildAllSewingsFromRatio = (blocks: Block[]): Block[] => {
  return blocks.map((block) => {
    return {
      ...block,
      entities: block.entities.map((entity) => rebuildSewingFromRatio(block, entity)),
    };
  });
};
