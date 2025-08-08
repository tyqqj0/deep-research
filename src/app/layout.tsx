// @/app/layout.tsx

import './globals.css';

export const metadata = {
  title: 'Research Navigator - Refactored',
  description: 'A refactored application for deep research.',
};

/**
 * A new, simplified root layout for the refactored application.
 * It removes all dependencies on old and non-existent UI components.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
