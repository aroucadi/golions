import './globals.css';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'GO LIONS Booking Intelligence Toolkit',
  description: 'Premium local dashboard for Royal Air Maroc booking campaigns'
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-slate-950 text-slate-100 min-h-screen`}>
        {children}
      </body>
    </html>
  );
}
