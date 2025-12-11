import React, { useState, useEffect } from 'react';
import { FaDownload, FaTimes } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';

const InstallBanner = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Слушаем событие браузера "Можно установить"
    const handler = (e) => {
      // Отменяем стандартную скучную плашку браузера
      e.preventDefault();
      // Сохраняем событие, чтобы вызвать его позже по кнопке
      setDeferredPrompt(e);
      // Показываем наш красивый баннер
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    // Показываем нативное окно установки
    deferredPrompt.prompt();
    // Ждем реакции пользователя
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
    setShowBanner(false);
  };

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div 
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-96"
        >
          <div className="bg-gradient-to-r from-blue-900 to-gray-800 p-4 rounded-xl shadow-2xl border border-blue-500/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-lg">
                <FaDownload className="text-white" />
              </div>
              <div className="text-left">
                <h4 className="font-bold text-white text-sm">Установи FitTracker</h4>
                <p className="text-xs text-gray-300">Работает без интернета!</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button 
                onClick={handleInstallClick}
                className="bg-blue-500 hover:bg-blue-400 text-white text-xs font-bold py-2 px-3 rounded-lg transition"
              >
                Установить
              </button>
              <button 
                onClick={() => setShowBanner(false)}
                className="text-gray-400 hover:text-white p-2"
              >
                <FaTimes />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default InstallBanner;