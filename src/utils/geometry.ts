import { CLICK_DISTANCE_THRESHOLD, CLICK_DISTANCE_THRESHOLD_MAX, CLICK_DISTANCE_THRESHOLD_MIN } from "../constants";
import type { Point, Entity } from "../types";

/**
 * Kiểm tra xem segment có phải khép kín không (điểm đầu ≈ điểm cuối)
 */
export const isClosedSegment = (segment: Entity, tolerance: number = 1): boolean => {
  if (segment.vertexes.length < 2) return false;
  const first = segment.vertexes[0];
  const last = segment.vertexes[segment.vertexes.length - 1];
  const distance = Math.hypot(last.x - first.x, last.y - first.y);
  return distance <= tolerance;
};

/**
 * Chiếu một điểm lên đoạn thẳng và trả về điểm gần nhất trên đoạn đó
 */
export const projectPointOntoSegment = (
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): Point => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) return { x: x1, y: y1 };

  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  return {
    x: x1 + t * dx,
    y: y1 + t * dy,
  };
};

/**
 * Tính khoảng cách từ một điểm đến đoạn thẳng
 */
export const distanceToSegment = (px: number, py: number, x1: number, y1: number, x2: number, y2: number): number => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) return Math.hypot(px - x1, py - y1);

  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const nearestX = x1 + t * dx;
  const nearestY = y1 + t * dy;

  return Math.hypot(px - nearestX, py - nearestY);
};

/**
 * Tính khoảng cách nhỏ nhất từ một điểm đến đường (entity)
 */
export const distanceToLine = (px: number, py: number, vertices: Point[]): number => {
  let minDist = Infinity;

  for (let i = 0; i < vertices.length - 1; i++) {
    const p1 = vertices[i];
    const p2 = vertices[i + 1];

    const dist = distanceToSegment(px, py, p1.x, p1.y, p2.x, p2.y);
    minDist = Math.min(minDist, dist);
  }

  return minDist;
};

/**
 * Xây dựng polygon từ các segment entities được nối với nhau
 * Bao gồm tất cả các điểm trung gian cho các segment cong
 */
export const buildPolygonFromSegments = (segmentEntities: Entity[]): Point[] => {
  const polygon: Point[] = [];

  if (segmentEntities.length === 0) return polygon;

  // Bắt đầu với segment đầu tiên - thêm TẤT CẢ các điểm của nó
  if (segmentEntities[0].vertexes.length >= 2) {
    polygon.push(...segmentEntities[0].vertexes);
  }

  // Nối các segment còn lại
  for (let i = 1; i < segmentEntities.length; i++) {
    const segment = segmentEntities[i];
    if (segment.vertexes.length < 2) continue;

    const lastPoint = polygon[polygon.length - 1];
    const firstVertex = segment.vertexes[0];
    const lastVertex = segment.vertexes[segment.vertexes.length - 1];

    // Kiểm tra xem segment này có kết nối với polygon không
    const connectsAtStart = lastPoint.x === firstVertex.x && lastPoint.y === firstVertex.y;
    const connectsAtEnd = lastPoint.x === lastVertex.x && lastPoint.y === lastVertex.y;

    if (connectsAtStart) {
      // Thêm tất cả điểm trừ điểm đầu tiên (đã có trong polygon)
      for (let j = 1; j < segment.vertexes.length; j++) {
        polygon.push(segment.vertexes[j]);
      }
    } else if (connectsAtEnd) {
      // Thêm tất cả điểm theo thứ tự ngược lại, trừ điểm cuối (đã có trong polygon)
      for (let j = segment.vertexes.length - 2; j >= 0; j--) {
        polygon.push(segment.vertexes[j]);
      }
    }
  }

  return polygon;
};

/**
 * Kiểm tra xem một điểm có nằm trong polygon không sử dụng canvas context
 */
export const isPointInPolygon = (ctx: CanvasRenderingContext2D, x: number, y: number, polygon: Point[]): boolean => {
  // ctx không còn dùng để vẽ, đánh dấu là đã dùng để tránh cảnh báo TS
  void ctx;
  if (polygon.length < 3) return false;

  // Sử dụng ray casting algorithm để tránh vấn đề với context transformation
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }

  return inside;
};

/**
 * Tìm segment gần nhất và tham số t cho một điểm trên entity nhiều segment
 * Trả về { segmentIndex, t } với t là vị trí chuẩn hóa (0-1) trên segment đó
 */
