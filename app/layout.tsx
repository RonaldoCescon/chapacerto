'use client';

import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from 'sonner';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

const inter = Inter({
  subsets: ["latin"],
  display: 'swap',
  variable: '--font-inter',
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // --- TRAVA DE SEGURANÇA MASTER ---
    // Verifica se o usuário logado foi bloqueado pelo Admin
    const checkSecurityStatus = async () => {
      // Não checa segurança em páginas públicas para não dar loop
      const publicPages = ['/', '/login', '/register'];
      if (publicPages.includes(pathname)) return;

      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('is_blocked')
          .eq('id', user.id)
          .single();

        if (profile?.is_blocked) {
          await supabase.auth.signOut();
          toast.error("ACESSO SUSPENSO", {
            description: "Sua conta foi bloqueada por violação dos termos de uso.",
            duration: 10000,
          });
          router.push('/login');
        }
      }
    };

    checkSecurityStatus();
  }, [pathname, router]);

  return (
    <html lang="pt-BR" className="scroll-smooth h-full">
      <head>
        {/* Metadados de Viewport e PWA */}
        <meta name="theme-color" content="#f8fafc" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/icon.svg" />
        <link rel="apple-touch-icon" href="/icon.svg" />
        <title>ChapaCerto</title>
      </head>
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

        {/* Notificações do Sistema */}
        <Toaster 
          position="top-center" 
          richColors 
          closeButton 
          theme="light" 
          toastOptions={{
            style: { borderRadius: '1.25rem', border: '1px solid #f1f5f9', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' },
          }}
        />
      </body>
    </html>
  );
}