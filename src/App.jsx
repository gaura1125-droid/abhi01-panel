import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BrandHeader, StatusIndicators, LoginForm, OTPForm, ToastContainer, BackgroundEffects } from './components';
import { useAuth, useLanguage, useParticles } from './hooks';

function App() {
  const [isOTPActive, setIsOTPActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [otpInputs, setOtpInputs] = useState(Array(6).fill(''));
  const [otpValue, setOtpValue] = useState('');
  const [resendSeconds, setResendSeconds] = useState(0);
  const [resendTimer, setResendTimer] = useState(null);

  const { languageIndex, languages, languageLabels } = useLanguage();
  const { particleFieldRef, circuitTracesRef } = useParticles();
  const { login, verifyOtp: verifyOtpAuth, resendOtp } = useAuth();

  const usernameRef = useRef(null);
  const passwordRef = useRef(null);
  const otpRefs = useRef(Array(6).fill(null));
  const sentTargetRef = useRef(null);
  const otpSentRef = useRef(null);

  const showToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random();
    const toast = { id, message, type };
    setToasts(prev => [...prev, toast]);
    
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  const setLoading = useCallback((button, isLoading) => {
    button.disabled = isLoading;
    button.classList.toggle('loading', isLoading);
  }, []);

  const flashError = useCallback((target) => {
    document.body.classList.add('auth-error');
    if (window.flashErrorTimer) clearTimeout(window.flashErrorTimer);
    window.flashErrorTimer = setTimeout(() => {
      document.body.classList.remove('auth-error');
    }, 780);
  }, []);

  const generateParticles = useCallback((count = 35) => {
    const container = document.getElementById('particleField');
    if (!container) return;

    const colors = [
      'rgba(0, 255, 136, 0.6)',
      'rgba(0, 229, 255, 0.5)',
      'rgba(0, 136, 255, 0.4)',
      'rgba(168, 85, 247, 0.4)'
    ];

    for (let i = 0; i < count; i++) {
      const particle = document.createElement('div');
      particle.className = 'particle';
      const size = Math.random() * 3 + 1;
      const color = colors[Math.floor(Math.random() * colors.length)];
      const startX = Math.random() * 100;
      const startY = Math.random() * 100;
      const duration = 15 + Math.random() * 20;
      const delay = Math.random() * 20;

      particle.style.cssText = `
        left: ${startX}%;
        top: ${startY}%;
        width: ${size}px;
        height: ${size}px;
        background: ${color};
        box-shadow: 0 0 ${size * 3}px ${color}, 0 0 ${size * 6}px ${color};
        animation-duration: ${duration}s;
        animation-delay: ${delay}s;
      `;
      container.appendChild(particle);
    }
  }, []);

  const generateCircuitTraces = useCallback(() => {
    const container = document.getElementById('circuitTraces');
    if (!container) return;

    for (let i = 0; i < 10; i++) {
      const trace = document.createElement('div');
      trace.className = 'circuit-trace';
      const top = Math.random() * 100;
      const width = 200 + Math.random() * 400;
      const delay = Math.random() * 8;
      const duration = 8 + Math.random() * 6;

      trace.style.cssText = `
        top: ${top}%;
        left: -200px;
        width: ${width}px;
        height: 1px;
        animation-delay: ${delay}s;
        animation-duration: ${duration}s;
      `;
      container.appendChild(trace);
    }

    for (let i = 0; i < 8; i++) {
      const trace = document.createElement('div');
      trace.className = 'circuit-trace vertical';
      const left = Math.random() * 100;
      const height = 200 + Math.random() * 300;
      const delay = Math.random() * 10;
      const duration = 10 + Math.random() * 8;

      trace.style.cssText = `
        left: ${left}%;
        top: -200px;
        width: 1px;
        height: ${height}px;
        animation-delay: ${delay}s;
        animation-duration: ${duration}s;
      `;
      container.appendChild(trace);
    }
  }, []);

  const handleInputFocus = useCallback((input) => {
    const wrapper = input.closest('.field-wrapper');
    if (wrapper) wrapper.classList.add('focused');
    document.body.classList.add(input === usernameRef.current ? 'focus-user' : 'focus-pass');
  }, []);

  const handleInputBlur = useCallback((input) => {
    const wrapper = input.closest('.field-wrapper');
    if (wrapper) wrapper.classList.remove('focused', 'typing');
    document.body.classList.remove('focus-user', 'focus-pass');
  }, []);

  const handleInput = useCallback((input) => {
    const wrapper = input.closest('.field-wrapper');
    if (wrapper) wrapper.classList.add('typing');
    clearTimeout(wrapper._typingTimer);
    wrapper._typingTimer = setTimeout(() => wrapper.classList.remove('typing'), 380);
  }, []);

  const togglePasswordVisibility = useCallback(() => {
    setShowPassword(prev => !prev);
  }, [setShowPassword]);

  const clearUsername = useCallback(() => {
    setUsername('');
    usernameRef.current?.focus();
  }, [setUsername]);

  const handleOtpInput = useCallback((e, index) => {
    const value = e.target.value;
    if (!/^\d*$/.test(value) || value.length > 1) return;
    const newInputs = [...otpInputs];
    newInputs[index] = value;
    setOtpInputs(newInputs);
    if (value && index < 5) {
      document.querySelectorAll('.otp-input')[index + 1]?.focus();
    }
    const val = newInputs.join('');
    if (val.length === 6) {
      setTimeout(() => verifyOtp(), 300);
    }
  }, [otpInputs, setOtpInputs]);

  const handleOtpKeydown = useCallback((e, index) => {
    if (e.key === 'Backspace' && !otpInputs[index] && index > 0) {
      document.querySelectorAll('.otp-input')[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      document.querySelectorAll('.otp-input')[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      document.query.querySelectorAll('.otp-input')[index + 1]?.focus();
    }
  }, [otpInputs]);

  const handleOtpPaste = useCallback((e, index) => {
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
  }, [otpInputs, setOtpInputs]);

  const updateOtpProgress = useCallback(() => {
    const filled = otpInputs.filter(x => x).length;
    const progress = (filled / 6) * 100;
    document.getElementById('otpGrid')?.style.setProperty('--progress', `${progress}%`);
  }, [otpInputs]);

  const verifyOtp = useCallback(async () => {
    const val = otpInputs.join('');
    if (val.length !== 6) {
      otpInputs.forEach((_, i) => document.querySelectorAll('.otp-input')[i]?.classList.add('error'));
      flashError(document.getElementById('otpGrid'));
      showToast('Enter 6 digits', 'error');
      return;
    }

    document.body.classList.remove('auth-error');
    setLoading(verifyBtn, true);

    try {
      const response = await fetch('/login/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ otp: otpInputs.join('') })
      });
      const data = await response.json();

      if (data.success) {
        document.body.classList.remove('verify-busy', 'otp-focus');
        document.body.classList.add('auth-success');
        document.documentElement.classList.add('portal-active');
        showToast('Access Granted', 'success');
        setTimeout(() => {
          location.href = data.redirect || '/';
        }, 900);
        return;
      }

      otpInputs.forEach((_, i) => document.querySelectorAll('.otp-input')[i]?.classList.add('error'));
      flashError(document.getElementById('otpGrid'));
      showToast(data.message || 'Invalid code', 'error');
    } catch (err) {
      showToast('Network error', 'error');
    } finally {
      setLoading(verifyBtn, false);
    }
  }, [otpInputs, setLoading, showToast, flashError]);

  const startResendCountdown = useCallback(() => {
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
  }, []);

  const showOtpForm = useCallback((username) => {
    document.body.classList.remove('focus-user', 'focus-pass', 'auth-error', 'auth-success', 'bursting');
    document.documentElement.classList.remove('portal-active');
    document.body.classList.add('otp-active');

    const otpSent = document.getElementById('otpSent');
    const sentTarget = document.getElementById('sentTarget');
    if (otpSent) otpSent.style.display = 'block';
    if (sentTarget) sentTarget.textContent = username;

    startResendCountdown();
    const inputs = document.querySelectorAll('.otp-input');
    inputs.forEach(x => {
      x.value = '';
      x.classList.remove('filled', 'error', 'pulse');
    });
    const otpGrid = document.getElementById('otpGrid');
    if (otpGrid) otpGrid.classList.remove('complete', 'scanning');
    setOtpInputs(Array(6).fill(''));

    setIsOTPActive(true);

    setTimeout(() => inputs[0]?.focus(), 120);
  }, [startResendCountdown]);

  const showLoginForm = useCallback(() => {
    document.body.classList.remove('otp-active', 'otp-focus', 'verify-busy', 'auth-error', 'auth-success', 'bursting');
    document.documentElement.classList.remove('portal-active');
    const otpGrid = document.getElementById('otpGrid');
    if (otpGrid) otpGrid.classList.remove('scanning', 'complete');

    const resendBtn = document.getElementById('resendBtn');
    if (resendBtn) resendBtn.classList.remove('counting');
    const otpSent = document.getElementById('otpSent');
    if (otpSent) otpSent.style.display = 'none';

    document.getElementById('username')?.classList.remove('error');
    document.getElementById('password')?.classList.remove('error');

    setIsLoading(false);
    setIsOTPActive(false);
  }, [setIsLoading]);

  const handleLogin = useCallback(async (e) => {
    e.preventDefault();

    const usernameVal = username.trim();
    const passwordVal = password;

    if (!usernameVal || !passwordVal) {
      flashError(document.getElementById('loginForm'));
      showToast('Enter identity code & access key', 'error');
      return;
    }

    document.body.classList.remove('auth-error');
    document.body.classList.add('bursting');
    setTimeout(() => document.body.classList.remove('bursting'), 950);

    setIsLoading(true);
    document.getElementById('username')?.classList.remove('error');
    document.getElementById('password')?.classList.remove('error');

    try {
      const response = await fetch('/login/step1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: usernameVal, password: passwordVal, remember })
      });
      const data = await response.json();

      if (data.success) {
        showOtpForm(username);
      } else {
        if (data.errorCode === 'INVALID_PASSWORD' || data.message?.includes('password')) {
          document.getElementById('password')?.classList.add('error');
          document.getElementById('password')?.focus();
        } else {
          document.getElementById('username')?.classList.add('error');
          document.getElementById('username')?.focus();
        }
        flashError(document.getElementById('loginForm'));
        showToast(data.message || 'Authentication failed', 'error');
      }
    } catch (err) {
      showToast('Network error', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [username, password, remember, showToast, flashError]);

  useEffect(() => {
    generateParticles(35);
    generateCircuitTraces();
  }, [generateParticles, generateCircuitTraces]);

  useEffect(() => {
    const interval = setInterval(() => {
      setLanguageIndex(prev => (prev + 1) % 2);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="login-container">
      <BackgroundEffects particleFieldRef={particleFieldRef} circuitTracesRef={circuitTracesRef} />
      
      <main className="login-container">
        <article className="login-panel" role="region" aria-label="Secure Login Panel">
          <div className="panel-glass">
            <BrandHeader languageIndex={languageIndex} languages={languages} languageLabels={languageLabels} />
            <StatusIndicators />
            
            {!isOTPActive ? (
              <LoginForm
                username={username}
                setUsername={setUsername}
                password={password}
                setPassword={setPassword}
                showPassword={showPassword}
                setShowPassword={setShowPassword}
                remember={remember}
                setRemember={setRemember}
                isLoading={isLoading}
                handleLogin={handleLogin}
                clearUsername={clearUsername}
                togglePasswordVisibility={() => setShowPassword(prev => !prev)}
                usernameRef={usernameRef}
                passwordRef={passwordRef}
              />
            ) : (
              <OTPForm
                otpInputs={otpInputs}
                setOtpInputs={setOtpInputs}
                otpValue={otpValue}
                setOtpValue={setOtpValue}
                isLoading={isLoading}
                handleVerify={verifyOtp}
                handleResend={resendOtp}
                handleBack={showLoginForm}
                sentTarget={sentTarget}
                otpSentRef={otpSentRef}
                resendSeconds={resendSeconds}
                resendTimerRef={resendTimer}
                startResendCountdown={startResendCountdown}
              />
            )}
          </div>
        </article>
      </main>

      <ToastContainer toasts={toasts} />
    </div>
  );
}

export default App;
