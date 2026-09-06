import './globals.css';
import type { Metadata } from 'next';
import { DM_Sans, Playfair_Display } from 'next/font/google';
import { LOGO_SRC } from '@/lib/site';

const sans = DM_Sans({ subsets: ['latin'], variable: '--font-sans' });
const display = Playfair_Display({ subsets: ['latin'], variable: '--font-display' });

export const metadata: Metadata = {
  metadataBase: new URL('https://cgj-nusrl.vercel.app'),
  title: {
    default: 'Centre for Gender Justice | NUSRL Ranchi',
    template: '%s | CGJ NUSRL',
  },
  description: 'The Centre for Gender Justice at NUSRL, Ranchi — an editorial space for research, learning, and action towards an inclusive and equitable society.',
  openGraph: { title: 'Centre for Gender Justice | NUSRL Ranchi', description: 'Research, learning, and action for gender justice.', type: 'website' },
  twitter: { card: 'summary_large_image' },
  icons: { icon: LOGO_SRC, apple: LOGO_SRC },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body className={`${sans.variable} ${display.variable}`}>{children}</body></html>;
}
