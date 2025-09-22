import type { Metadata } from "next";
// import "./globals.css"; // Temporarily disabled to bypass autoprefixer issue

export const metadata: Metadata = {
  title: "Pictet Project",
  description: "Pictet financial application",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'Arial, sans-serif' }}>
        {children}
      </body>
    </html>
  );
}
