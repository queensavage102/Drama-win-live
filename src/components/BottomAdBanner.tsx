import React, { useEffect, useMemo, useRef, useState } from 'react';

interface BottomAdBannerProps {
  embeddedAdHtml?: string;
  inline?: boolean;
}

function buildEmbeddedAdSrcDoc(adHtml: string, slotId: string): string {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        background: transparent;
        overflow: hidden;
        width: 100%;
        min-height: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #f6f2e9;
        font-family: system-ui, -apple-system, sans-serif;
      }
      #ad-root {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        max-width: 100%;
      }
      img, iframe {
        max-width: 100%;
      }
    </style>
  </head>
  <body>
    <div id="ad-root">${adHtml}</div>
    <script>
      (function () {
        var slotId = ${JSON.stringify(slotId)};
        var root = document.getElementById('ad-root');
        var reportedReady = false;

        function hasVisibleAdContent() {
          if (!root) return false;
          if ((root.innerText || '').trim().length > 0) return true;
          var nodes = root.querySelectorAll('img, iframe, ins, svg, canvas, video, object, embed, a');
          for (var i = 0; i < nodes.length; i++) {
            var el = nodes[i];
            var rect = el.getBoundingClientRect();
            if (rect.width >= 4 && rect.height >= 4) return true;
          }
          var rootRect = root.getBoundingClientRect();
          return rootRect.height >= 12 && rootRect.width >= 20;
        }

        function measureAndNotify(isFinalCheck) {
          var ready = hasVisibleAdContent();
          if (ready) {
            reportedReady = true;
            var h = Math.max(50, Math.min(120, Math.ceil(root.getBoundingClientRect().height || 50)));
            try {
              window.parent.postMessage({ type: 'dramawin-ad-status', slotId: slotId, status: 'ready', height: h }, '*');
            } catch (e) {}
            return;
          }
          if (isFinalCheck && !reportedReady) {
            try {
              window.parent.postMessage({ type: 'dramawin-ad-status', slotId: slotId, status: 'empty', height: 0 }, '*');
            } catch (e) {}
          }
        }

        if (typeof MutationObserver !== 'undefined' && root) {
          var observer = new MutationObserver(function () {
            measureAndNotify(false);
          });
          observer.observe(root, { childList: true, subtree: true, attributes: true });
        }

        window.addEventListener('load', function () {
          measureAndNotify(false);
          setTimeout(function () { measureAndNotify(false); }, 600);
          setTimeout(function () { measureAndNotify(true); }, 2500);
        });

        setTimeout(function () { measureAndNotify(false); }, 300);
        setTimeout(function () { measureAndNotify(true); }, 3500);
      })();
    </script>
  </body>
</html>`;
}

export const BottomAdBanner: React.FC<BottomAdBannerProps> = ({
  embeddedAdHtml = '',
  inline = false,
}) => {
  const trimmed = embeddedAdHtml.trim();
  const [collapsed, setCollapsed] = useState(false);
  const [adHeight, setAdHeight] = useState(50);
  const slotIdRef = useRef(`ad-slot-${Math.random().toString(36).slice(2, 9)}`);

  useEffect(() => {
    setCollapsed(false);
    setAdHeight(50);
  }, [trimmed]);

  useEffect(() => {
    if (!trimmed) return;
    const handleMessage = (event: MessageEvent) => {
      const data = event.data as
        | { type?: string; slotId?: string; status?: string; height?: number }
        | null
        | undefined;
      if (!data || data.type !== 'dramawin-ad-status' || data.slotId !== slotIdRef.current) {
        return;
      }
      if (data.status === 'ready') {
        setCollapsed(false);
        if (typeof data.height === 'number' && data.height > 0) {
          setAdHeight(Math.max(50, Math.min(120, Math.round(data.height))));
        }
      } else if (data.status === 'empty') {
        setCollapsed(true);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [trimmed]);

  const srcDoc = useMemo(
    () => (trimmed ? buildEmbeddedAdSrcDoc(trimmed, slotIdRef.current) : ''),
    [trimmed]
  );

  // Collapse completely whenever there is no active embedded ad or it rendered empty
  if (!trimmed || collapsed) {
    return null;
  }

  return (
    <footer
      aria-label="Sponsor banner"
      className={
        inline
          ? 'flex-none w-full bg-[#070709] border-t border-[#D4AF37]/25 py-1.5 px-2 flex items-center justify-center'
          : 'fixed bottom-0 left-0 right-0 z-40 bg-[#060608]/95 backdrop-blur-md border-t border-[#D4AF37]/25 py-1.5 px-2 flex justify-center shadow-[0_-8px_28px_rgba(0,0,0,0.85)]'
      }
    >
      <div
        className="w-full max-w-[360px] rounded-lg overflow-hidden flex items-center justify-center"
        style={{ height: `${adHeight}px` }}
      >
        <iframe
          key={trimmed}
          title="Sponsored Placement"
          srcDoc={srcDoc}
          scrolling="no"
          frameBorder="0"
          sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-top-navigation-by-user-activation"
          className="w-full h-full border-0 block"
        />
      </div>
    </footer>
  );
};