export const findClosestSegmentParameter = (
  px: number,
  py: number,
  vertexes: Point[]
): { segmentIndex: number; t: number } => {
  let minDistance = Infinity;
  let bestSegmentIndex = 0;
  let bestT = 0;

  for (let i = 0; i < vertexes.length - 1; i++) {
    const v1 = vertexes[i];
    const v2 = vertexes[i + 1];

    const dx = v2.x - v1.x;
    const dy = v2.y - v1.y;
    const lenSq = dx * dx + dy * dy;

    if (lenSq === 0) continue;

    let t = ((px - v1.x) * dx + (py - v1.y) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));

    const projX = v1.x + t * dx;
    const projY = v1.y + t * dy;
    const distance = Math.hypot(px - projX, py - projY);

    if (distance < minDistance) {
      minDistance = distance;
      bestSegmentIndex = i;
      bestT = t;
    }
  }

  return { segmentIndex: bestSegmentIndex, t: bestT };
};

/**
 * Dịch chuyển sewing dọc theo segment cha của nó
 * Duy trì hình dạng sewing bằng cách di chuyển tất cả điểm theo tỷ lệ
 */
export const translateSewingOnSegment = (
  sewing: Entity,
  segment: Entity,
  targetX: number,
  targetY: number
): Point[] => {
  if (sewing.vertexes.length === 0 || segment.vertexes.length === 0) {
    return sewing.vertexes;
  }

  // Tìm tâm của sewing
  const sewingCenter = {
    x: sewing.vertexes.reduce((sum, v) => sum + v.x, 0) / sewing.vertexes.length,
    y: sewing.vertexes.reduce((sum, v) => sum + v.y, 0) / sewing.vertexes.length,
  };

  // Tìm vị trí điểm đích chiếu lên segment
  const { segmentIndex: targetSegIdx, t: targetT } = findClosestSegmentParameter(targetX, targetY, segment.vertexes);

  // Tìm vị trí tâm sewing hiện tại chiếu lên segment
  const { segmentIndex: currentSegIdx, t: currentT } = findClosestSegmentParameter(
    sewingCenter.x,
    sewingCenter.y,
    segment.vertexes
  );

  // Tính độ dài arc tích lũy dọc theo segment
  const getArcLength = (segIdx: number, t: number): number => {
    let length = 0;

    // Thêm các segment đầy đủ trước segIdx
    for (let i = 0; i < segIdx; i++) {
      const v1 = segment.vertexes[i];
      const v2 = segment.vertexes[i + 1];
      length += Math.hypot(v2.x - v1.x, v2.y - v1.y);
    }

    // Thêm segment một phần
    const v1 = segment.vertexes[segIdx];
    const v2 = segment.vertexes[segIdx + 1];
    length += t * Math.hypot(v2.x - v1.x, v2.y - v1.y);

    return length;
  };

  const currentArcLength = getArcLength(currentSegIdx, currentT);
  const targetArcLength = getArcLength(targetSegIdx, targetT);
  const deltaArcLength = targetArcLength - currentArcLength;

  // Di chuyển từng điểm của sewing dọc theo segment theo delta arc length
  return sewing.vertexes.map((vertex) => {
    // Tìm vị trí điểm này chiếu lên segment
    const { segmentIndex, t } = findClosestSegmentParameter(vertex.x, vertex.y, segment.vertexes);
    const currentLength = getArcLength(segmentIndex, t);
    const newLength = currentLength + deltaArcLength;

    // Tìm vị trí mới tại newLength
    let accumulatedLength = 0;
    for (let i = 0; i < segment.vertexes.length - 1; i++) {
      const v1 = segment.vertexes[i];
      const v2 = segment.vertexes[i + 1];
      const segmentLength = Math.hypot(v2.x - v1.x, v2.y - v1.y);

      if (accumulatedLength + segmentLength >= newLength) {
        const remainingLength = newLength - accumulatedLength;
        const newT = remainingLength / segmentLength;

        return {
          x: v1.x + newT * (v2.x - v1.x),
          y: v1.y + newT * (v2.y - v1.y),
        };
      }

      accumulatedLength += segmentLength;
    }

    // Nếu vượt quá cuối, giới hạn tại điểm cuối cùng
    return segment.vertexes[segment.vertexes.length - 1];
  });
};

/**
 * Tìm segment entity gần nhất với một điểm từ danh sách các segment entities
 * Trả về segment và khoảng cách đến nó
 */
