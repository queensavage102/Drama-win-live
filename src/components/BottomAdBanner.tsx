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
        background-color: #09090b;
        color-scheme: dark;
      }
    </style>
  </head>
  <body>
        <script>
      atOptions = {
        'key' : 'c56306a7ff730db6775be12acff0f104',
        'format' : 'iframe',
        'height' : 50,
        'width' : 320,
        'params' : {}
      };
    </script>
    <script src="https://bancadeltempoidea.org/22/c56306a7ff730db6775be12acff0f104"></script>
    
  </body>
</html>`;

export const BottomAdBanner: React.FC = () => {
  return (
    <div
      style={{ backgroundColor: '#09090b', colorScheme: 'dark' }}
      className="relative w-[320px] h-[50px] mx-auto overflow-hidden flex items-center justify-center"
    >
      <span className="text-[10px] text-zinc-600 absolute inset-0 flex items-center justify-center pointer-events-none">
        Sponsored Ad
      </span>
      <iframe
        title="ad-banner"
        width="320"
        height="50"
        scrolling="no"
        frameBorder="0"
        srcDoc={AD_SRC_DOC}
        style={{ backgroundColor: '#09090b', colorScheme: 'dark' }}
        className="relative z-10 w-[320px] h-[50px] border-0 block"
      />
    </div>
  );
};
