import { useRef, useEffect, useState } from "react";
import "./Canvas.css";
import initialBlocksData from "../data/blocks.json";
import type { Block } from "../types";
import {
  distanceToLine,
  buildPolygonFromSegments,
  isPointInPolygon,
  translateSewingOnSegment,
  findClosestSegment,
  calculateEntityLength,
  getEntityCenter,
  buildSewingVertexesFromSegment,
  calculateArcLength,
  getClickDistanceThreshold,
  isClosedSegment,
  getPointAndTangentAtArcLength,
  drawArrow,
} from "../utils/geometry";
import { useSelection } from "../hooks/useSelection";
import { useHover } from "../hooks/useHover";
import { useDrag } from "../hooks/useDrag";
import { generateBlocks } from "../utils/generateBlocks";
import { convertOffsetsToRatios, rebuildAllSewingsFromRatio } from "../utils/sewingConversion";
import {
  ZOOM_MIN,
  ZOOM_MAX,
  ZOOM_DEFAULT,
  ZOOM_STEP,
  ZOOM_STEP_REVERSE,
  DEFAULT_DRAG_OFFSET_RATIO,
  LINE_WIDTH_DEFAULT,
  LINE_WIDTH_HOVER,
  COLOR_SEGMENT,
  COLOR_SEWING,
  COLOR_SELECTED,
  COLOR_HOVER,
  COLOR_VERTEX,
  LABEL_FONT_SIZE_SEWING,
  LABEL_FONT_SIZE_SEGMENT,
  LABEL_PADDING,
  LABEL_PADDING_SEGMENT,
  LABEL_BG_COLOR,
  LABEL_BG_COLOR_SEGMENT,
  ARROW_SIZE,
  ARROW_RATIO,
  VERTEX_RADIUS,
} from "../constants/canvas";

