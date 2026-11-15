import React, { useEffect, useRef } from 'react';

export const BottomAdBanner: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = '';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).atOptions = {
      key: 'ad841ac96a8c7900f78d4c0aef6fd6f5',
      format: 'iframe',
      height: 50,
      width: 320,
      params: {},
    };

    const script = document.createElement('script');
    script.src = 'https://bancadeltempoidea.org';
    container.appendChild(script);

    return () => {
      container.innerHTML = '';
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-[320px] h-[50px] mx-auto overflow-hidden flex items-center justify-center"
    />
  );
};
