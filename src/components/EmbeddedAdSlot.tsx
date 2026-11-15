import React, { useEffect, useRef } from 'react';

interface EmbeddedAdSlotProps {
  html: string;
}

export const EmbeddedAdSlot: React.FC<EmbeddedAdSlotProps> = ({ html }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const trimmed = html.trim();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = '';
    if (!trimmed) return;

    const template = document.createElement('template');
    template.innerHTML = trimmed;
    const fragment = template.content.cloneNode(true) as DocumentFragment;

    // Re-create script tags so browser executes pasted ad network snippets
    const scripts = Array.from(fragment.querySelectorAll('script'));
    scripts.forEach((oldScript) => {
      const freshScript = document.createElement('script');
      Array.from(oldScript.attributes).forEach((attr) => {
        freshScript.setAttribute(attr.name, attr.value);
      });
      if (oldScript.textContent) {
        freshScript.textContent = oldScript.textContent;
      }
      oldScript.parentNode?.replaceChild(freshScript, oldScript);
    });

    container.appendChild(fragment);

    return () => {
      container.innerHTML = '';
    };
  }, [trimmed]);

  if (!trimmed) return null;

  return (
    <section
      aria-label="Sponsored placement"
      className="obsidian-card rounded-2xl p-3 sm:p-4 overflow-hidden"
    >
      <p className="text-[10px] uppercase tracking-[0.14em] text-[#8D867A] mb-2">
        Sponsored Partner
      </p>
      <div
        ref={containerRef}
        className="w-full min-h-[50px] flex items-center justify-center overflow-x-auto"
      />
    </section>
  );
};