const Canvas = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastCursorArcLengthRef = useRef<number | null>(null);

  // Dữ liệu blocks có thể thay đổi
  const [blocks, setBlocks] = useState<Block[]>(() => {
    // Khởi tạo: chuyển sewing offset sang ratio và rebuild vertexes (đảm bảo đồng bộ)
    const withRatios = convertOffsetsToRatios(initialBlocksData.blocks as Block[]);
    return rebuildAllSewingsFromRatio(withRatios);
    // return initialBlocksData.blocks as Block[];
  });

  // Sử dụng custom hooks để quản lý state
  const {
    isBlockSelected,
    isEntitySelected,
    selectBlock,
    selectEntity,
    toggleBlockSelection,
    toggleEntitySelection,
    clearSelection,
  } = useSelection();

  const { isBlockHovered, isEntityHovered, setBlockHover, setEntityHover } = useHover();

  const { isDragging, draggedEntityId, startDrag, endDrag } = useDrag();

  // Trạng thái zoom và pan
  const [zoom, setZoom] = useState(ZOOM_DEFAULT);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Trạng thái kéo block
  const [isDraggingBlock, setIsDraggingBlock] = useState(false);
  const [draggedBlockId, setDraggedBlockId] = useState<number | null>(null);
  const [blockDragStart, setBlockDragStart] = useState({ x: 0, y: 0 });

  // Trạng thái cursor
  const [cursorStyle, setCursorStyle] = useState<"default" | "grab" | "grabbing" | "panning">("default");

  // Trạng thái offset tương đối khi drag sewing (giữ vị trí click ban đầu)
  const [dragOffsetRatio, setDragOffsetRatio] = useState<number>(DEFAULT_DRAG_OFFSET_RATIO); // 0..1, vị trí click trong sewing

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Đặt kích thước canvas bằng kích thước cửa sổ với pixel ratio đúng
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      
      // Set canvas resolution với device pixel ratio
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      
      // Scale context để giữ tỉ lệ đúng
      ctx.scale(dpr, dpr);
      
      renderBlocks();
    };

    const isPointInBlock = (x: number, y: number, block: Block): boolean => {
      // Lấy tất cả segment entities
      const segmentEntities = block.entities.filter((e) => e.layer === "segment");
      if (segmentEntities.length === 0) return false;

      // Xây dựng polygon từ các segment được nối
      const polygon = buildPolygonFromSegments(segmentEntities);

      // Kiểm tra xem điểm có nằm trong polygon không
      return isPointInPolygon(ctx, x, y, polygon);
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Chuyển đổi tọa độ màn hình sang tọa độ thế giới
      const x = (mouseX - pan.x) / zoom;
      const y = (mouseY - pan.y) / zoom;

      // Xử lý panning
      if (isPanning) {
        setCursorStyle("panning");
        setPan({
          x: mouseX - panStart.x,
          y: mouseY - panStart.y,
        });
        renderBlocks();
        return;
      }

      // Xử lý kéo block
      if (isDraggingBlock && draggedBlockId !== null) {
        setCursorStyle("grabbing");
        const dx = x - blockDragStart.x;
        const dy = y - blockDragStart.y;

        setBlocks((prevBlocks) =>
          prevBlocks.map((block) => {
            if (block.id !== draggedBlockId) return block;

            return {
              ...block,
              entities: block.entities.map((entity) => ({
                ...entity,
                vertexes: entity.vertexes.map((v) => ({
                  x: v.x + dx,
                  y: v.y + dy,
                })),
              })),
            };
          })
        );

        setBlockDragStart({ x, y });
        renderBlocks();
        return;
      }

      // Xử lý kéo sewing entity
      if (isDragging && draggedEntityId !== null) {
        setCursorStyle("grabbing");
        setBlocks((prevBlocks) => {
          return prevBlocks.map((block) => {
            // Thu thập segment entities một lần
            const segmentEntities = block.entities.filter((e) => e.layer === "segment");
            return {
              ...block,
              entities: block.entities.map((entity) => {
                if (entity.id !== draggedEntityId) return entity;
                if (entity.layer !== "sewing") return entity;

                // Tìm segment gần nhất với con trỏ
                const closestResult = findClosestSegment(x, y, segmentEntities);
                if (!closestResult) return entity;
                const { segment: closestSegment } = closestResult;

                // Kéo sewing dựa trên ratio (không còn dùng startOffset/endOffset)
                if (entity.startRatio !== undefined && entity.endRatio !== undefined) {
                  const segLength = calculateEntityLength(closestSegment.vertexes);
                  if (segLength <= 0) return entity;
                  const spanRatio = Math.max(0, entity.endRatio - entity.startRatio);

                  // Chiếu con trỏ lên segment để lấy arc-length tại vị trí con trỏ
                  const cursorArcLength = calculateArcLength(
                    closestSegment.vertexes,
                    x,
                    y,
                    lastCursorArcLengthRef.current ?? undefined
                  );
                  lastCursorArcLengthRef.current = cursorArcLength;
                  console.log('🚀 ~ :220 ~ cursorArcLength:', cursorArcLength);
                  const cursorRatio = cursorArcLength / segLength;

                  // Tính start/end mới dựa trên dragOffsetRatio (giữ vị trí click ban đầu)
                  // cursorRatio tương ứng với dragOffsetRatio trong sewing
                  // => startRatio = cursorRatio - dragOffsetRatio * spanRatio
                  let newStartRatio = cursorRatio - dragOffsetRatio * spanRatio;
                  console.log('🚀 ~ :208 ~ newStartRatio:', newStartRatio);
                  let newEndRatio = newStartRatio + spanRatio;
                  console.log('🚀 ~ :210 ~ newEndRatio:', newEndRatio);

                  // Kiểm tra nếu segment khép kín để cho phép wrap-around
                  const isClosed = isClosedSegment(closestSegment);
                  
                  if (!isClosed) {
                    // Clamp và điều chỉnh khi tràn biên (giữ spanRatio không đổi)
                    if (newStartRatio < 0) {
                      newStartRatio = 0;
                      newEndRatio = spanRatio;
                    } else if (newEndRatio > 1) {
                      newEndRatio = 1;
                      newStartRatio = Math.max(0, 1 - spanRatio);
                    }
                  }
                  // Với segment khép kín: KHÔNG normalize, để offset có thể > segLength
                  // và hàm buildSewingVertexesFromSegment sẽ xử lý wrap-around

                  const newStartOffset = newStartRatio * segLength;
                  const newEndOffset = newEndRatio * segLength;
                  const newVertexes = buildSewingVertexesFromSegment(closestSegment, newStartOffset, newEndOffset);
                  return {
                    ...entity,
                    vertexes: newVertexes,
                    segmentId: closestSegment.id,
                    startRatio: newStartRatio,
                    endRatio: newEndRatio,
                  };
                }

                console.log("2 points");
                // Dự phòng: dịch chuyển cũ (cho sewing 2 điểm đơn giản)
                const newVertexes = translateSewingOnSegment(entity, closestSegment, x, y);
                return {
                  ...entity,
                  vertexes: newVertexes,
                  segmentId: closestSegment.id,
                };
              }),
            };
          });
        });
        return; // Bỏ qua phát hiện hover khi đang kéo
      }

      let foundEntity = false;
      let canDragSomething = false;

      // Kiểm tra SEWING entity hover trước (ưu tiên cao nhất)
      for (const block of blocks) {
        for (const entity of block.entities) {
          if (entity.layer !== "sewing") continue; // Chỉ kiểm tra sewing
          if (entity.vertexes.length < 2) continue;

          const distance = distanceToLine(x, y, entity.vertexes);
          if (distance < getClickDistanceThreshold(zoom)) {
            setEntityHover(entity.id);
            foundEntity = true;
            canDragSomething = true;
            break;
          }
        }
        if (foundEntity) break;
      }

      // Kiểm tra SEGMENT entity hover nếu không tìm thấy sewing
      if (!foundEntity) {
        for (const block of blocks) {
          for (const entity of block.entities) {
            if (entity.layer !== "segment") continue; // Chỉ kiểm tra segment
            if (entity.vertexes.length < 2) continue;

            const distance = distanceToLine(x, y, entity.vertexes);
            if (distance < getClickDistanceThreshold(zoom)) {
              setEntityHover(entity.id);
              foundEntity = true;
              canDragSomething = true;
              break;
            }
          }
          if (foundEntity) break;
        }
      }

      // Kiểm tra hover lên block
      if (!foundEntity) {
        for (const block of blocks) {
          if (isPointInBlock(x, y, block)) {
            canDragSomething = true;
            break;
          }
        }
      }

      // Đặt cursor dựa trên trạng thái hover
      if (canDragSomething) {
        setCursorStyle("grab");
      } else {
        setCursorStyle("default");
      }

      if (!foundEntity) {
        setEntityHover(null);
      }

      // Kiểm tra block hover nếu không có entity được hover
      if (!foundEntity) {
        let foundBlock = false;
        for (const block of blocks) {
          if (isPointInBlock(x, y, block)) {
            setBlockHover(block.id);
            foundBlock = true;
            break;
          }
        }

        if (!foundBlock) {
          setBlockHover(null);
        }
      }
    };

    const handleClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Chuyển đổi tọa độ màn hình sang tọa độ thế giới
      const x = (mouseX - pan.x) / zoom;
      const y = (mouseY - pan.y) / zoom;

      let clickedEntity = false;
      let clickedBlock = false;

      // Kiểm tra click vào SEWING entity trước (ưu tiên cao nhất)
      for (const block of blocks) {
        for (const entity of block.entities) {
          if (entity.layer !== "sewing") continue; // Chỉ kiểm tra sewing
          if (entity.vertexes.length < 2) continue;

          const distance = distanceToLine(x, y, entity.vertexes);
          if (distance < getClickDistanceThreshold(zoom)) {
            if (e.shiftKey) {
              // Chọn nhiều entities
              toggleEntitySelection(entity.id);
            } else {
              // Chọn đơn
              selectEntity(entity.id);
            }
            clickedEntity = true;
            break;
          }
        }
        if (clickedEntity) break;
      }

      // Kiểm tra click vào SEGMENT entity nếu không click vào sewing
      if (!clickedEntity) {
        for (const block of blocks) {
          for (const entity of block.entities) {
            if (entity.layer !== "segment") continue; // Chỉ kiểm tra segment
            if (entity.vertexes.length < 2) continue;

            const distance = distanceToLine(x, y, entity.vertexes);
            if (distance < getClickDistanceThreshold(zoom)) {
              if (e.shiftKey) {
                // Chọn nhiều entities
                toggleEntitySelection(entity.id);
              } else {
                // Chọn đơn
                selectEntity(entity.id);
              }
              clickedEntity = true;
              break;
            }
          }
          if (clickedEntity) break;
        }
      }

      // Kiểm tra click vào block
      if (!clickedEntity) {
        for (const block of blocks) {
          if (isPointInBlock(x, y, block)) {
            if (e.shiftKey) {
              // Chọn nhiều blocks
              toggleBlockSelection(block.id);
            } else {
              // Chọn đơn
              selectBlock(block.id);
            }
            clickedBlock = true;
            break;
          }
        }
      }

      // Bỏ chọn nếu click bên ngoài (chỉ khi không giữ Shift)
      if (!clickedEntity && !clickedBlock && !e.shiftKey) {
        clearSelection();
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Chuyển đổi tọa độ màn hình sang tọa độ thế giới
      const x = (mouseX - pan.x) / zoom;
      const y = (mouseY - pan.y) / zoom;

      // Nút giữa chuột để panning
      if (e.button === 1) {
        setIsPanning(true);
        setPanStart({ x: mouseX - pan.x, y: mouseY - pan.y });
        return;
      }

      // Kiểm tra mousedown vào sewing entity để bắt đầu kéo
      let clickedOnSewing = false;
      for (const block of blocks) {
        for (const entity of block.entities) {
          if (entity.layer !== "sewing") continue;
          if (entity.vertexes.length < 2) continue;

          const distance = distanceToLine(x, y, entity.vertexes);
          if (distance < getClickDistanceThreshold(zoom)) {
            // Tìm segment cha để tính vị trí click tương đối
            if (entity.segmentId != null && entity.startRatio != null && entity.endRatio != null) {
              const parent = block.entities.find((e) => e.id === entity.segmentId);
              if (parent) {
                const segLength = calculateEntityLength(parent.vertexes);
                if (segLength > 0) {
                  // Tìm vị trí click dọc theo segment
                  const clickArcLength = calculateArcLength(parent.vertexes, x, y);
                  const clickRatio = clickArcLength / segLength;

                  // Tính vị trí click tương đối trong sewing (0..1)
                  const sewingStart = entity.startRatio;
                  const sewingEnd = entity.endRatio;
                  const sewingSpan = sewingEnd - sewingStart;
                  if (sewingSpan > 0) {
                    const relativeOffset = (clickRatio - sewingStart) / sewingSpan;
                    setDragOffsetRatio(Math.max(0, Math.min(1, relativeOffset)));
                  } else {
                    setDragOffsetRatio(DEFAULT_DRAG_OFFSET_RATIO);
                  }
                }
              }
            }

            startDrag(entity.id);
            // Reset theo dõi arc length liên tục khi bắt đầu kéo
            lastCursorArcLengthRef.current = null;
            clickedOnSewing = true;
            return;
          }
        }
      }

      // Nếu không click vào sewing, kiểm tra click vào block để kéo nó
      if (!clickedOnSewing) {
        for (const block of blocks) {
          if (isPointInBlock(x, y, block)) {
            setIsDraggingBlock(true);
            setDraggedBlockId(block.id);
            setBlockDragStart({ x, y });
            return;
          }
        }
      }
    };

    const handleMouseUp = () => {
      setIsPanning(false);
      setIsDraggingBlock(false);
      setDraggedBlockId(null);
      if (isDragging) {
        endDrag();
        setDragOffsetRatio(DEFAULT_DRAG_OFFSET_RATIO); // Reset về giá trị mặc định
        lastCursorArcLengthRef.current = null;
      }
    };

    const renderBlocks = () => {
      const rect = canvas.getBoundingClientRect();
      
      // Xóa canvas với kích thước đúng
      ctx.clearRect(0, 0, rect.width, rect.height);

      // Áp dụng các phép biến đổi zoom và pan
      ctx.save();
      ctx.translate(pan.x, pan.y);
      ctx.scale(zoom, zoom);

      // Render từng block từ JSON
      blocks.forEach((block) => {
        const isHovered = isBlockHovered(block.id);
        const isSelected = isBlockSelected(block.id);

        // Tô màu block nếu được hover hoặc chọn
        if (isHovered || isSelected) {
          const segmentEntities = block.entities.filter((e) => e.layer === "segment");
          const polygon = buildPolygonFromSegments(segmentEntities);

          if (polygon.length >= 3) {
            ctx.beginPath();
            ctx.moveTo(polygon[0].x, polygon[0].y);
            for (let i = 1; i < polygon.length; i++) {
              ctx.lineTo(polygon[i].x, polygon[i].y);
            }
            ctx.closePath();

            if (isSelected) {
              // Tô màu cam với opacity cho block được chọn
              ctx.fillStyle = COLOR_SELECTED;
            } else {
              // Tô màu trắng cho block được hover
              ctx.fillStyle = COLOR_HOVER;
            }
            ctx.fill();
          }
        }

        // Render từng entity trong block
        block.entities.forEach((entity) => {
          if (entity.vertexes.length < 2) return;

          const isEntityHoveredState = isEntityHovered(entity.id);
          const isEntitySelectedState = isEntitySelected(entity.id);

          ctx.beginPath();

          // Di chuyển đến vertex đầu tiên
          const firstVertex = entity.vertexes[0];
          ctx.moveTo(firstVertex.x, firstVertex.y);

          // Vẽ đường đến các vertex tiếp theo
          for (let i = 1; i < entity.vertexes.length; i++) {
            const vertex = entity.vertexes[i];
            ctx.lineTo(vertex.x, vertex.y);
          }

          // Kiểu nét vẽ dựa trên layer và trạng thái
          if (entity.layer === "sewing") {
            ctx.strokeStyle = COLOR_SEWING; // Đỏ cho sewing
          } else {
            ctx.strokeStyle = COLOR_SEGMENT; // Đen cho segment
          }

          // Độ dày nét vẽ dựa trên trạng thái hover/selected (không bị scale)
          if (isEntityHoveredState || isEntitySelectedState) {
            ctx.lineWidth = LINE_WIDTH_HOVER / zoom;
          } else {
            ctx.lineWidth = LINE_WIDTH_DEFAULT / zoom;
          }

          ctx.stroke();

          // Render mũi tên chỉ hướng tại 25% độ dài
          const totalLength = calculateEntityLength(entity.vertexes);
          const arrowArcLength = totalLength * ARROW_RATIO;
          const arrowData = getPointAndTangentAtArcLength(entity.vertexes, arrowArcLength);
          
          if (arrowData) {
            const arrowColor = entity.layer === "sewing" ? COLOR_SEWING : COLOR_SEGMENT;
            
            // Vẽ mũi tên trong world space (chịu ảnh hưởng bởi zoom)
            drawArrow(
              ctx,
              arrowData.point.x,
              arrowData.point.y,
              arrowData.tangent.x,
              arrowData.tangent.y,
              ARROW_SIZE / zoom,
              arrowColor,
              LINE_WIDTH_DEFAULT / zoom
            );
          }

          // Vẽ circle nhỏ tại mỗi vertex
          entity.vertexes.forEach((vertex, index) => {
            ctx.beginPath();
            ctx.arc(vertex.x, vertex.y, VERTEX_RADIUS / zoom, 0, Math.PI * 2);
            ctx.fillStyle = COLOR_VERTEX;
            ctx.fill();

            // Vẽ số thứ tự cho vertex của sewing
            if (entity.layer === "sewing") {
              ctx.save();
              const dpr = window.devicePixelRatio || 1;
              ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

              const screenX = vertex.x * zoom + pan.x;
              const screenY = vertex.y * zoom + pan.y;

              ctx.font = "20px Arial";
              ctx.fillStyle = COLOR_VERTEX;
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";

              // Vẽ nền trắng cho số
              // const textMetrics = ctx.measureText(index.toString());
              // const padding = 4;
              // const bgX = screenX - textMetrics.width / 2 - padding;
              // const bgY = screenY - 10 - 16;
              // const bgWidth = textMetrics.width + padding * 2;
              // const bgHeight = 32;

              // ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
              // ctx.fillRect(bgX, bgY, bgWidth, bgHeight);

              // Vẽ số thứ tự
              ctx.fillStyle = 'red';
              ctx.fillText(index.toString(), screenX, screenY - 10);

              ctx.restore();
            }
          });

          // Render nhãn cho sewing entities (độ dài)
          if (entity.layer === "sewing") {
            const length = calculateEntityLength(entity.vertexes);
            const center = getEntityCenter(entity.vertexes);

            // Định dạng độ dài với 1 chữ số thập phân
            const labelText = `${length.toFixed(1)}px`;

            // Lưu context để reset transformation cho text
            ctx.save();
            const dpr = window.devicePixelRatio || 1;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // Reset nhưng giữ DPR scaling

            // Chuyển đổi điểm trung tâm sang tọa độ màn hình
            const screenX = center.x * zoom + pan.x;
            const screenY = center.y * zoom + pan.y;

            // Đặt kiểu text (không bị scale)
            ctx.font = `${LABEL_FONT_SIZE_SEWING}px Arial`;
            ctx.fillStyle = COLOR_SEWING;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";

            // Vẽ nền để dễ đọc hơn
            const textMetrics = ctx.measureText(labelText);
            const padding = LABEL_PADDING;
            const bgX = screenX - textMetrics.width / 2 - padding;
            const bgY = screenY - 8;
            const bgWidth = textMetrics.width + padding * 2;
            const bgHeight = 16;

            ctx.fillStyle = LABEL_BG_COLOR;
            ctx.fillRect(bgX, bgY, bgWidth, bgHeight);

            // Vẽ viền quanh nhãn (không bị scale)
            ctx.strokeStyle = COLOR_SEWING;
            ctx.lineWidth = 1;
            ctx.strokeRect(bgX, bgY, bgWidth, bgHeight);

            // Vẽ text
            ctx.fillStyle = COLOR_SEWING;
            ctx.fillText(labelText, screenX, screenY);

            // Khôi phục context
            ctx.restore();
          }

          // Render nhãn cho segment entities (ID)
          if (entity.layer === "segment") {
            const center = getEntityCenter(entity.vertexes);

            // Hiển thị segment ID
            const labelText = `#${entity.id}`;

            // Lưu context để reset transformation cho text
            ctx.save();
            const dpr = window.devicePixelRatio || 1;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // Reset nhưng giữ DPR scaling

            // Chuyển đổi điểm trung tâm sang tọa độ màn hình
            const screenX = center.x * zoom + pan.x;
            const screenY = center.y * zoom + pan.y;

            // Đặt kiểu text (không bị scale)
            ctx.font = `${LABEL_FONT_SIZE_SEGMENT}px Arial`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";

            // Vẽ nền để dễ đọc hơn
            const textMetrics = ctx.measureText(labelText);
            const padding = LABEL_PADDING_SEGMENT;
            const bgX = screenX - textMetrics.width / 2 - padding;
            const bgY = screenY - 8;
            const bgWidth = textMetrics.width + padding * 2;
            const bgHeight = 16;

            ctx.fillStyle = LABEL_BG_COLOR_SEGMENT;
            ctx.fillRect(bgX, bgY, bgWidth, bgHeight);

            // Vẽ viền quanh nhãn (không bị scale)
            ctx.strokeStyle = COLOR_SEGMENT;
            ctx.lineWidth = 1;
            ctx.strokeRect(bgX, bgY, bgWidth, bgHeight);

            // Vẽ text
            ctx.fillStyle = COLOR_SEGMENT;
            ctx.fillText(labelText, screenX, screenY);

            // Khôi phục context
            ctx.restore();
          }
        });
      });

      // Khôi phục trạng thái canvas
      ctx.restore();
    };

    // Render ban đầu
    resizeCanvas();

    // Xử lý zoom
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Tính hệ số zoom
      const zoomFactor = e.deltaY > 0 ? ZOOM_STEP_REVERSE : ZOOM_STEP;
      const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom * zoomFactor));

      // Zoom về phía vị trí chuột
      const worldX = (mouseX - pan.x) / zoom;
      const worldY = (mouseY - pan.y) / zoom;

      setPan({
        x: mouseX - worldX * newZoom,
        y: mouseY - worldY * newZoom,
      });
      setZoom(newZoom);
      renderBlocks();
    };

    // Xử lý zoom bằng bàn phím
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        const newZoom = Math.min(ZOOM_MAX, zoom * ZOOM_STEP);
        setZoom(newZoom);
        renderBlocks();
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        const newZoom = Math.max(ZOOM_MIN, zoom * ZOOM_STEP_REVERSE);
        setZoom(newZoom);
        renderBlocks();
      } else if (e.key === "0") {
        e.preventDefault();
        setZoom(ZOOM_DEFAULT);
        setPan({ x: 0, y: 0 });
        renderBlocks();
      }
    };

    // Xử lý resize cửa sổ
    window.addEventListener("resize", resizeCanvas);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mouseup", handleMouseUp);
    canvas.addEventListener("click", handleClick);
    canvas.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mousedown", handleMouseDown);
      canvas.removeEventListener("mouseup", handleMouseUp);
      canvas.removeEventListener("click", handleClick);
      canvas.removeEventListener("wheel", handleWheel);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    blocks,
    isBlockHovered,
    isBlockSelected,
    isEntityHovered,
    isEntitySelected,
    setBlockHover,
    setEntityHover,
    selectBlock,
    selectEntity,
    toggleBlockSelection,
    toggleEntitySelection,
    clearSelection,
    isDragging,
    draggedEntityId,
    startDrag,
    endDrag,
    zoom,
    pan,
    isPanning,
    panStart,
    isDraggingBlock,
    draggedBlockId,
    blockDragStart,
    cursorStyle,
    dragOffsetRatio,
  ]);

  // Hàm xử lý tạo blocks mới
  const handleGenerateBlocks = () => {
    const count = parseInt(prompt("Nhập số lượng blocks (VD: 100):", "100") || "100");
    const gap = parseInt(prompt("Nhập khoảng cách giữa các blocks (px):", "60") || "60");

    if (count > 0) {
      const newBlocks = generateBlocks(count, gap);
      const withRatios = convertOffsetsToRatios(newBlocks);
      setBlocks(rebuildAllSewingsFromRatio(withRatios));
      // Reset zoom và pan
      setZoom(ZOOM_DEFAULT);
      setPan({ x: 0, y: 0 });
    }
  };

  // Hàm reset về dữ liệu ban đầu
  const handleResetBlocks = () => {
    const withRatios = convertOffsetsToRatios(initialBlocksData.blocks as Block[]);
    setBlocks(rebuildAllSewingsFromRatio(withRatios));
    setZoom(ZOOM_DEFAULT);
    setPan({ x: 0, y: 0 });
  };

  return (
    <>
      <div className="controls">
        <button onClick={handleGenerateBlocks} className="control-btn">
          Tạo Blocks Test ({blocks.length} blocks)
        </button>
        <button onClick={handleResetBlocks} className="control-btn">
          Reset về dữ liệu gốc
        </button>
      </div>
      <canvas ref={canvasRef} className={`fullscreen-canvas cursor-${cursorStyle}`} />
    </>
  );
};

export default Canvas;
