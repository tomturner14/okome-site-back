// 型拡張: cookie-session と Express.Request に userId/ping を生やす
import "cookie-session";

declare module "cookie-session" {
  interface CookieSessionObject {
    userId?: number; // ← ここを型で保証
    ping?: number;
  }
}

// Express.Request の session を cookie-session の型に寄せる
declare global {
  namespace Express {
    interface Request {
      session: import("cookie-session").CookieSessionObject;
    }
  }
}

export { };
