import React, { useState, useEffect, useCallback } from 'react';

function ToastContainer({ toasts }) {
  return (
    <div className="toast-container" id="toastContainer" role="region" aria-label="Notifications" aria-live="polite">
      {toasts.map(toast => (
        <div key={toast.id} className={`toast ${toast.type} show`} role="alert" aria-live={toast.type === 'error' ? 'assertive' : 'polite'}>
          <span className="toast-icon">
            {toast.type === 'error' && (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
            )}
            {toast.type === 'success' && (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                <circle cx="12" cy="12" r="10"/>
                <path d="M8 12l2 2 4-4"/>
              </svg>
            )}
            {toast.type === 'info' && (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="16" x2="12" y2="12"/>
                <line x1="12" y1="8" x2="12" y2="8"/>
              </svg>
            )}
          </span>
          <span className="toast-text">{toast.message}</span>
          <button className="toast-close" aria-label="Dismiss" type="button" onClick={() => window.showToast && window.showToast('', 'info', 1)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      ))}
    </div>
  );
}

export default ToastContainer;