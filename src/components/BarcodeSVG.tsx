'use client';

import React, { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { pickBarcodeSymbology } from '@/lib/barcode';

interface BarcodeSVGProps {
  value: string;
  height?: number;
  barWidth?: number;
  fontSize?: number;
  displayValue?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

// 2026-09新設: バーコード棚卸機能用。商品のバーコード文字列を実際のバーコード画像(SVG)として
// 描画する共通コンポーネント。商品詳細ページ・ラベル印刷ページ・棚卸ページで共用する。
// 値の形式に応じてEAN-13/UPC/EAN-8/CODE128を自動選択し、万一その規格として不正な値
// （手入力の不正なコードなど）でも、CODE128にフォールバックして必ず何かしら描画する。
export default function BarcodeSVG({
  value,
  height = 60,
  barWidth = 2,
  fontSize = 14,
  displayValue = true,
  className,
  style,
}: BarcodeSVGProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [renderError, setRenderError] = useState(false);

  useEffect(() => {
    if (!svgRef.current || !value) return;
    const format = pickBarcodeSymbology(value);
    try {
      JsBarcode(svgRef.current, value, {
        format,
        width: barWidth,
        height,
        fontSize,
        displayValue,
        margin: 8,
        background: 'transparent',
        lineColor: '#0f172a',
      });
      setRenderError(false);
    } catch {
      // 規格として不正な値の場合はCODE128で再描画（それでも失敗する場合は諦めてエラー表示）
      try {
        JsBarcode(svgRef.current, value, {
          format: 'CODE128',
          width: barWidth,
          height,
          fontSize,
          displayValue,
          margin: 8,
          background: 'transparent',
          lineColor: '#0f172a',
        });
        setRenderError(false);
      } catch (e2) {
        console.error('Barcode render failed:', e2);
        setRenderError(true);
      }
    }
  }, [value, height, barWidth, fontSize, displayValue]);

  if (!value) return null;

  return (
    <div className={className} style={style}>
      <svg ref={svgRef} />
      {renderError && (
        <p style={{ fontSize: '0.75rem', color: '#ef4444' }}>
          バーコードを描画できませんでした（値: {value}）
        </p>
      )}
    </div>
  );
}