export const findClosestSegment = (
  px: number,
  py: number,
  segments: Entity[]
): { segment: Entity; distance: number } | null => {
  if (segments.length === 0) return null;

  let closestSegment = segments[0];
  let minDistance = distanceToLine(px, py, segments[0].vertexes);

  for (let i = 1; i < segments.length; i++) {
    const distance = distanceToLine(px, py, segments[i].vertexes);
    if (distance < minDistance) {
      minDistance = distance;
      closestSegment = segments[i];
    }
  }

  return { segment: closestSegment, distance: minDistance };
};

/**
 * Tính tổng độ dài của polyline/arc được định nghĩa bởi các vertex
 */
export const calculateEntityLength = (vertexes: Point[]): number => {
  if (vertexes.length < 2) return 0;

  let totalLength = 0;
  for (let i = 0; i < vertexes.length - 1; i++) {
    const v1 = vertexes[i];
    const v2 = vertexes[i + 1];
    totalLength += Math.hypot(v2.x - v1.x, v2.y - v1.y);
  }

  return totalLength;
};

/**
 * Lấy điểm trung tâm của polyline/arc
 */
export const getEntityCenter = (vertexes: Point[]): Point => {
  if (vertexes.length === 0) return { x: 0, y: 0 };

  const centerX = vertexes.reduce((sum, v) => sum + v.x, 0) / vertexes.length;
  const centerY = vertexes.reduce((sum, v) => sum + v.y, 0) / vertexes.length;

  return { x: centerX, y: centerY };
};

/**
 * Xây dựng các vertex cho sewing, hỗ trợ cả segment khép kín (wrap-around) và segment mở
 */
const buildClosedSewingVertexes = (
  segment: Entity,
  startOffset: number,
  endOffset: number,
  totalLength: number,
  sampleAtLength: (target: number) => Point,
  isClosed: boolean = true
): Point[] => {
  // Xác định phạm vi clamp dựa trên loại segment
  const clampedStart = isClosed
    ? ((startOffset % totalLength) + totalLength) % totalLength
    : Math.max(0, Math.min(totalLength, startOffset));
  const clampedEnd = isClosed
    ? ((endOffset % totalLength) + totalLength) % totalLength
    : Math.max(clampedStart, Math.min(totalLength, endOffset));

  // Tính độ dài span
  const lengthSpan = isClosed && clampedEnd < clampedStart
    ? totalLength - clampedStart + clampedEnd
    : clampedEnd - clampedStart;
  if (lengthSpan <= 0) return [];

  // Thu thập các vertex trong phạm vi
  const result: Point[] = [];
  result.push(sampleAtLength(clampedStart));

  const allowWrap = isClosed && clampedEnd < clampedStart;
  
  if (!allowWrap) {
    let accumulated = 0;
    for (let i = 0; i < segment.vertexes.length; i++) {
      if (i > 0) {
        const v1 = segment.vertexes[i - 1];
        const v2 = segment.vertexes[i];
        accumulated += Math.hypot(v2.x - v1.x, v2.y - v1.y);
      }
      if (accumulated > clampedStart && accumulated < clampedEnd) {
        result.push(segment.vertexes[i]);
      }
    }
  } else {
    // Wrap-around: thu thập từ clampedStart đến cuối
    let accumulated = 0;
    for (let i = 0; i < segment.vertexes.length; i++) {
      if (i > 0) {
        const v1 = segment.vertexes[i - 1];
        const v2 = segment.vertexes[i];
        accumulated += Math.hypot(v2.x - v1.x, v2.y - v1.y);
      }
      if (accumulated > clampedStart) {
        result.push(segment.vertexes[i]);
      }
    }

    // Wrap-around: thu thập từ đầu đến clampedEnd
    accumulated = 0;
    for (let i = 0; i < segment.vertexes.length; i++) {
      if (i > 0) {
        const v1 = segment.vertexes[i - 1];
        const v2 = segment.vertexes[i];
        accumulated += Math.hypot(v2.x - v1.x, v2.y - v1.y);
      }
      if (accumulated < clampedEnd) {
        if (i < segment.vertexes.length - 1 || accumulated < clampedEnd - 0.1) {
          result.push(segment.vertexes[i]);
        }
      }
    }
  }

  // Thêm điểm kết thúc nếu cần
  const endPoint = sampleAtLength(clampedEnd);
  const lastPoint = result[result.length - 1];
  if (Math.hypot(endPoint.x - lastPoint.x, endPoint.y - lastPoint.y) > 0.1) {
    result.push(endPoint);
  }

  return result;
};

