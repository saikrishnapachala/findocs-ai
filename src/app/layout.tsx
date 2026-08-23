import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FinDocs AI — chat with financial documents',
  description:
    'Upload financial PDFs (10-Ks, policy documents) and ask questions answered only from the source text, with inline citations you can verify.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
