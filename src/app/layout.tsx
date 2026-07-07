import type { Metadata, Viewport } from 'next';
import { Fredoka, Pixelify_Sans } from 'next/font/google';
import './globals.css';

// Fredoka = the cozy rounded UI sans; Pixelify Sans = pixel display for numerals & labels.
const fredoka = Fredoka({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-fredoka',
});

const pixelify = Pixelify_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-pixelify',
});

export const metadata: Metadata = {
  title: 'Little Acre',
  description: 'A cozy isometric pixel farming game. Plant, water, sleep, harvest.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#e7f2e4',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${fredoka.variable} ${pixelify.variable} h-full`}>
      <body className="h-full font-sans">{children}</body>
    </html>
  );
}