/**
 * Xây dựng các vertex cho sewing dựa trên segment cha và offset theo arc-length.
 * Sewing sẽ kế thừa hình dạng của segment bên dưới giữa startOffset và endOffset.
 * Nếu segment ngắn hơn phạm vi yêu cầu, nó sẽ được giới hạn.
 */
export const buildSewingVertexesFromSegment = (
  segment: Entity,
  startOffset: number,
  endOffset: number
  //   _sampleDensity: number = 5 // Không sử dụng - chúng ta bao gồm tất cả vertex của segment để đảm bảo độ chính xác
): Point[] => {
  if (segment.vertexes.length < 2) return [];
  const totalLength = calculateEntityLength(segment.vertexes);
  if (totalLength <= 0) return [];

  const isClosed = isClosedSegment(segment);

  // Hàm hỗ trợ để lấy mẫu một điểm tại arc-length cụ thể dọc theo segment polyline
  const sampleAtLength = (target: number): Point => {
    const normalizedTarget = isClosed ? ((target % totalLength) + totalLength) % totalLength : target;

    let accumulated = 0;
    for (let i = 0; i < segment.vertexes.length - 1; i++) {
      const v1 = segment.vertexes[i];
      const v2 = segment.vertexes[i + 1];
      const segLen = Math.hypot(v2.x - v1.x, v2.y - v1.y);
      if (accumulated + segLen >= normalizedTarget) {
        const remain = normalizedTarget - accumulated;
        const t = segLen === 0 ? 0 : remain / segLen;
        return { x: v1.x + t * (v2.x - v1.x), y: v1.y + t * (v2.y - v1.y) };
      }
      accumulated += segLen;
    }
    return segment.vertexes[segment.vertexes.length - 1];
  };

  return buildClosedSewingVertexes(segment, startOffset, endOffset, totalLength, sampleAtLength, isClosed);
};

// Hàm tính threshold dựa trên zoom level để dễ thao tác khi zoom in
export const getClickDistanceThreshold = (zoomLevel: number): number => {
  // Khi zoom in, threshold giảm trong world space để dễ chọn entity gần nhau
  const threshold = CLICK_DISTANCE_THRESHOLD / zoomLevel;
  // Giới hạn threshold trong khoảng hợp lý
  return Math.max(CLICK_DISTANCE_THRESHOLD_MIN, Math.min(CLICK_DISTANCE_THRESHOLD_MAX, threshold));
};

// Kiểm tra polyline có khép kín không dựa trên danh sách vertexes
export const isClosedVertexes = (vertexes: Point[], tolerance: number = 1): boolean => {
  if (vertexes.length < 2) return false;
  const first = vertexes[0];
  const last = vertexes[vertexes.length - 1];
  return Math.hypot(last.x - first.x, last.y - first.y) <= tolerance;
};

// Hàm tính arc length từ đầu segment đến vị trí chỉ định
export const calculateArcLength = (
  vertexes: Point[],
  x: number,
  y: number,
  previousArcLength?: number
): number => {
  const totalLength = calculateEntityLength(vertexes);
  const { segmentIndex, t: tParam } = findClosestSegmentParameter(x, y, vertexes);

  let acc = 0;
  // Tính tổng độ dài các đoạn từ 0 đến segmentIndex
  for (let i = 0; i < segmentIndex; i++) {
    const a = vertexes[i];
    const b = vertexes[i + 1];
    acc += Math.hypot(b.x - a.x, b.y - a.y);
  }
  // Cộng thêm phần tỷ lệ t trong đoạn hiện tại
  const a = vertexes[segmentIndex];
  const b = vertexes[segmentIndex + 1];
  acc += tParam * Math.hypot(b.x - a.x, b.y - a.y);

  // Xử lý wrap-around để giữ độ dài liên tục cho polyline khép kín
  if (previousArcLength !== undefined && totalLength > 0 && isClosedVertexes(vertexes)) {
    const TL = totalLength;
    const quarter = TL * 0.25;
    const threeQuarter = TL * 0.75;

    // Trường hợp đi xuôi qua seam: từ gần cuối sang đầu
    if (previousArcLength > threeQuarter && acc < quarter && previousArcLength - acc > TL * 0.5) {
      acc += TL;
    }
    // Trường hợp đi ngược qua seam: từ gần đầu sang cuối
    else if (previousArcLength < quarter && acc > threeQuarter && acc - previousArcLength > TL * 0.5) {
      acc -= TL;
    }
  }

  return acc;
};

