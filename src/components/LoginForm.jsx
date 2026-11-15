import React, { useRef, useState, useEffect } from 'react';

function LoginForm({ 
  username, setUsername, 
  password, setPassword, 
  showPassword, setShowPassword,
  remember, setRemember,
  isLoading, 
  handleLogin,
  clearUsername,
  togglePasswordVisibility,
  usernameRef,
  passwordRef
}) {
  const [usernameLength, setUsernameLength] = useState(0);

  const handleUsernameChange = (e) => {
    const value = e.target.value;
    setUsername(value);
    e.target.closest('.field-wrapper')?.classList.add('typing');
  };

  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
    e.target.closest('.field-wrapper')?.classList.add('typing');
  };

  const handleUsernameFocus = () => {
    document.body.classList.add('focus-user');
    document.body.classList.remove('focus-pass');
  };

  const handleUsernameBlur = () => {
    document.body.classList.remove('focus-user');
  };

  const handlePasswordFocus = () => {
    document.body.classList.add('focus-pass');
    document.body.classList.remove('focus-user');
  };

  const handlePasswordBlur = () => {
    document.body.classList.remove('focus-pass');
  };

  return (
    <form className="login-form" onSubmit={handleLogin}>
      <div className="form-group">
        <label htmlFor="username" className="field-label">Username</label>
        <div className="field-wrapper">
          <div className="input-wrapper">
            <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" aria-hidden="true">
              <path d="M20 21a8 8 0 0 0-16 0"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            <input
              ref={usernameRef}
              type="text"
              className="field-input"
              id="username"
              name="username"
              autoComplete="username"
              placeholder="Enter your username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onFocus={() => document.body.classList.add('focus-user')}
              onBlur={() => document.body.classList.remove('focus-user')}
              onKeyDown={(e) => e.key === 'Enter' && passwordRef.current?.focus()}
              autoComplete="username"
              spellCheck={false}
              inputMode="text"
            />
            <button
              type="button"
              className="password-toggle"
              aria-label="Clear username"
              onClick={() => setUsername('')}
              style={{ opacity: username ? 1 : 0, pointerEvents: username ? 'auto' : 'none' }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="password" className="field-label">Password</label>
        <div className="input-wrapper">
          <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" width="18" height="18">
            <rect x="4" y="10" width="16" height="11" rx="2"/>
            <path d="M8 10V7a4 4 0 0 1 8 0v3"/>
          </svg>
          <input
            ref={passwordRef}
            type={showPassword ? 'text' : 'password'}
            className="field-input"
            id="password"
            name="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onFocus={() => { document.body.classList.add('focus-pass'); document.body.classList.remove('focus-user') }}
            onBlur={() => document.body.classList.remove('focus-pass')}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin}
            autoComplete="current-password"
            spellCheck={false}
            inputMode="text"
          />
          <button
            type="button"
            className="password-toggle"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            <svg id="eyeIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" aria-hidden="true">
              {showPassword
                ? (
                  <>
                    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </>
                )
                : (
                  <>
                    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </>
                )}
            </svg>
          </button>
        </div>
      </div>

      <div className="form-options">
        <label className="checkbox-wrapper">
          <input
            type="checkbox"
            id="remember"
            name="remember"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            autoComplete="off"
          />
          <span className="checkmark" aria-hidden="true"></span>
          <span className="check-label">Remember me</span>
        </label>
        <a href="#" className="forgot-link">Forgot password?</a>
      </div>

      <button type="submit" className="btn-primary" disabled={isLoading}>
        <span className="btn-text">LOGIN</span>
        <svg className="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" aria-hidden="true">
          <path d="M15 3h6v6"/>
          <path d="M10 14L20.5 3.5"/>
        </svg>
        {isLoading && <svg className="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="10" strokeOpacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/></svg>}
      </button>
    </form>
  );
}

export default LoginForm;