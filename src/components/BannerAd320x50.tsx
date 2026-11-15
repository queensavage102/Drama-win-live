import React from 'react';

interface BannerAd320x50Props {
  className?: string;
}

const AD_SRCDOC = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
  </head>
  <body style="margin:0;padding:0;overflow:hidden;background:#0d0d12;display:flex;align-items:center;justify-content:center;width:320px;height:50px;">
    <script>
      atOptions = {
        'key' : 'ad841ac96a8c7900f78d4c0aef6fd6f5',
        'format' : 'iframe',
        'height' : 50,
        'width' : 320,
        'params' : {}
      };
    </script>
    <script src="https://bancadeltempoidea.org"></script>
  </body>
</html>`;

export const BannerAd320x50: React.FC<BannerAd320x50Props> = ({ className = '' }) => {
  return (
    <div
      className={`w-[320px] h-[50px] rounded-lg overflow-hidden border border-[#D4AF37]/30 bg-[#0D0D12] shadow-md shadow-black/50 flex items-center justify-center shrink-0 ${className}`}
    >
      <iframe
        title="Sponsored Banner 320x50"
        srcDoc={AD_SRCDOC}
        width={320}
        height={50}
        scrolling="no"
        frameBorder="0"
        sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-top-navigation-by-user-activation"
        className="w-[320px] h-[50px] border-0 block"
      />
    </div>
  );
};
