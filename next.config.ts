import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */

  // 2026-09-12: GoogleログインでsignInWithPopupを使うと、ブラウザに
  // 「Cross-Origin-Opener-Policy policy would block the window.closed call.」
  // という警告が出て、ポップアップの完了検知(window.closed のポーリング)が
  // ブロックされ、ログインが完了しない不具合が確認された。
  // デフォルトのCOOPが `same-origin` 相当になっていたため、自分が開いた
  // ポップアップへのアクセスだけは許可する `same-origin-allow-popups` に
  // 明示的に上書きする。
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
