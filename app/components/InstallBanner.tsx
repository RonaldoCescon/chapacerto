'use client';

import { useEffect, useState } from 'react';
import { Download, X, Share, Smartphone } from 'lucide-react';

export default function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // 1. Detectar se é Android/Chrome (Evento beforeinstallprompt)
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault(); // Impede o banner nativo feio do Chrome
      setDeferredPrompt(e);
      setIsVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 2. Detectar se é iOS (iPhone/iPad) e se NÃO está instalado
    const checkIOS = () => {
      const userAgent = window.navigator.userAgent.toLowerCase();
      const isIphone = /iphone|ipad|ipod/.test(userAgent);
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

      if (isIphone && !isStandalone) {
        setIsIOS(true);
        setIsVisible(true);
      }
    };

    checkIOS();

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt(); // Dispara o popup nativo do Android
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsVisible(false);
      }
      setDeferredPrompt(null);
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 animate-in slide-in-from-bottom-10 fade-in duration-500">
      <div className="bg-gray-900/95 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl border border-gray-700 flex flex-col gap-3">
        
        {/* Cabeçalho do Banner */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-green-600 p-2 rounded-lg">
              <Smartphone size={20} className="text-white" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Instalar App ChapaCerto</h3>
              <p className="text-xs text-gray-400">Acesse mais rápido.</p>
            </div>
          </div>
          <button onClick={() => setIsVisible(false)} className="text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Botão de Ação (Muda conforme o Sistema) */}
        {isIOS ? (
          // Versão iOS (Instrução)
          <div className="bg-gray-800 rounded-lg p-3 text-xs text-gray-300 border border-gray-700">
            <p className="flex items-center gap-2 mb-1">
              1. Toque no botão <Share size={14} className="text-blue-400" /> <strong>Compartilhar</strong>
            </p>
            <p className="flex items-center gap-2">
              2. Selecione <span className="font-bold text-white border border-gray-600 rounded px-1">+ Adicionar à Tela de Início</span>
            </p>
          </div>
        ) : (
          // Versão Android (Botão Automático)
          <button
            onClick={handleInstallClick}
            className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors"
          >
            <Download size={16} />
            Instalar Agora
          </button>
        )}
      </div>
    </div>
  );
}