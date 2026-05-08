import { useState, useRef, useEffect } from 'react';
import { HelpCircle } from 'lucide-react';

/**
 * Tıklanabilir bilgi popup'ı.
 * Kullanım: <HelpTooltip>Bu kartın açıklaması...</HelpTooltip>
 *
 * Props:
 * - children: tooltip içeriği (string veya JSX)
 * - position: 'top' | 'bottom' | 'left' | 'right' | 'auto' (default 'auto' — sayfa kenarına göre kararlaştırır)
 * - size: 14 (default)
 */
export default function HelpTooltip({ children, position = 'auto', size = 14 }) {
  const [open, setOpen] = useState(false);
  const [resolvedPos, setResolvedPos] = useState('top');
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    // Açıldığında pozisyonu otomatik karar ver
    if (position === 'auto' && wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      const spaceTop = rect.top;
      const spaceBottom = window.innerHeight - rect.bottom;
      const spaceLeft = rect.left;
      const spaceRight = window.innerWidth - rect.right;
      // Tooltip boyutu ~280×120
      if (spaceTop > 140) setResolvedPos('top');
      else if (spaceBottom > 140) setResolvedPos('bottom');
      else if (spaceLeft > 300) setResolvedPos('left');
      else setResolvedPos('right');
    } else if (position !== 'auto') {
      setResolvedPos(position);
    }

    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const handleEsc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [open, position]);

  return (
    <span ref={wrapperRef} className="help-tooltip-wrapper" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className={`help-tooltip-trigger ${open ? 'help-tooltip-trigger-active' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-label="Bilgi"
        title="Bilgi"
      >
        <HelpCircle size={size} />
      </button>
      {open && (
        <div className={`help-tooltip-content help-tooltip-${resolvedPos}`}>
          {children}
        </div>
      )}
    </span>
  );
}
