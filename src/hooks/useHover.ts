import { useState, useCallback } from "react";

interface UseHoverReturn {
  hoveredBlockId: number | null;
  hoveredEntityId: number | null;
  isBlockHovered: (id: number) => boolean;
  isEntityHovered: (id: number) => boolean;
  setBlockHover: (id: number | null) => void;
  setEntityHover: (id: number | null) => void;
  clearHover: () => void;
}

/**
 * Custom hook để quản lý trạng thái hover của block và entity
 * Entity hover có ưu tiên cao hơn block hover
 */
export const useHover = (): UseHoverReturn => {
  const [hoveredBlockId, setHoveredBlockId] = useState<number | null>(null);
  const [hoveredEntityId, setHoveredEntityId] = useState<number | null>(null);

  // Kiểm tra xem block có đang được hover không
  const isBlockHovered = useCallback((id: number) => hoveredBlockId === id, [hoveredBlockId]);

  // Kiểm tra xem entity có đang được hover không
  const isEntityHovered = useCallback((id: number) => hoveredEntityId === id, [hoveredEntityId]);

  // Đặt block hover (sẽ bị xóa nếu entity được hover)
  const setBlockHover = useCallback((id: number | null) => {
    setHoveredBlockId(id);
  }, []);

  // Đặt entity hover (xóa block hover)
  const setEntityHover = useCallback((id: number | null) => {
    setHoveredEntityId(id);
    if (id !== null) {
      setHoveredBlockId(null); // Xóa block hover khi entity được hover
    }
  }, []);

  // Xóa tất cả trạng thái hover
  const clearHover = useCallback(() => {
    setHoveredBlockId(null);
    setHoveredEntityId(null);
  }, []);

  return {
    hoveredBlockId,
    hoveredEntityId,
    isBlockHovered,
    isEntityHovered,
    setBlockHover,
    setEntityHover,
    clearHover,
  };
};
