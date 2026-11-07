import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Alert } from 'react-bootstrap';

const FlashContext = createContext(null);

export function FlashProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((flash) => {
    if (!flash?.text) return;
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, type: flash.type || 'info', text: flash.text }]);
    const delay = Number(window.__FLASH_MS || 6000);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, delay);
  }, []);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value = useMemo(() => ({ push, dismiss }), [push, dismiss]);

  return (
    <FlashContext.Provider value={value}>
      <div className="flash-stack px-3 pt-3">
        {toasts.map((t) => (
          <Alert
            key={t.id}
            variant={t.type === 'danger' ? 'danger' : t.type === 'warning' ? 'warning' : t.type === 'success' ? 'success' : 'info'}
            dismissible
            onClose={() => dismiss(t.id)}
            className="shadow-sm"
          >
            {t.text}
          </Alert>
        ))}
      </div>
      {children}
    </FlashContext.Provider>
  );
}

export function useFlash() {
  return useContext(FlashContext);
}