/**
 * Tìm vị trí (point) và hướng (tangent) trên polyline tại một arc length cụ thể
 * @param vertexes - Danh sách các vertex
 * @param targetArcLength - Arc length mục tiêu (0 = điểm đầu, totalLength = điểm cuối)
 * @returns { point: { x, y }, tangent: { x, y } } hoặc null nếu không tìm thấy
 */
export const getPointAndTangentAtArcLength = (
  vertexes: Point[],
  targetArcLength: number
): { point: Point; tangent: Point } | null => {
  if (vertexes.length < 2) return null;

  let accumulatedLength = 0;
  let currentSegmentIndex = -1;
  let currentSegmentRatio = 0;

  // Tìm segment chứa target arc length
  for (let i = 0; i < vertexes.length - 1; i++) {
    const p1 = vertexes[i];
    const p2 = vertexes[i + 1];
    const segmentLength = Math.hypot(p2.x - p1.x, p2.y - p1.y);

    if (accumulatedLength + segmentLength >= targetArcLength) {
      // Mục tiêu nằm trên segment này
      const remainingLength = targetArcLength - accumulatedLength;
      currentSegmentRatio = segmentLength > 0 ? remainingLength / segmentLength : 0;
      currentSegmentIndex = i;
      break;
    }

    accumulatedLength += segmentLength;
  }

  if (currentSegmentIndex === -1) {
    // Vượt quá, trả về điểm cuối với tiếp tuyến từ segment cuối
    const lastPoint = vertexes[vertexes.length - 1];
    const prevPoint = vertexes[vertexes.length - 2];
    const dx = lastPoint.x - prevPoint.x;
    const dy = lastPoint.y - prevPoint.y;
    const length = Math.hypot(dx, dy);
    return {
      point: lastPoint,
      tangent: {
        x: length > 0 ? dx / length : 0,
        y: length > 0 ? dy / length : 0,
      },
    };
  }

  // Tính điểm tại vị trí
  const p1 = vertexes[currentSegmentIndex];
  const p2 = vertexes[currentSegmentIndex + 1];
  const x = p1.x + currentSegmentRatio * (p2.x - p1.x);
  const y = p1.y + currentSegmentRatio * (p2.y - p1.y);

  // Tính tiếp tuyến bằng cách lấy điểm phía trước và phía sau
  // Điều này cho kết quả chính xác hơn với đường cong
  let prevPoint: Point;
  let nextPoint: Point;

  // Xác định điểm trước
  if (currentSegmentRatio > 0.1) {
    // Lấy điểm phía trước trên segment hiện tại
    const prevRatio = Math.max(0, currentSegmentRatio - 0.1);
    prevPoint = {
      x: p1.x + prevRatio * (p2.x - p1.x),
      y: p1.y + prevRatio * (p2.y - p1.y),
    };
  } else if (currentSegmentIndex > 0) {
    // Lấy điểm từ segment trước
    const prevSegment = vertexes[currentSegmentIndex - 1];
    prevPoint = prevSegment;
  } else {
    prevPoint = p1;
  }

  // Xác định điểm sau
  if (currentSegmentRatio < 0.9) {
    // Lấy điểm phía sau trên segment hiện tại
    const nextRatio = Math.min(1, currentSegmentRatio + 0.1);
    nextPoint = {
      x: p1.x + nextRatio * (p2.x - p1.x),
      y: p1.y + nextRatio * (p2.y - p1.y),
    };
  } else if (currentSegmentIndex < vertexes.length - 2) {
    // Lấy điểm từ segment tiếp theo
    nextPoint = vertexes[currentSegmentIndex + 2];
  } else {
    nextPoint = p2;
  }

  // Tính tiếp tuyến từ vector prevPoint -> nextPoint
  const dx = nextPoint.x - prevPoint.x;
  const dy = nextPoint.y - prevPoint.y;
  const length = Math.hypot(dx, dy);
  const tangentX = length > 0 ? dx / length : 0;
  const tangentY = length > 0 ? dy / length : 0;

  return {
    point: { x, y },
    tangent: { x: tangentX, y: tangentY },
  };
};

/**
 * Vẽ mũi tên trên canvas
 * @param ctx - Canvas context
 * @param fromX - Tọa độ X gốc của mũi tên (nằm trên entity)
 * @param fromY - Tọa độ Y gốc của mũi tên (nằm trên entity)
 * @param dirX - Thành phần X của hướng (đã chuẩn hóa)
 * @param dirY - Thành phần Y của hướng (đã chuẩn hóa)
 * @param arrowSize - Kích thước mũi tên
 * @param color - Màu mũi tên
 */
