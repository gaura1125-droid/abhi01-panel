// ==========================================================================
// VYzX Elite Cybersecurity Login Controller
// ==========================================================================

(() => {
    'use strict';

    // ==========================================================================
    // DOM Element References
    // ==========================================================================
    const loginForm = document.getElementById('loginForm');
    const otpForm = document.getElementById('otpForm');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const userClearBtn = document.getElementById('userClear');
    const passwordToggleBtn = document.getElementById('passwordToggle');
    const eyeIcon = document.getElementById('eyeIcon');
    const rememberCheckbox = document.getElementById('remember');
    const loginBtn = document.getElementById('loginBtn');
    const otpInputs = document.querySelectorAll('.otp-input');
    const otpGrid = document.getElementById('otpGrid');
    const verifyBtn = document.getElementById('verifyBtn');
    const resendBtn = document.getElementById('resendBtn');
    const backBtn = document.getElementById('backBtn');
    const otpSent = document.getElementById('otpSent');
    const sentTarget = document.getElementById('sentTarget');
    const userWrapper = document.getElementById('userWrapper');
    const passWrapper = document.getElementById('passWrapper');
    const userInputWrapper = document.getElementById('userInputWrapper');
    const passInputWrapper = document.getElementById('passInputWrapper');
    const passwordToggleBtn = document.getElementById('passwordToggle');
    const eyeIcon = document.getElementById('eyeIcon');
    const toastContainer = document.getElementById('toastContainer');

    // State
    let otpValue = '';
    let resendTimer = null;
    let resendSeconds = 0;

    // ==========================================================================
    // Utility Functions
    // ==========================================================================
    function showToast(message, type = 'info', duration = 4000) {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type} show`;
        toast.role = 'alert';
        toast.ariaLive = type === 'error' ? 'assertive' : 'polite';

        const icons = {
            error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
            success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><circle cx="12" cy="12" r="10"/><path d="M8 12l2 2 4-4"/></svg>',
            info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="8"/></svg>'
        };

        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || icons.info}</span>
            <span class="toast-text">${message}</span>
            <button class="toast-close" aria-label="Dismiss" type="button">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
        `;

        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => removeToast(toast));

        const container = document.getElementById('toastContainer');
        container.appendChild(toast);

        requestAnimationFrame(() => toast.classList.add('show'));

        const timeout = setTimeout(() => removeToast(toast), 4000);
        toast._timeout = timeout;

        function removeToast(toast) {
            clearTimeout(toast._timeout);
            toast.classList.remove('show');
            toast.addEventListener('transitionend', () => toast.remove(), { once: true });
        }
    }

    function setLoading(button, isLoading) {
        button.disabled = isLoading;
        button.classList.toggle('loading', isLoading);
        if (button === loginBtn) document.body.classList.toggle('login-busy', isLoading);
        if (button === verifyBtn) {
            document.body.classList.toggle('verify-busy', isLoading);
            const grid = document.getElementById('otpGrid');
            if (grid) grid.classList.toggle('scanning', isLoading);
        }
    }

    function flashError(target) {
        document.body.classList.add('auth-error');
        if (window.flashErrorTimer) clearTimeout(window.flashErrorTimer);
        window.flashErrorTimer = setTimeout(() => {
            document.body.classList.remove('auth-error');
        }, 780);
    }

    // ==========================================================================
    // Visual Effects Initialization
    // ==========================================================================
    function generateParticles(count = 35) {
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
    }

    function generateCircuitTraces() {
        const container = document.getElementById('circuitTraces');
        if (!container) return;

        // Horizontal traces
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

        // Vertical traces
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
    }

    // ==========================================================================
    // Input Event Handlers
    // ==========================================================================
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const userClearBtn = document.getElementById('userClear');
    const passwordToggleBtn = document.getElementById('passwordToggle');
    const eyeIcon = document.getElementById('eyeIcon');
    const rememberCheckbox = document.getElementById('remember');
    const loginBtn = document.getElementById('loginBtn');
    const otpInputs = document.querySelectorAll('.otp-input');
    const otpGrid = document.getElementById('otpGrid');
    const verifyBtn = document.getElementById('verifyBtn');
    const resendBtn = document.getElementById('resendBtn');
    const backBtn = document.getElementById('backBtn');
    const otpSent = document.getElementById('otpSent');
    const sentTarget = document.getElementById('sentTarget');
    const userWrapper = document.getElementById('userWrapper');
    const passWrapper = document.getElementById('passWrapper');
    const userInputWrapper = document.getElementById('userInputWrapper');
    const passInputWrapper = document.getElementById('passInputWrapper');
    const userClearBtn = document.getElementById('userClear');
    const passwordToggleBtn = document.getElementById('passwordToggle');
    const eyeIcon = document.getElementById('eyeIcon');
    const toastContainer = document.getElementById('toastContainer');
    const otpGrid = document.getElementById('otpGrid');
    const otpSent = document.getElementById('otpSent');
    const sentTarget = document.getElementById('sentTarget');

    let otpValue = '';
    let resendTimer = null;
    let resendSeconds = 0;

    function showToast(message, type = 'info', duration = 4000) {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type} show`;
        toast.role = 'alert';
        toast.ariaLive = type === 'error' ? 'assertive' : 'polite';

        const icons = {
            error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
            success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><circle cx="12" cy="12" r="10"/><path d="M8 12l2 2 4-4"/></svg>',
            info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="8"/></svg>'
        };

        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || icons.info}</span>
            <span class="toast-text">${message}</span>
            <button class="toast-close" aria-label="Dismiss" type="button">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
        `;

        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => removeToast(toast));

        const container = document.getElementById('toastContainer');
        container.appendChild(toast);

        requestAnimationFrame(() => toast.classList.add('show'));

        const timeout = setTimeout(() => removeToast(toast), 4000);
        toast._timeout = timeout;

        function removeToast(toast) {
            clearTimeout(toast._timeout);
            toast.classList.remove('show');
            toast.addEventListener('transitionend', () => toast.remove(), { once: true });
        }
    }

    function setLoading(button, isLoading) {
        button.disabled = isLoading;
        button.classList.toggle('loading', isLoading);
        if (button === loginBtn) document.body.classList.toggle('login-busy', isLoading);
        if (button === verifyBtn) {
            document.body.classList.toggle('verify-busy', isLoading);
            const grid = document.getElementById('otpGrid');
            if (grid) grid.classList.toggle('scanning', isLoading);
        }
    }

    function flashError(target) {
        document.body.classList.add('auth-error');
        if (window.flashErrorTimer) clearTimeout(window.flashErrorTimer);
        window.flashErrorTimer = setTimeout(() => {
            document.body.classList.remove('auth-error');
        }, 780);
    }

    function generateParticles(count = 35) {
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
    }

    function generateCircuitTraces() {
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
    }

    // ==========================================================================
    // Input Event Handlers
    // ==========================================================================
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const userClearBtn = document.getElementById('userClear');
    const passwordToggleBtn = document.getElementById('passwordToggle');
    const eyeIcon = document.getElementById('eyeIcon');
    const rememberCheckbox = document.getElementById('remember');
    const loginBtn = document.getElementById('loginBtn');
    const otpInputs = document.querySelectorAll('.otp-input');
    const otpGrid = document.getElementById('otpGrid');
    const verifyBtn = document.getElementById('verifyBtn');
    const resendBtn = document.getElementById('resendBtn');
    const backBtn = document.getElementById('backBtn');
    const otpSent = document.getElementById('otpSent');
    const sentTarget = document.getElementById('sentTarget');
    const userWrapper = document.getElementById('userWrapper');
    const passWrapper = document.getElementById('passWrapper');
    const userInputWrapper = document.getElementById('userInputWrapper');
    const passInputWrapper = document.getElementById('passInputWrapper');
    const userClearBtn = document.getElementById('userClear');
    const passwordToggleBtn = document.getElementById('passwordToggle');
    const eyeIcon = document.getElementById('eyeIcon');
    const toastContainer = document.getElementById('toastContainer');
    const otpGrid = document.getElementById('otpGrid');
    const otpSent = document.getElementById('otpSent');
    const sentTarget = document.getElementById('sentTarget');

    let otpValue = '';
    let resendTimer = null;
    let resendSeconds = 0;

    function showToast(message, type = 'info', duration = 4000) {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type} show`;
        toast.role = 'alert';
        toast.ariaLive = type === 'error' ? 'assertive' : 'polite';

        const icons = {
            error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
            success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><circle cx="12" cy="12" r="10"/><path d="M8 12l2 2 4-4"/></svg>',
            info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="8"/></svg>'
        };

        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || icons.info}</span>
            <span class="toast-text">${message}</span>
            <button class="toast-close" aria-label="Dismiss" type="button">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
        `;

        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => removeToast(toast));

        const container = document.getElementById('toastContainer');
        container.appendChild(toast);

        requestAnimationFrame(() => toast.classList.add('show'));

        const timeout = setTimeout(() => removeToast(toast), duration);
        toast._timeout = timeout;

        function removeToast(toast) {
            clearTimeout(toast._timeout);
            toast.classList.remove('show');
            toast.addEventListener('transitionend', () => toast.remove(), { once: true });
        }
    }

    function setLoading(button, isLoading) {
        button.disabled = isLoading;
        button.classList.toggle('loading', isLoading);
        if (button === loginBtn) document.body.classList.toggle('login-busy', isLoading);
        if (button === verifyBtn) {
            document.body.classList.toggle('verify-busy', isLoading);
            const grid = document.getElementById('otpGrid');
            if (grid) grid.classList.toggle('scanning', isLoading);
        }
    }

    function flashError(target) {
        document.body.classList.add('auth-error');
        if (window.flashErrorTimer) clearTimeout(window.flashErrorTimer);
        window.flashErrorTimer = setTimeout(() => {
            document.body.classList.remove('auth-error');
        }, 780);
    }

    function generateParticles(count = 35) {
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
    }

    function generateCircuitTraces() {
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
    }

    function handleInputFocus(input) {
        const wrapper = input.closest('.field-wrapper');
        if (wrapper) wrapper.classList.add('focused');
        document.body.classList.add(input === usernameInput ? 'focus-user' : 'focus-pass');
    }

    function handleInputBlur(input) {
        const wrapper = input.closest('.field-wrapper');
        if (wrapper) wrapper.classList.remove('focused', 'typing');
        document.body.classList.remove('focus-user', 'focus-pass');
    }

    function handleInput(input) {
        const wrapper = input.closest('.field-wrapper');
        if (wrapper) wrapper.classList.add('typing');
        clearTimeout(wrapper._typingTimer);
        wrapper._typingTimer = setTimeout(() => wrapper.classList.remove('typing'), 380);

        if (input === usernameInput && userClearBtn) {
            userClearBtn.style.opacity = input.value ? '1' : '0';
            userClearBtn.style.pointerEvents = input.value ? 'auto' : 'none';
        }
    }

    function togglePasswordVisibility() {
        const show = passwordInput.type === 'password';
        passwordInput.type = show ? 'text' : 'password';
        eyeIcon.className = show ? 'fas fa-eye' : 'fas fa-eye-slash';
        passwordToggleBtn.classList.add('eye-flash');
        setTimeout(() => passwordToggleBtn.classList.remove('eye-flash'), 540);
    }

    function clearUsername() {
        usernameInput.value = '';
        usernameInput.focus();
        userClearBtn.style.opacity = '0';
        userClearBtn.style.pointerEvents = 'none';
    }

    let otpValue = '';
    let resendTimer = null;
    let resendSeconds = 0;

    function handleOtpInput(input, index) {
        if (input.value.length === 1) {
            input.classList.add('filled');
            input.classList.remove('error');
            if (index < 5) {
                otpInputs[index + 1].focus();
            } else {
                setTimeout(() => {
                    const val = Array.from(otpInputs).map(x => x.value).join('');
                    if (val.length === 6) verifyOtp();
                }, 100);
            }
            input.classList.add('pulse');
            setTimeout(() => input.classList.remove('pulse'), 380);
            updateOtpProgress();
        } else if (input.value.length === 0) {
            input.classList.remove('filled');
            updateOtpProgress();
        }

        otpValue = Array.from(otpInputs).map(x => x.value).join('');

        if (otpValue.length === 6) {
            otpGrid.classList.add('complete');
            setTimeout(() => otpGrid.classList.remove('complete'), 760);
            setTimeout(() => verifyOtp(), 300);
        }
    }

    function handleOtpKeydown(e, index) {
        if (e.key === 'Backspace' && !e.target.value && index > 0) {
            otpInputs[index - 1].focus();
        } else if (e.key === 'ArrowLeft' && index > 0) {
            otpInputs[index - 1].focus();
        } else if (e.key === 'ArrowRight' && index < 5) {
            otpInputs[index + 1].focus();
        }
    }

    function handleOtpPaste(e, index) {
        e.preventDefault();
        const data = e.clipboardData.getData('text').trim();
        if (/^\d{6}$/.test(data)) {
            data.split('').forEach((v, j) => {
                if (j < 6) {
                    otpInputs[j].value = v;
                    otpInputs[j].classList.add('filled');
                }
            });
            otpValue = data;
            otpInputs[5].focus();
            updateOtpProgress();
            setTimeout(() => verifyOtp(), 100);
        }
    }

    function updateOtpProgress() {
        const filled = Array.from(otpInputs).filter(x => x.classList.contains('filled')).length;
        const progress = (filled / 6) * 100;
        otpGrid.style.setProperty('--progress', `${progress}%`);
    }

    async function verifyOtp() {
        if (otpValue.length !== 6) {
            otpInputs.forEach(x => x.classList.add('error'));
            flashError(otpGrid);
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
                body: JSON.stringify({ otp: otpValue })
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

            otpInputs.forEach(x => x.classList.add('error'));
            flashError(otpGrid);
            showToast(data.message || 'Invalid code', 'error');
        } catch (err) {
            showToast('Network error', 'error');
        } finally {
            setLoading(verifyBtn, false);
        }
    }

    function startResendCountdown() {
        resendSeconds = 60;
        resendBtn.disabled = true;
        resendBtn.classList.add('counting');
        updateResendButton();

        resendTimer = setInterval(() => {
            resendSeconds--;
            if (resendSeconds <= 0) {
                clearInterval(resendTimer);
                resendBtn.disabled = false;
                resendBtn.classList.remove('counting');
                resendBtn.innerHTML = `<svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg><span class="btn-text">Resend Code</span>`;
            } else {
                updateResendButton();
            }
        }, 1000);
    }

    function updateResendButton() {
        resendBtn.innerHTML = `
            <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16" aria-hidden="true">
                <circle cx="12" cy="12" r="9"/>
                <path d="M12 7v5l3 2"/>
            </svg>
            <span class="btn-text">${resendSeconds}s</span>
        `;
    }

    async function handleResend() {
        const username = usernameInput.value.trim();
        if (!username) return;

        setLoading(resendBtn, true);
        try {
            const response = await fetch('/login/resend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ username })
            });
            const data = await response.json();
            if (data.success) {
                startResendCountdown();
                otpInputs.forEach(x => {
                    x.value = '';
                    x.classList.remove('filled', 'error', 'pulse');
                });
                otpGrid.classList.remove('complete', 'scanning');
                otpValue = '';
                otpInputs[0].focus();
                showToast('Code resent', 'success');
            } else {
                flashError(resendBtn);
                showToast(data.message || 'Failed to resend', 'error');
            }
        } catch (err) {
            showToast('Network error', 'error');
        } finally {
            setLoading(resendBtn, false);
        }
    }

    function showOtpForm(username) {
        document.body.classList.remove('focus-user', 'focus-pass', 'auth-error', 'auth-success', 'bursting');
        document.documentElement.classList.remove('portal-active');
        document.body.classList.add('otp-active');

        otpSent.style.display = 'block';
        sentTarget.textContent = username;

        startResendCountdown();
        otpInputs.forEach(x => {
            x.value = '';
            x.classList.remove('filled', 'error', 'pulse');
        });
        otpGrid.classList.remove('complete', 'scanning');
        otpValue = '';

        setTimeout(() => otpInputs[0].focus(), 120);
    }

    function showLoginForm() {
        document.body.classList.remove('otp-active', 'otp-focus', 'verify-busy', 'auth-error', 'auth-success', 'bursting');
        document.documentElement.classList.remove('portal-active');
        otpGrid.classList.remove('scanning', 'complete');

        if (resendTimer) {
            clearInterval(resendTimer);
            resendTimer = null;
        }
        resendBtn.classList.remove('counting');
        otpSent.style.display = 'none';

        usernameInput.classList.remove('error');
        passwordInput.classList.remove('error');

        setLoading(loginBtn, false);
        setLoading(verifyBtn, false);
    }

    async function handleLogin(e) {
        e.preventDefault();

        const username = usernameInput.value.trim();
        const password = passwordInput.value;

        if (!username || !password) {
            flashError(loginForm);
            showToast('Enter identity code & access key', 'error');
            return;
        }

        document.body.classList.remove('auth-error');
        document.body.classList.add('bursting');
        setTimeout(() => document.body.classList.remove('bursting'), 950);

        setLoading(loginBtn, true);
        usernameInput.classList.remove('error');
        passwordInput.classList.remove('error');

        try {
            const response = await fetch('/login/step1', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    username,
                    password,
                    remember: rememberCheckbox.checked
                })
            });
            const data = await response.json();

            if (data.success) {
                showOtpForm(username);
            } else {
                if (data.errorCode === 'INVALID_PASSWORD' || data.message?.includes('password')) {
                    passwordInput.classList.add('error');
                    passwordInput.focus();
                } else {
                    usernameInput.classList.add('error');
                    usernameInput.focus();
                }
                flashError(loginForm);
                showToast(data.message || 'Authentication failed', 'error');
            }
        } catch (err) {
            showToast('Network error', 'error');
        } finally {
            setLoading(loginBtn, false);
        }
    }

    function showOtpForm(username) {
        document.body.classList.remove('focus-user', 'focus-pass', 'auth-error', 'auth-success', 'bursting');
        document.documentElement.classList.remove('portal-active');
        document.body.classList.add('otp-active');

        otpSent.style.display = 'block';
        sentTarget.textContent = username;

        startResendCountdown();
        otpInputs.forEach(x => {
            x.value = '';
            x.classList.remove('filled', 'error', 'pulse');
        });
        otpGrid.classList.remove('complete', 'scanning');
        otpValue = '';

        setTimeout(() => otpInputs[0].focus(), 120);
    }

    function showLoginForm() {
        document.body.classList.remove('otp-active', 'otp-focus', 'verify-busy', 'auth-error', 'auth-success', 'bursting');
        document.documentElement.classList.remove('portal-active');
        otpGrid.classList.remove('scanning', 'complete');

        if (resendTimer) {
            clearInterval(resendTimer);
            resendTimer = null;
        }
        resendBtn.classList.remove('counting');
        otpSent.style.display = 'none';

        usernameInput.classList.remove('error');
        passwordInput.classList.remove('error');

        setLoading(loginBtn, false);
        setLoading(verifyBtn, false);
    }

    async function handleLogin(e) {
        e.preventDefault();

        const username = usernameInput.value.trim();
        const password = passwordInput.value;

        if (!username || !password) {
            flashError(loginForm);
            showToast('Enter identity code & access key', 'error');
            return;
        }

        document.body.classList.remove('auth-error');
        document.body.classList.add('bursting');
        setTimeout(() => document.body.classList.remove('bursting'), 950);

        setLoading(loginBtn, true);
        usernameInput.classList.remove('error');
        passwordInput.classList.remove('error');

        try {
            const response = await fetch('/login/step1', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    username,
                    password,
                    remember: rememberCheckbox.checked
                })
            });
            const data = await response.json();

            if (data.success) {
                showOtpForm(username);
            } else {
                if (data.errorCode === 'INVALID_PASSWORD' || data.message?.includes('password')) {
                    passwordInput.classList.add('error');
                    passwordInput.focus();
                } else {
                    usernameInput.classList.add('error');
                    usernameInput.focus();
                }
                flashError(loginForm);
                showToast(data.message || 'Authentication failed', 'error');
            }
        } catch (err) {
            showToast('Network error', 'error');
        } finally {
            setLoading(loginBtn, false);
        }
    }

    function showOtpForm(username) {
        document.body.classList.remove('focus-user', 'focus-pass', 'auth-error', 'auth-success', 'bursting');
        document.documentElement.classList.remove('portal-active');
        document.body.classList.add('otp-active');

        otpSent.style.display = 'block';
        sentTarget.textContent = username;

        startResendCountdown();
        otpInputs.forEach(x => {
            x.value = '';
            x.classList.remove('filled', 'error', 'pulse');
        });
        otpGrid.classList.remove('complete', 'scanning');
        otpValue = '';

        setTimeout(() => otpInputs[0].focus(), 120);
    }

    function showLoginForm() {
        document.body.classList.remove('otp-active', 'otp-focus', 'verify-busy', 'auth-error', 'auth-success', 'bursting');
        document.documentElement.classList.remove('portal-active');
        otpGrid.classList.remove('scanning', 'complete');

        if (resendTimer) {
            clearInterval(resendTimer);
            resendTimer = null;
        }
        resendBtn.classList.remove('counting');
        otpSent.style.display = 'none';

        usernameInput.classList.remove('error');
        passwordInput.classList.remove('error');

        setLoading(loginBtn, false);
        setLoading(verifyBtn, false);
    }

    // ==========================================================================
    // Event Listeners
    // ==========================================================================
    function initEventListeners() {
        usernameInput.addEventListener('focus', () => handleInputFocus(usernameInput));
        usernameInput.addEventListener('blur', () => handleInputBlur(usernameInput));
        usernameInput.addEventListener('input', (e) => handleInput(e.target));

        passwordInput.addEventListener('focus', () => handleInputFocus(passwordInput));
        passwordInput.addEventListener('blur', () => handleInputBlur(passwordInput));
        passwordInput.addEventListener('input', (e) => handleInput(e.target));

        passwordToggleBtn.addEventListener('click', togglePasswordVisibility);
        userClearBtn.addEventListener('click', clearUsername);

        otpInputs.forEach((input, index) => {
            input.addEventListener('focus', () => {
                document.body.classList.add('otp-focus');
                input.closest('.otp-grid')?.classList.add('focused');
            });
            input.addEventListener('blur', () => {
                document.body.classList.remove('otp-focus');
                input.closest('.otp-grid')?.classList.remove('focused');
            });
            input.addEventListener('input', (e) => handleOtpInput(e.target, index));
            input.addEventListener('keydown', (e) => handleOtpKeydown(e, index));
            input.addEventListener('paste', (e) => handleOtpPaste(e, index));
        });

        loginForm.addEventListener('submit', handleLogin);
        verifyBtn.addEventListener('click', verifyOtp);
        resendBtn.addEventListener('click', handleResend);
        backBtn.addEventListener('click', showLoginForm);
        userClearBtn.addEventListener('click', clearUsername);
        passwordToggleBtn.addEventListener('click', togglePasswordVisibility);

        usernameInput.addEventListener('input', () => {
            userClearBtn.style.opacity = usernameInput.value ? '1' : '0';
            userClearBtn.style.pointerEvents = usernameInput.value ? 'auto' : 'none';
        });
    }

    async function checkTrusted() {
        const params = new URLSearchParams(location.search);
        if (params.get('force') === '1') return;

        try {
            const response = await fetch('/login/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: '{}'
            });
            const data = await response.json();
            if (data?.trusted && data.autoLogin) {
                location.href = data.redirect || '/';
            }
        } catch (err) {
            // Silent fail
        }
    }

    function init() {
        generateParticles(35);
        generateCircuitTraces();
        initEventListeners();
        checkTrusted();

        setTimeout(() => {
            document.body.classList.add('loaded');
        }, 100);

        console.log('%cNEBULA X SECURE ACCESS', 'color: #00ff88; font-size: 16px; font-weight: bold; font-family: "JetBrains Mono", monospace;');
        console.log('%cElite Cybersecurity Command Interface v3.7.1', 'color: #00e5ff; font-family: "JetBrains Mono", monospace;');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();