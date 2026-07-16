import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* Preconnect to Google Fonts domains first — eliminates DNS lookup latency */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Modern geometric fonts: Outfit for headings, Inter for body, JetBrains Mono for code */}
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
        <meta name="description" content="StegoChain – Decentralised secure communication using steganography, blockchain, and AI" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
