import React, { useRef, useState } from 'react';

interface TouchJoystickProps {
  onMove: (dx: number, dz: number) => void;
  compact?: boolean;
  tablet?: boolean;
}

export const TouchJoystick: React.FC<TouchJoystickProps> = ({
  onMove,
  compact = false,
  tablet = false,
}) => {
  const outerRadius = compact ? 35 : tablet ? 52 : 40; // 70px in landscape phone, 80px portrait phone, 104px tablet
  const maxOffset = compact ? 21 : tablet ? 33 : 24;
  const padRef = useRef<HTMLDivElement | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const [knob, setKnob] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [active, setActive] = useState(false);

  const updateVector = (clientX: number, clientY: number) => {
    const el = padRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);

    if (dist > maxOffset) {
      dx = (dx / dist) * maxOffset;
      dy = (dy / dist) * maxOffset;
    }

    setKnob({ x: dx, y: dy });

    // Apply small inner deadzone so slight rests don't drift the hero
    if (dist < 6) {
      onMove(0, 0);
    } else {
      const normX = Math.max(-1, Math.min(1, dx / maxOffset));
      const normZ = Math.max(-1, Math.min(1, dy / maxOffset));
      onMove(normX, normZ);
    }
  };

  const reset = () => {
    pointerIdRef.current = null;
    setActive(false);
    setKnob({ x: 0, y: 0 });
    onMove(0, 0);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    pointerIdRef.current = e.pointerId;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture isn't supported
    }
    setActive(true);
    updateVector(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== e.pointerId) return;
    e.stopPropagation();
    updateVector(e.clientX, e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== e.pointerId) return;
    e.stopPropagation();
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore release errors
    }
    reset();
  };

  return (
    <div
      ref={padRef}
      role="slider"
      aria-label="Movement thumbstick"
      aria-valuetext={active ? 'Moving' : 'Idle'}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        width: outerRadius * 2,
        height: outerRadius * 2,
        touchAction: 'none',
      }}
      className={`pointer-events-auto relative flex items-center justify-center rounded-full border-2 transition-colors select-none ${
        active
          ? 'border-[#d4a14a] bg-[#131820]/82'
          : 'border-[#d4a14a]/45 bg-[#131820]/50'
      }`}
    >
      {/* Subtle crosshairs */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-3 rounded-full border border-dashed border-[#d4a14a]/25"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1.5 font-mono text-[9px] text-[#9ba7b8]/75"
      >
        ▲
      </span>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-1.5 font-mono text-[9px] text-[#9ba7b8]/75"
      >
        ▼
      </span>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-2 font-mono text-[9px] text-[#9ba7b8]/75"
      >
        ◀
      </span>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-2 font-mono text-[9px] text-[#9ba7b8]/75"
      >
        ▶
      </span>

      {/* Tactile brass thumb knob */}
      <div
        aria-hidden="true"
        style={{
          transform: `translate3d(${knob.x}px, ${knob.y}px, 0)`,
        }}
        className={`pointer-events-none rounded-full border-2 shadow-lg transition-colors ${
          compact ? 'h-8 w-8' : 'h-10 w-10'
        } ${
          active
            ? 'border-[#f4efe6] bg-[#d4a14a]'
            : 'border-[#e3b868]/75 bg-[#283344]/85'
        }`}
      />
    </div>
  );
};
