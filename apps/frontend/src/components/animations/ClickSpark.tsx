import React, { useCallback, useEffect, useRef, useState } from 'react';

type Spark = { id: number; x: number; y: number; angle: number; life: number };

export const ClickSpark: React.FC<{ color?: string }>= ({ color = '#00ff88' }) => {
  const [sparks, setSparks] = useState<Spark[]>([]);
  const idRef = useRef(0);

  const spawn = useCallback((x: number, y: number) => {
    const created: Spark[] = Array.from({ length: 14 }).map(() => ({
      id: idRef.current++,
      x,
      y,
      angle: Math.random() * Math.PI * 2,
      life: 1,
    }));
    setSparks(prev => [...prev, ...created]);
  }, []);

  useEffect(() => {
    const handle = (e: MouseEvent) => spawn(e.clientX, e.clientY);
    window.addEventListener('click', handle);
    return () => window.removeEventListener('click', handle);
  }, [spawn]);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setSparks(prev => prev
        .map(s => ({ ...s, x: s.x + Math.cos(s.angle) * 2, y: s.y + Math.sin(s.angle) * 2, life: s.life - 0.02 }))
        .filter(s => s.life > 0)
      );
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <svg style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 50 }}>
      {sparks.map(s => (
        <circle key={s.id} cx={s.x} cy={s.y} r={2.5} fill={color} opacity={Math.max(0, s.life)} />
      ))}
    </svg>
  );
};

export default ClickSpark;


