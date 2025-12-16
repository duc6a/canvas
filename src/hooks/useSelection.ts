import { useState, useCallback } from "react";

interface UseSelectionReturn {
  selectedBlockIds: number[];
  selectedEntityIds: number[];
  isBlockSelected: (id: number) => boolean;
  isEntitySelected: (id: number) => boolean;
  selectBlock: (id: number) => void;
  selectEntity: (id: number) => void;
  toggleBlockSelection: (id: number) => void;
  toggleEntitySelection: (id: number) => void;
  clearSelection: () => void;
  clearBlockSelection: () => void;
  clearEntitySelection: () => void;
}

/**
 * Custom hook để quản lý trạng thái chọn block và entity
 * Quy tắc: Có thể chọn nhiều block HOẶC nhiều entity, nhưng không thể chọn cả hai cùng lúc
 */
export const useSelection = (): UseSelectionReturn => {
  const [selectedBlockIds, setSelectedBlockIds] = useState<number[]>([]);
  const [selectedEntityIds, setSelectedEntityIds] = useState<number[]>([]);

  // Kiểm tra xem block có được chọn không
  const isBlockSelected = useCallback((id: number) => selectedBlockIds.includes(id), [selectedBlockIds]);

  // Kiểm tra xem entity có được chọn không
  const isEntitySelected = useCallback((id: number) => selectedEntityIds.includes(id), [selectedEntityIds]);

  // Chọn một block duy nhất (thay thế selection, xóa entities)
  const selectBlock = useCallback((id: number) => {
    setSelectedBlockIds([id]);
    setSelectedEntityIds([]);
  }, []);

  // Chọn một entity duy nhất (thay thế selection, xóa blocks)
  const selectEntity = useCallback((id: number) => {
    setSelectedEntityIds([id]);
    setSelectedBlockIds([]);
  }, []);

  // Chuyển đổi chọn block (cho chế độ multi-select với Shift+Click)
  const toggleBlockSelection = useCallback((id: number) => {
    setSelectedEntityIds([]); // Xóa entity selection
    setSelectedBlockIds((prev) => (prev.includes(id) ? prev.filter((blockId) => blockId !== id) : [...prev, id]));
  }, []);

  // Chuyển đổi chọn entity (cho chế độ multi-select với Shift+Click)
  const toggleEntitySelection = useCallback((id: number) => {
    setSelectedBlockIds([]); // Xóa block selection
    setSelectedEntityIds((prev) => (prev.includes(id) ? prev.filter((entityId) => entityId !== id) : [...prev, id]));
  }, []);

  // Xóa tất cả selections
  const clearSelection = useCallback(() => {
    setSelectedBlockIds([]);
    setSelectedEntityIds([]);
  }, []);

  // Chỉ xóa block selection
  const clearBlockSelection = useCallback(() => {
    setSelectedBlockIds([]);
  }, []);

  // Chỉ xóa entity selection
  const clearEntitySelection = useCallback(() => {
    setSelectedEntityIds([]);
  }, []);

  return {
    selectedBlockIds,
    selectedEntityIds,
    isBlockSelected,
    isEntitySelected,
    selectBlock,
    selectEntity,
    toggleBlockSelection,
    toggleEntitySelection,
    clearSelection,
    clearBlockSelection,
    clearEntitySelection,
  };
};
