import React, { useRef, useState, useEffect } from 'react';

function OTPForm({ 
  otpInputs, setOtpInputs,
  isLoading, handleVerify,
  handleResend,
  handleBack,
  sentTarget,
  otpSentRef,
  resendTimerRef,
  startResendCountdown
}) {
  const otpInputsRef = useRef([]);

  const handleOtpInput = (e, index) => {
    const value = e.target.value;
    if (!/^\d*$/.test(value) || value.length > 1) return;
    const newInputs = [...otpInputs];
    newInputs[index] = value;
    setOtpInputs(newInputs);
    if (value && index < 5) {
      e.target.closest('.otp-grid').querySelectorAll('.otp-input')[index + 1]?.focus();
    }
    const val = newInputs.join('');
    if (val.length === 6) {
      setTimeout(() => handleVerify(), 300);
    }
  };

  const handleOtpKeydown = (e, index) => {
    if (e.key === 'Backspace' && !otpInputs[index] && index > 0) {
      e.target.closest('.otp-grid').querySelectorAll('.otp-input')[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      document.querySelectorAll('.otp-input')[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      document.querySelectorAll('.otp-input')[index + 1]?.focus();
    }
  };

  const handleOtpPaste = (e, index) => {
    e.preventDefault();
    const data = e.clipboardData.getData('text').trim();
    if (/^\d{6}$/.test(data)) {
      data.split('').forEach((v, j) => {
        if (j < 6) {
          const newInputs = [...otpInputs];
          newInputs[j] = v;
          setOtpInputs(newInputs);
        }
      });
      document.querySelectorAll('.otp-input')[5]?.focus();
    }
  };

  const startResendCountdownLocal = () => {
    let resendSeconds = 60;
    const resendBtn = document.getElementById('resendBtn');
    if (!resendBtn) return;
    
    resendBtn.disabled = true;
    resendBtn.classList.add('counting');
    
    const timer = setInterval(() => {
      resendSeconds--;
      if (resendSeconds <= 0) {
        clearInterval(timer);
        resendBtn.disabled = false;
        resendBtn.classList.remove('counting');
        resendBtn.innerHTML = `<svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg><span class="btn-text">Resend Code</span>`;
      } else {
        resendBtn.innerHTML = `<svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg><span class="btn-text">${resendSeconds}s</span>`;
      }
    }, 1000);
  };

  return (
    <form className="otp-form" onSubmit={(e) => e.preventDefault()}>
      <div className="otp-sent" id="otpSent" style={{ display: 'none' }} role="status" aria-live="polite">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16" aria-hidden="true">
          <circle cx="12" cy="12" r="10"/>
          <path d="M8 12l2 2 4-4"/>
        </svg>
        <span>Code transmitted to <strong id="sentTarget"></strong></span>
      </div>

      <div className="otp-grid" id="otpGrid" role="group" aria-label="6-digit authentication code">
        {Array.from({ length: 6 }).map((_, i) => (
          <input
            key={i}
            ref={(el) => { if (el) otpInputsRef.current[i] = el; }}
            type="tel"
            className="otp-input"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={1}
            data-index={i}
            aria-label={`Digit ${i + 1}`}
            autocomplete="one-time-code"
            placeholder=""
            onChange={(e) => handleOtpInput(e, i)}
            onKeyDown={(e) => handleOtpKeydown(e, i)}
            onPaste={(e) => handleOtpPaste(e, i)}
          />
        ))}
      </div>

      <button type="button" className="btn-primary" id="verifyBtn" onClick={handleVerify} disabled={isLoading}>
        <span className="btn-text">VERIFY ACCESS</span>
        <svg className="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" aria-hidden="true">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
        {isLoading && <svg className="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="10" strokeOpacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/></svg>}
      </button>

      <div className="btn-group">
        <button type="button" className="btn-secondary" id="resendBtn" onClick={() => { handleResend(sentTarget?.textContent || ''); startResendCountdownLocal(); }}>
          <svg className="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" aria-hidden="true">
            <circle cx="12" cy="12" r="9"/>
            <path d="M12 7v5l3 2"/>
          </svg>
          <span className="btn-text">Resend Code</span>
        </button>
        <button type="button" className="btn-secondary" onClick={handleBack} aria-label="Return to Login">
          <svg className="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" aria-hidden="true">
            <path d="M19 12H5"/>
            <polyline points="12 19 5 12 12 5"/>
          </svg>
          <span className="btn-text">Cancel</span>
        </button>
      </div>
    </form>
  );
}

export default OTPForm;