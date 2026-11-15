import React, { useEffect, useRef } from 'react';

function BackgroundEffects() {
  const particleFieldRef = useRef(null);
  const circuitTracesRef = useRef(null);

  useEffect(() => {
    // Particle system
    const generateParticles = (count = 35) => {
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
        document.getElementById('particleField')?.appendChild(particle);
      }
    };

    // Circuit traces
    const generateCircuitTraces = () => {
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
        document.getElementById('circuitTraces')?.appendChild(trace);
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
        document.getElementById('circuitTraces')?.appendChild(trace);
      }
    };

    generateParticles(35);
    generateCircuitTraces();
  }, []);

  return (
    <>
      <canvas ref={particleFieldRef} className="particle-field" aria-hidden="true" />
      <div className="circuit-traces" id="circuitTraces" aria-hidden="true"></div>
      <div className="scanlines" aria-hidden="true"></div>
    </>
  );
}

export default BackgroundEffects;