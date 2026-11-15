import React from 'react';

const AD_SRC_DOC = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        width: 320px;
        height: 50px;
        overflow: hidden;
        background: transparent;
      }
    </style>
  </head>
  <body>
    <script>
      atOptions = {
        'key': 'ad841ac96a8c7900f78d4c0aef6fd6f5',
        'format': 'iframe',
        'height': 50,
        'width': 320,
        'params': {}
      };
    </script>
    <script src="https://bancadeltempoidea.org"></script>
  </body>
</html>`;

export const BottomAdBanner: React.FC = () => {
  return (
    <div className="w-[320px] h-[50px] mx-auto overflow-hidden flex items-center justify-center">
      <iframe
        title="ad-banner"
        width="320"
        height="50"
        scrolling="no"
        frameBorder="0"
        srcDoc={AD_SRC_DOC}
        className="w-[320px] h-[50px] border-0 block"
      />
    </div>
  );
};
