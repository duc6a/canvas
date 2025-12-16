import type { Block, Entity } from "../types";
import { calculateEntityLength } from "./geometry";
import blocksData from "../data/blocks.json";

/**
 * Tạo một số lượng lớn blocks để kiểm tra hiệu năng
 * @param count Số lượng blocks cần tạo
 * @param gap Khoảng cách giữa các blocks (mặc định 60px)
 * @returns Mảng các blocks đã được sắp xếp theo lưới
 */
export function generateBlocks(count: number, gap: number = 60): Block[] {
  const BLOCKS_PER_ROW = 10;
  const templateBlocks = blocksData.blocks as Block[];
  const generatedBlocks: Block[] = [];

  // Tính toán kích thước của mỗi template block (bounding box)
  const blockSizes = templateBlocks.map((block) => {
    let minX = Infinity,
      maxX = -Infinity;
    let minY = Infinity,
      maxY = -Infinity;

    block.entities.forEach((entity) => {
      entity.vertexes.forEach((vertex) => {
        minX = Math.min(minX, vertex.x);
        maxX = Math.max(maxX, vertex.x);
        minY = Math.min(minY, vertex.y);
        maxY = Math.max(maxY, vertex.y);
      });
    });

    return {
      width: maxX - minX,
      height: maxY - minY,
      minX,
      minY,
    };
  });

  // Tính chiều cao của mỗi hàng (chiều cao của block cao nhất trong template)
  const maxRowHeight = Math.max(...blockSizes.map((size) => size.height));

  let currentId = 1;
  let currentEntityId = 1;

  // Lưu trữ template index cho mỗi block để tính toán offset chính xác
  const blockTemplateIndices: number[] = [];

  for (let i = 0; i < count; i++) {
    // Chọn template block ngẫu nhiên
    const templateIndex = Math.floor(Math.random() * templateBlocks.length);
    blockTemplateIndices.push(templateIndex);

    const template = templateBlocks[templateIndex];
    const templateSize = blockSizes[templateIndex];

    // Tính vị trí trong lưới
    const col = i % BLOCKS_PER_ROW;
    const row = Math.floor(i / BLOCKS_PER_ROW);

    // Tính toán offset X (cột) - dựa trên các blocks trước đó trong cùng hàng
    let offsetX = 0;
    for (let c = 0; c < col; c++) {
      const prevBlockIndex = row * BLOCKS_PER_ROW + c;
      const prevTemplateIndex = blockTemplateIndices[prevBlockIndex];
      offsetX += blockSizes[prevTemplateIndex].width + gap;
    }

    // Tính toán offset Y (hàng) - căn lề dưới
    const offsetY = row * (maxRowHeight + gap) + (maxRowHeight - templateSize.height);

    // Clone template block với ID mới và offset vị trí
    const newEntities: Entity[] = template.entities.map((entity) => {
      const shiftedVertexes = entity.vertexes.map((vertex) => ({
        x: vertex.x - templateSize.minX + offsetX + gap,
        y: vertex.y - templateSize.minY + offsetY + gap,
      }));

      // Với sewing entity: tính startRatio/endRatio dựa trên segment cha
      if (entity.layer === "sewing" && entity.segmentId != null) {
        const parentTemplate = template.entities.find((e) => e.id === entity.segmentId);
        if (parentTemplate) {
          const length = calculateEntityLength(parentTemplate.vertexes);
          if (length > 0) {
            // Truy cập offset từ dữ liệu gốc JSON nếu có (tồn tại nhưng không trong type)
            const rawStart =
              typeof (entity as Record<string, unknown>).startOffset === "number"
                ? (entity as Record<string, unknown>).startOffset
                : 0;
            const rawEnd =
              typeof (entity as Record<string, unknown>).endOffset === "number"
                ? (entity as Record<string, unknown>).endOffset
                : length;
            const clampedStart = Math.max(0, Math.min(length, rawStart as number));
            const clampedEnd = Math.max(clampedStart, Math.min(length, rawEnd as number));
            const startRatio = clampedStart / length;
            const endRatio = clampedEnd / length;
            return {
              ...entity,
              id: currentEntityId++,
              vertexes: shiftedVertexes,
              startRatio,
              endRatio,
            } as Entity;
          }
        }
      }

      return {
        ...entity,
        id: currentEntityId++,
        vertexes: shiftedVertexes,
      } as Entity;
    });

    const newBlock: Block = {
      id: currentId++,
      name: `${template.name} #${i + 1}`,
      entities: newEntities,
    };

    generatedBlocks.push(newBlock);
  }

  return generatedBlocks;
}
