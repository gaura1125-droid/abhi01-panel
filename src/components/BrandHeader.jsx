import React, { useEffect, useState } from 'react';

function BrandHeader({ languageIndex, languages, languageLabels }) {
  const [animateChars, setAnimateChars] = useState([false, false, false, false]);

  useEffect(() => {
    const timers = [];
    const chars = ['V', 'y', 'Z', 'X'];
    chars.forEach((_, i) => {
      const timer = setTimeout(() => {
        setAnimateChars(prev => {
          const next = [...prev];
          next[i] = true;
          return next;
        });
      }, i * 200);
      timers.push(timer);
    });
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <header className="brand-header">
      <div className="brand-name">
        <span className={`brand-char brand-char-v ${animateChars[0] ? 'animate' : ''}`} style={{ color: '#ff3366' }}>V</span>
        <span className="brand-char brand-char-y" style={{ color: '#0044ff' }}>y</span>
        <span className="brand-char brand-char-z" style={{ color: '#ffffff' }}>Z</span>
        <span className="brand-char brand-char-x" style={{ color: '#00ff88' }}>X</span>
      </div>
      <div className="language-indicator">
        <span>{['Cyber Security', '网络安全'][0]}</span>
        <span style={{ color: 'var(--text-muted)', fontSize: '8px' }}>/</span>
        <span>{['English', '中文'][0]}</span>
      </div>
    </header>
  );
}

export default BrandHeader;