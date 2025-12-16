import { useState } from "react";

export const useDrag = () => {
  const [isDragging, setIsDragging] = useState(false);
  const [draggedEntityId, setDraggedEntityId] = useState<number | null>(null);

  const startDrag = (entityId: number) => {
    setIsDragging(true);
    setDraggedEntityId(entityId);
  };

  const endDrag = () => {
    setIsDragging(false);
    setDraggedEntityId(null);
  };

  const isDraggingEntity = (entityId: number) => {
    return isDragging && draggedEntityId === entityId;
  };

  return {
    isDragging,
    draggedEntityId,
    isDraggingEntity,
    startDrag,
    endDrag,
  };
};
