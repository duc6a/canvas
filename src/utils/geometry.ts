import type { Point, Entity } from "../types";

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
  const clampedStart = Math.max(0, Math.min(totalLength, startOffset));
  const clampedEnd = Math.max(clampedStart, Math.min(totalLength, endOffset));
  const lengthSpan = clampedEnd - clampedStart;
  if (lengthSpan <= 0) return [];

  // Hàm hỗ trợ để lấy mẫu một điểm tại arc-length cụ thể dọc theo segment polyline
  const sampleAtLength = (target: number): Point => {
    let accumulated = 0;
    for (let i = 0; i < segment.vertexes.length - 1; i++) {
      const v1 = segment.vertexes[i];
      const v2 = segment.vertexes[i + 1];
      const segLen = Math.hypot(v2.x - v1.x, v2.y - v1.y);
      if (accumulated + segLen >= target) {
        const remain = target - accumulated;
        const t = segLen === 0 ? 0 : remain / segLen;
        return { x: v1.x + t * (v2.x - v1.x), y: v1.y + t * (v2.y - v1.y) };
      }
      accumulated += segLen;
    }
    return segment.vertexes[segment.vertexes.length - 1];
  };

  // Thu thập tất cả vị trí vertex của segment nằm trong phạm vi sewing
  const result: Point[] = [];
  let accumulated = 0;

  // Thêm điểm bắt đầu
  result.push(sampleAtLength(clampedStart));

  // Thêm tất cả vertex của segment nằm trong phạm vi sewing
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

  // Thêm điểm kết thúc nếu chưa được thêm
  const endPoint = sampleAtLength(clampedEnd);
  const lastPoint = result[result.length - 1];
  if (Math.hypot(endPoint.x - lastPoint.x, endPoint.y - lastPoint.y) > 0.1) {
    result.push(endPoint);
  }

  return result;
};
