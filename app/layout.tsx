import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from 'sonner';

const inter = Inter({
  subsets: ["latin"],
  display: 'swap',
  variable: '--font-inter',
});

// 1. CONFIGURAÇÃO VISUAL MOBILE
export const viewport: Viewport = {
  themeColor: "#f8fafc", 
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false, 
};

// 2. METADADOS E PWA
export const metadata: Metadata = {
  title: {
    template: '%s | ChapaCerto',
    default: 'ChapaCerto',
  },
  description: "Conectando quem precisa com quem trabalha.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ChapaCerto",
  },
  // ADICIONADO: Apontando explicitamente para o arquivo na pasta public
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="scroll-smooth h-full">
      <body
        className={`
          ${inter.className} 
          antialiased 
          h-full 
          bg-gray-50 
          text-gray-900
        `}
      >
        <main className="relative flex flex-col min-h-[100dvh]">
          {children}
        </main>

        <Toaster 
          position="top-center" 
          richColors 
          closeButton 
          theme="light" 
        />
      </body>
    </html>
  );
}