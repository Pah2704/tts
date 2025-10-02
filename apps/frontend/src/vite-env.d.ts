/// <reference types="vite/client" />

// Khai báo biến môi trường bạn dùng
interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
