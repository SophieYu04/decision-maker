import React, { useRef, useState, useCallback, useEffect } from 'react';
import { motion } from 'motion/react';

export interface PieSegment {
  id: string;
  name: string;
  color: string;
  icon: string;
}

interface Props {
  segments: PieSegment[];
  weights: number[];
  onWeightsChange: (newWeights: number[]) => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

const SZ = 260;
const CX = SZ / 2;
const CY = SZ / 2;
const R_OUT = 108;
const R_IN  = 56;
const R_LABEL = (R_OUT + R_IN) / 2 + 2; // label midpoint
const MIN_W = 5; // minimum weight %
const MIN_ANG = (MIN_W / 100) * 360;
const HANDLE_VIS = 9;
const HANDLE_HIT = 22;

// Convert chart angle (0=top, clockwise) to SVG coordinates
function toXY(angle: number, r: number): [number, number] {
  const rad = angle * Math.PI / 180;
  return [CX + r * Math.sin(rad), CY - r * Math.cos(rad)];
}

// Get angle in chart coords from dx, dy relative to center
function getAngle(dx: number, dy: number): number {
  return (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
}

function cumAngles(weights: number[]): number[] {
  const total = weights.reduce((s, w) => s + w, 0) || 100;
  let sum = 0;
  return weights.map(w => { sum += (w / total) * 360; return sum; });
}

function donutPath(startAng: number, endAng: number): string {
  const gap = 1.2;
  const s = startAng + gap, e = endAng - gap;
  if (e - s < 1) return '';
  const [x1, y1] = toXY(s, R_OUT);
  const [x2, y2] = toXY(e, R_OUT);
  const [x3, y3] = toXY(e, R_IN);
  const [x4, y4] = toXY(s, R_IN);
  const large = (e - s) > 180 ? 1 : 0;
  return [
    `M ${x1.toFixed(2)} ${y1.toFixed(2)}`,
    `A ${R_OUT} ${R_OUT} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`,
    `L ${x3.toFixed(2)} ${y3.toFixed(2)}`,
    `A ${R_IN} ${R_IN} 0 ${large} 0 ${x4.toFixed(2)} ${y4.toFixed(2)}`,
    'Z',
  ].join(' ');
}

export function DraggablePieChart({ segments, weights, onWeightsChange, selectedId, onSelect }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const draggingRef = useRef<number | null>(null);
  const weightsRef = useRef(weights);
  weightsRef.current = weights;
  const onChangeRef = useRef(onWeightsChange);
  onChangeRef.current = onWeightsChange;

  const [isDragging, setIsDragging] = useState<number | null>(null);

  const cum = cumAngles(weights);
  const n = segments.length;

  const getSegmentAngles = (i: number) => ({
    start: i === 0 ? 0 : cum[i - 1],
    end: cum[i],
  });

  const handlePointerDown = useCallback((e: React.PointerEvent<SVGCircleElement>, boundaryIdx: number) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingRef.current = boundaryIdx;
    setIsDragging(boundaryIdx);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<SVGCircleElement>, boundaryIdx: number) => {
    if (draggingRef.current !== boundaryIdx) return;
    e.preventDefault();
    if (!svgRef.current) return;

    const rect = svgRef.current.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    const newAngle = getAngle(dx, dy);

    const ws = weightsRef.current;
    const cums = cumAngles(ws);
    const b = boundaryIdx;
    const prevBound = b === 0 ? 0 : cums[b - 1];
    const nextBound = cums[b + 1] ?? 360;

    const clamped = Math.max(prevBound + MIN_ANG, Math.min(nextBound - MIN_ANG, newAngle));

    const newW_b  = ((clamped - prevBound) / 360) * 100;
    const newW_b1 = ((nextBound - clamped) / 360) * 100;

    const newWs = [...ws];
    newWs[b]     = parseFloat(newW_b.toFixed(1));
    newWs[b + 1] = parseFloat(newW_b1.toFixed(1));
    // Patch rounding drift
    const drift = (newWs[b] + newWs[b + 1]) - (ws[b] + ws[b + 1]);
    if (Math.abs(drift) > 0.01) newWs[b + 1] = parseFloat((newWs[b + 1] - drift).toFixed(1));

    onChangeRef.current(newWs);
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent<SVGCircleElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    draggingRef.current = null;
    setIsDragging(null);
  }, []);

  const selectedIdx = selectedId ? segments.findIndex(s => s.id === selectedId) : -1;
  const selectedSeg = selectedIdx >= 0 ? segments[selectedIdx] : null;
  const selectedW = selectedIdx >= 0 ? weights[selectedIdx] : null;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${SZ} ${SZ}`}
      style={{ width: '100%', maxWidth: `${SZ}px`, touchAction: 'none', userSelect: 'none', overflow: 'visible' }}
    >
      {/* Drop shadow filter */}
      <defs>
        <filter id="segShadow">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.12" />
        </filter>
        <filter id="handleGlow">
          <feDropShadow dx="0" dy="0" stdDeviation="4" floodOpacity="0.4" floodColor="#6366F1" />
        </filter>
      </defs>

      {/* Segments */}
      {segments.map((seg, i) => {
        const { start, end } = getSegmentAngles(i);
        const mid = (start + end) / 2;
        const span = end - start;
        const isSelected = seg.id === selectedId;
        const d = donutPath(start, end);
        if (!d) return null;

        const [lx, ly] = toXY(mid, R_LABEL);

        return (
          <g
            key={seg.id}
            onClick={() => onSelect(seg.id === selectedId ? null : seg.id)}
            style={{ cursor: 'pointer' }}
          >
            <path
              d={d}
              fill={seg.color}
              fillOpacity={isSelected ? 1 : 0.8}
              filter={isSelected ? 'url(#segShadow)' : undefined}
              style={{ transition: 'fill-opacity 0.2s' }}
            />
            {/* Percentage label inside segment */}
            {span > 26 && (
              <>
                <text
                  x={lx} y={ly - 1}
                  textAnchor="middle"
                  fill="white"
                  fontSize={11}
                  fontWeight={700}
                  style={{ pointerEvents: 'none' }}
                >
                  {Math.round(weights[i])}%
                </text>
                {span > 50 && (
                  <text
                    x={lx} y={ly + 11}
                    textAnchor="middle"
                    fill="rgba(255,255,255,0.7)"
                    fontSize={8}
                    style={{ pointerEvents: 'none' }}
                  >
                    {seg.icon}
                  </text>
                )}
              </>
            )}
          </g>
        );
      })}

      {/* Center donut hole */}
      <circle cx={CX} cy={CY} r={R_IN - 2} fill="white" />

      {/* Center label */}
      {selectedSeg ? (
        <>
          <text x={CX} y={CY - 14} textAnchor="middle" fontSize={9} fill={selectedSeg.color} fontWeight={600}>
            {selectedSeg.icon} {selectedSeg.name}
          </text>
          <text x={CX} y={CY + 8} textAnchor="middle" fontSize={26} fontWeight={800} fill={selectedSeg.color}>
            {Math.round(selectedW!)}%
          </text>
          <text x={CX} y={CY + 24} textAnchor="middle" fontSize={8} fill="#9CA3AF">
            drag boundary to adjust
          </text>
        </>
      ) : (
        <>
          <text x={CX} y={CY - 4} textAnchor="middle" fontSize={11} fill="#9CA3AF" fontWeight={500}>
            Tap segment
          </text>
          <text x={CX} y={CY + 12} textAnchor="middle" fontSize={11} fill="#9CA3AF" fontWeight={500}>
            to select
          </text>
        </>
      )}

      {/* Boundary drag handles (n-1 handles for n segments) */}
      {cum.slice(0, n - 1).map((angle, b) => {
        const [hx, hy] = toXY(angle, R_OUT);
        const active = isDragging === b;
        const prevColor = segments[b].color;

        return (
          <g key={`handle-${b}`}>
            {/* Hit target */}
            <circle
              cx={hx} cy={hy}
              r={HANDLE_HIT}
              fill="transparent"
              style={{ cursor: active ? 'grabbing' : 'grab', touchAction: 'none' }}
              onPointerDown={e => handlePointerDown(e, b)}
              onPointerMove={e => handlePointerMove(e, b)}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            />
            {/* Outer glow ring when active */}
            {active && (
              <circle cx={hx} cy={hy} r={14} fill={prevColor} fillOpacity={0.2} style={{ pointerEvents: 'none' }} />
            )}
            {/* Visual handle */}
            <circle
              cx={hx} cy={hy}
              r={active ? 11 : HANDLE_VIS}
              fill="white"
              stroke={prevColor}
              strokeWidth={active ? 4 : 2.5}
              filter={active ? 'url(#handleGlow)' : undefined}
              style={{ pointerEvents: 'none', transition: 'r 0.15s ease' }}
            />
            {/* Inner dot */}
            <circle
              cx={hx} cy={hy}
              r={active ? 4 : 3}
              fill={prevColor}
              style={{ pointerEvents: 'none', transition: 'r 0.15s ease' }}
            />
          </g>
        );
      })}
    </svg>
  );
}