export const drawArrow = (
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  dirX: number,
  dirY: number,
  arrowSize: number,
  color: string,
  lineWidth: number = 1
): void => {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;

  // Tip nằm ngay trên entity tại (fromX, fromY)
  const tipX = fromX;
  const tipY = fromY;

  // Vector vuông góc để tạo hai nhánh mũi tên
  const perpX = -dirY;
  const perpY = dirX;

  // Lùi về sau theo hướng ngược lại, đồng thời lệch hai bên
  const backOffset = arrowSize * 0.6;
  const wingWidth = arrowSize * 0.35;

  const leftX = tipX - dirX * backOffset + perpX * wingWidth;
  const leftY = tipY - dirY * backOffset + perpY * wingWidth;

  const rightX = tipX - dirX * backOffset - perpX * wingWidth;
  const rightY = tipY - dirY * backOffset - perpY * wingWidth;

  // Vẽ hai nhánh hình chữ V xuất phát từ tip
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(leftX, leftY);
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(rightX, rightY);
  ctx.stroke();
};

/**
 * Kiểm tra xem một sewing cùng chiều hay ngược chiều với segment khép kín chứa nó
 * @param segment - Segment khép kín (closed segment)
 * @param sewing - Sewing entity
 * @returns "same" nếu cùng chiều, "opposite" nếu ngược chiều, "unknown" nếu không thể xác định
 */
export const checkSewingDirection = (
  segment: Point[],
  sewing: Point[]
): "same" | "opposite" | "unknown" => {
  if (!segment || !sewing || segment.length < 2 || sewing.length < 2) {
    return "unknown";
  }

  // Kiểm tra xem segment có khép kín không
  const isClosed = isClosedVertexes(segment);
  if (!isClosed) {
    return "unknown"; // Chỉ kiểm tra với segment khép kín
  }

  // Tính tổng độ dài segment
  const totalSegmentLength = calculateEntityLength(segment);
  if (totalSegmentLength <= 0) {
    return "unknown";
  }

  // Lấy vertex đầu và cuối của sewing
  const sewingFirst = sewing[0];
  const sewingLast = sewing[sewing.length - 1];

  // Tính arc length của từng điểm trên segment
  const getArcLengthOnSegment = (point: Point, segmentVertexes: Point[]): number => {
    let minDistance = Infinity;
    let closestArcLength = 0;

    let accumulatedLength = 0;
    for (let i = 0; i < segmentVertexes.length - 1; i++) {
      const p1 = segmentVertexes[i];
      const p2 = segmentVertexes[i + 1];

      const dist = distanceToSegment(point.x, point.y, p1.x, p1.y, p2.x, p2.y);
      if (dist < minDistance) {
        minDistance = dist;
        // Tính arc length của điểm trên segment này
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const segLen = Math.hypot(dx, dy);
        const t = segLen > 0 ? ((point.x - p1.x) * dx + (point.y - p1.y) * dy) / (segLen * segLen) : 0;
        const clampedT = Math.max(0, Math.min(1, t));
        closestArcLength = accumulatedLength + clampedT * segLen;
      }

      accumulatedLength += Math.hypot(p2.x - p1.x, p2.y - p1.y);
    }

    return closestArcLength;
  };

  let firstArcLength = getArcLengthOnSegment(sewingFirst, segment);
  let lastArcLength = getArcLengthOnSegment(sewingLast, segment);

  // Xử lý wrap-around cho segment khép kín
  // Nếu hiệu quá lớn (> 50% độ dài), có thể có wrap-around
  const diff = lastArcLength - firstArcLength;
  
  // Nếu sewing bắt đầu gần cuối segment và kết thúc gần đầu, cách ngắn nhất là wrap-around
  if (diff < -totalSegmentLength * 0.5) {
    // Sewing đi qua điểm khép kín từ cuối sang đầu
    lastArcLength += totalSegmentLength;
  } else if (diff > totalSegmentLength * 0.5) {
    // Sewing đi qua điểm khép kín từ đầu sang cuối (ít khả năng)
    firstArcLength += totalSegmentLength;
  }

  // So sánh arc length để xác định chiều
  const finalDiff = lastArcLength - firstArcLength;
  
  if (Math.abs(finalDiff) < 1) {
    return "unknown";
  }

  return finalDiff > 0 ? "same" : "opposite";
};
