# Canvas Drawing App 🎨

Ứng dụng vẽ đồ họa trên HTML5 Canvas sử dụng React + TypeScript + Vite.

## ✨ Tính năng

- ✏️ Vẽ tự do bằng chuột
- �� Chọn màu sắc tùy ý
- 📏 Điều chỉnh độ dày nét vẽ (1-20px)
- 🗑️ Xóa toàn bộ canvas
- 📱 Responsive design

## 🚀 Cài đặt

### Yêu cầu hệ thống
- Node.js version **20.19+** hoặc **22.12+**

**Lưu ý:** Hiện tại hệ thống đang dùng Node.js v18.20.4. Để chạy ứng dụng, bạn cần upgrade Node.js:

```bash
# Sử dụng nvm (Node Version Manager)
nvm install 20
nvm use 20

# Hoặc sử dụng n
npm install -g n
sudo n 20
```

### Cài đặt dependencies

Dependencies đã được cài đặt sẵn khi scaffold project.

## 🎯 Chạy ứng dụng

### Development mode
```bash
npm run dev
```

Sau đó mở trình duyệt tại `http://localhost:5173`

### Build production
```bash
npm run build
```

### Preview production build
```bash
npm run preview
```

## 🛠️ Công nghệ sử dụng

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite 7** - Build tool & dev server
- **HTML5 Canvas API** - Graphics rendering

## 📝 Hướng dẫn sử dụng

1. Chọn màu sắc từ color picker
2. Điều chỉnh độ dày nét vẽ bằng slider
3. Click và kéo chuột trên canvas để vẽ
4. Click nút "Clear Canvas" để xóa toàn bộ

## 📂 Cấu trúc project

```
src/
├── components/
│   ├── Canvas.tsx       # Component canvas chính
│   └── Canvas.css       # Styles cho canvas
├── App.tsx             # Root component
├── App.css            # App styles
├── main.tsx           # Entry point
└── index.css          # Global styles
```

## 🔧 VS Code Tasks

Project đã có sẵn task "Run Dev Server" trong VS Code. Nhấn `Cmd+Shift+B` (macOS) hoặc `Ctrl+Shift+B` (Windows/Linux) để chạy.

---

Tạo bởi GitHub Copilot 🤖
