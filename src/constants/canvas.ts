/**
 * Canvas constants - Các hằng số cho canvas drawing
 */

// Zoom settings
export const ZOOM_MIN = 0.01;
export const ZOOM_MAX = 50;
export const ZOOM_DEFAULT = 1;
export const ZOOM_STEP = 1.1;
export const ZOOM_STEP_REVERSE = 0.9;

// Interaction settings
export const CLICK_DISTANCE_THRESHOLD = 5; // pixel distance để detect click trên entity
export const CLICK_DISTANCE_THRESHOLD_MIN = 0.5; // Minimum threshold khi zoom in nhiều
export const CLICK_DISTANCE_THRESHOLD_MAX = 5; // Maximum threshold khi zoom out nhiều
export const DEFAULT_DRAG_OFFSET_RATIO = 0.5;

// Line width settings
export const LINE_WIDTH_DEFAULT = 1;
export const LINE_WIDTH_HOVER = 5;

// Color settings
export const COLOR_SEGMENT = "#000000";
export const COLOR_SEWING = "#ff0000";
export const COLOR_SELECTED = "rgba(255, 165, 0, 0.5)";
export const COLOR_HOVER = "#ffffff";
export const COLOR_VERTEX = "#1e90ff";

// Label settings
export const LABEL_FONT_SIZE_SEWING = 12;
export const LABEL_FONT_SIZE_SEGMENT = 11;
export const LABEL_PADDING = 4;
export const LABEL_PADDING_SEGMENT = 3;
export const LABEL_BG_COLOR = "rgba(255, 255, 255, 0.9)";
export const LABEL_BG_COLOR_SEGMENT = "rgba(255, 255, 255, 0.85)";

// Arrow settings
export const ARROW_SIZE = 20;
export const ARROW_RATIO = 0.25; // Vị trí mũi tên tại 25% độ dài

// Vertex settings
export const VERTEX_RADIUS = 4;
