import type { CharacterId } from '../game/types';

interface IconProps {
  className?: string;
}

export function DontMeltEmblem({ className = 'w-full max-w-[390px] h-auto' }: IconProps) {
  return (
    <svg
      viewBox="0 0 420 132"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="DON'T MELT!"
      role="img"
    >
      {/* Hypnotic wobble spiral crest */}
      <g transform="translate(46, 62)">
        <circle cx="0" cy="0" r="36" fill="#211238" stroke="#160c24" strokeWidth="6" />
        <circle cx="0" cy="0" r="31" fill="#ff5d8f" stroke="#160c24" strokeWidth="3.5" />
        <path
          d="M0 0 C4 -6, 12 -4, 12 3 C12 12, -2 16, -10 10 C-20 2, -18 -16, -4 -22 C12 -28, 26 -14, 24 4"
          stroke="#ffd166"
          strokeWidth="4.5"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="0" cy="0" r="4.5" fill="#160c24" />
        {/* Melting drip drops beneath spiral */}
        <path d="M-16 28 Q-14 44 -18 50 Q-22 44 -20 28 Z" fill="#ffd166" stroke="#160c24" strokeWidth="2.5" />
        <path d="M8 30 Q11 49 6 56 Q2 48 4 30 Z" fill="#2ec4b6" stroke="#160c24" strokeWidth="2.5" />
      </g>

      {/* Hand-inked melted wordmark */}
      <g transform="translate(96, 12)">
        {/* Shadow layer */}
        <text
          x="2"
          y="53"
          fill="#160c24"
          fontFamily="Fraunces, Georgia, serif"
          fontWeight="900"
          fontSize="44"
          letterSpacing="-1"
        >
          DON&apos;T
        </text>
        <text
          x="0"
          y="49"
          fill="#ffd166"
          stroke="#160c24"
          strokeWidth="6"
          paintOrder="stroke fill"
          fontFamily="Fraunces, Georgia, serif"
          fontWeight="900"
          fontSize="44"
          letterSpacing="-1"
        >
          DON&apos;T
        </text>

        <text
          x="3"
          y="104"
          fill="#160c24"
          fontFamily="Fraunces, Georgia, serif"
          fontWeight="900"
          fontSize="54"
          letterSpacing="-1.5"
        >
          MELT!
        </text>
        <text
          x="0"
          y="99"
          fill="#f7efde"
          stroke="#160c24"
          strokeWidth="7"
          paintOrder="stroke fill"
          fontFamily="Fraunces, Georgia, serif"
          fontWeight="900"
          fontSize="54"
          letterSpacing="-1.5"
        >
          MELT!
        </text>

        {/* Bold storybook melted drips */}
        <path d="M24 100 Q27 110 23 114 Q19 110 21 100 Z" fill="#ff5d8f" stroke="#160c24" strokeWidth="2.4" />
        <path d="M120 100 Q123 113 119 117 Q115 112 117 100 Z" fill="#ffd166" stroke="#160c24" strokeWidth="2.4" />
      </g>
    </svg>
  );
}

export function CharacterPortrait({ id, className = 'w-11 h-11' }: { id: CharacterId; className?: string }) {
  return (
    <svg viewBox="0 0 56 56" className={className} aria-hidden="true">
      <circle cx="28" cy="28" r="26" fill="#2d1a4b" stroke="#160c24" strokeWidth="3" />
      {id === 'pip' && (
        <g>
          <rect x="17" y="34" width="22" height="16" rx="6" fill="#3ea8e8" stroke="#160c24" strokeWidth="2.5" />
          <line x1="20" y1="35" x2="36" y2="49" stroke="#ffd166" strokeWidth="3" />
          <circle cx="28" cy="25" r="11" fill="#ffd685" stroke="#160c24" strokeWidth="2.5" />
          <path d="M18 19 A10 10 0 0 1 38 19 Z" fill="#2b59c3" stroke="#160c24" strokeWidth="2.5" />
          <rect x="27" y="16" width="14" height="4" rx="1.5" fill="#2b59c3" stroke="#160c24" strokeWidth="2" />
          <circle cx="25" cy="25" r="2.2" fill="#160c24" />
          <circle cx="32" cy="25" r="2.2" fill="#160c24" />
        </g>
      )}
      {id === 'barnaby' && (
        <g>
          <path d="M14 40 A5 5 0 0 1 14 48" fill="none" stroke="#ff70a6" strokeWidth="3" />
          <rect x="17" y="34" width="22" height="16" rx="6" fill="#fff2e2" stroke="#160c24" strokeWidth="2.5" />
          <circle cx="28" cy="26" r="11" fill="#ffffff" stroke="#160c24" strokeWidth="2.5" />
          <ellipse cx="28" cy="14" rx="14" ry="4" fill="#ff70a6" stroke="#160c24" strokeWidth="2.5" />
          <circle cx="24.5" cy="26" r="2.2" fill="#160c24" />
          <circle cx="31.5" cy="26" r="2.2" fill="#160c24" />
        </g>
      )}
      {id === 'djmoss' && (
        <g>
          <rect x="17" y="35" width="22" height="15" rx="6" fill="#48b882" stroke="#160c24" strokeWidth="2.5" />
          <circle cx="28" cy="26" r="11.5" fill="#6dd6a1" stroke="#160c24" strokeWidth="2.5" />
          <path d="M15 26 A13 13 0 0 1 41 26" fill="none" stroke="#ff4d9e" strokeWidth="4" />
          <circle cx="15" cy="27" r="4.2" fill="#ffd166" stroke="#160c24" strokeWidth="2" />
          <circle cx="41" cy="27" r="4.2" fill="#ffd166" stroke="#160c24" strokeWidth="2" />
          <circle cx="24" cy="25" r="2.4" fill="#160c24" />
          <circle cx="32" cy="25" r="2.4" fill="#160c24" />
        </g>
      )}
      {id === 'gerald' && (
        <g>
          <rect x="17" y="34" width="22" height="16" rx="3" fill="#9faab5" stroke="#160c24" strokeWidth="2.5" />
          <rect x="24" y="39" width="8" height="2.5" fill="#ffd166" />
          <circle cx="28" cy="26" r="10.5" fill="#c6cfd8" stroke="#160c24" strokeWidth="2.5" />
          <rect x="15" y="15" width="26" height="4" fill="#1f242c" stroke="#160c24" strokeWidth="2" />
          <rect x="20" y="7" width="16" height="9" fill="#1f242c" stroke="#160c24" strokeWidth="2" />
          <rect x="20" y="12.5" width="16" height="2.5" fill="#ffd166" />
          <circle cx="24.5" cy="26" r="2.2" fill="#160c24" />
          <circle cx="31.5" cy="26" r="2.2" fill="#160c24" />
        </g>
      )}
      {id === 'tilda' && (
        <g>
          {/* Pleatfolk surveyor coat + brass compass clasp */}
          <path d="M16 34 L40 34 L43 50 L13 50 Z" fill="#2ec4b6" stroke="#160c24" strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M23 35 L28 49 L33 35" fill="none" stroke="#f7efde" strokeWidth="2.2" />
          <circle cx="28" cy="40" r="3" fill="#ffd166" stroke="#160c24" strokeWidth="1.6" />
          <circle cx="28" cy="26" r="10.5" fill="#f7e5cc" stroke="#160c24" strokeWidth="2.5" />
          {/* Origami pleated surveyor cap */}
          <polygon points="14,19 28,8 42,19 28,21" fill="#f7efde" stroke="#160c24" strokeWidth="2.4" strokeLinejoin="round" />
          <line x1="28" y1="9" x2="28" y2="20" stroke="#2ec4b6" strokeWidth="2" />
          <circle cx="24.5" cy="26.5" r="2.1" fill="#160c24" />
          <circle cx="31.5" cy="26.5" r="2.1" fill="#160c24" />
        </g>
      )}
      {id === 'brin' && (
        <g>
          {/* Cobalt dock-fisher slicker + coiled line */}
          <rect x="16" y="34" width="24" height="16" rx="6" fill="#3a86ff" stroke="#160c24" strokeWidth="2.5" />
          <path d="M19 41 Q28 45 37 41" fill="none" stroke="#72efdd" strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="28" cy="26" r="10.5" fill="#e0f4ff" stroke="#160c24" strokeWidth="2.5" />
          {/* Turned-wood bobbin spool hat */}
          <rect x="16" y="16" width="24" height="3.5" rx="1.5" fill="#b07d4f" stroke="#160c24" strokeWidth="2" />
          <rect x="20" y="10" width="16" height="6.5" fill="#72efdd" stroke="#160c24" strokeWidth="2" />
          <line x1="21" y1="13.2" x2="35" y2="13.2" stroke="#160c24" strokeWidth="1.4" />
          <rect x="17" y="7.5" width="22" height="3.2" rx="1.4" fill="#b07d4f" stroke="#160c24" strokeWidth="2" />
          <circle cx="24.5" cy="26.5" r="2.1" fill="#160c24" />
          <circle cx="31.5" cy="26.5" r="2.1" fill="#160c24" />
        </g>
      )}
      {id === 'solfa' && (
        <g>
          <rect x="16" y="34" width="24" height="16" rx="6" fill="#3d2817" stroke="#160c24" strokeWidth="2.5" />
          <circle cx="28" cy="27" r="10.5" fill="#fff3d6" stroke="#160c24" strokeWidth="2.5" />
          <path d="M22 18 Q28 4 34 18 Z" fill="#ff9f1c" stroke="#160c24" strokeWidth="2.2" />
          <circle cx="28" cy="14" r="2.6" fill="#fff3b0" />
          <circle cx="24.5" cy="27" r="2.1" fill="#160c24" />
          <circle cx="31.5" cy="27" r="2.1" fill="#160c24" />
        </g>
      )}
      {id === 'marlo' && (
        <g>
          <rect x="16" y="34" width="24" height="16" rx="6" fill="#1d3557" stroke="#160c24" strokeWidth="2.5" />
          <path d="M19 42 L37 38" stroke="#4cc9f0" strokeWidth="3" strokeLinecap="round" />
          <circle cx="28" cy="26" r="10.5" fill="#f1faee" stroke="#160c24" strokeWidth="2.5" />
          <ellipse cx="27" cy="15" rx="13" ry="5.5" transform="rotate(-10 27 15)" fill="#4cc9f0" stroke="#160c24" strokeWidth="2.2" />
          <circle cx="24.5" cy="26.5" r="2.1" fill="#160c24" />
          <circle cx="31.5" cy="26.5" r="2.1" fill="#160c24" />
        </g>
      )}
      {id === 'bea' && (
        <g>
          <rect x="16" y="34" width="24" height="16" rx="6" fill="#7b5e7b" stroke="#160c24" strokeWidth="2.5" />
          <circle cx="19" cy="17" r="5.5" fill="#ff70a6" stroke="#160c24" strokeWidth="2.2" />
          <circle cx="37" cy="17" r="5.5" fill="#ff70a6" stroke="#160c24" strokeWidth="2.2" />
          <circle cx="28" cy="27" r="10.5" fill="#e6d7e6" stroke="#160c24" strokeWidth="2.5" />
          <circle cx="24.5" cy="27" r="2.1" fill="#160c24" />
          <circle cx="31.5" cy="27" r="2.1" fill="#160c24" />
        </g>
      )}
      {id === 'gus' && (
        <g>
          <rect x="15" y="34" width="26" height="16" rx="7" fill="#e63946" stroke="#160c24" strokeWidth="2.5" />
          <circle cx="28" cy="27" r="10.5" fill="#fff8ee" stroke="#160c24" strokeWidth="2.5" />
          <path d="M16 19 A12 6 0 0 1 40 19 Z" fill="#a8dadc" stroke="#160c24" strokeWidth="2.2" />
          <rect x="25" y="9" width="6" height="6" fill="#ffd166" stroke="#160c24" strokeWidth="2" />
          <circle cx="24.5" cy="27" r="2.1" fill="#160c24" />
          <circle cx="31.5" cy="27" r="2.1" fill="#160c24" />
        </g>
      )}
      {id === 'nori' && (
        <g>
          <rect x="16" y="34" width="24" height="16" rx="6" fill="#2ec4b6" stroke="#160c24" strokeWidth="2.5" />
          <circle cx="28" cy="27" r="10.5" fill="#fef9ef" stroke="#160c24" strokeWidth="2.5" />
          <polygon points="16,19 22,10 34,10 40,19" fill="#72efdd" stroke="#160c24" strokeWidth="2.2" />
          <rect x="21" y="13" width="14" height="3.2" fill="#ff5d8f" />
          <circle cx="24.5" cy="27" r="2.1" fill="#160c24" />
          <circle cx="31.5" cy="27" r="2.1" fill="#160c24" />
        </g>
      )}
      {id === 'mossie' && (
        <g>
          <rect x="16" y="34" width="24" height="16" rx="6" fill="#52b788" stroke="#160c24" strokeWidth="2.5" />
          <circle cx="28" cy="27" r="10.5" fill="#d8f3dc" stroke="#160c24" strokeWidth="2.5" />
          <ellipse cx="28" cy="18" rx="14" ry="3.5" fill="#ffd166" stroke="#160c24" strokeWidth="2" />
          <rect x="20" y="10" width="16" height="8" fill="#ffd166" stroke="#160c24" strokeWidth="2" />
          <rect x="20" y="14.5" width="16" height="2.6" fill="#52b788" />
          <circle cx="24.5" cy="27" r="2.1" fill="#160c24" />
          <circle cx="31.5" cy="27" r="2.1" fill="#160c24" />
        </g>
      )}
    </svg>
  );
}

export function VibeIcon({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M12 20.5C12 20.5 4 15.2 4 9.2C4 6.1 6.4 4 9.1 4C10.8 4 12 5 12 5C12 5 13.2 4 14.9 4C17.6 4 20 6.1 20 9.2C20 15.2 12 20.5 12 20.5Z"
        fill="#ff5d8f"
        stroke="#160c24"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <circle cx="9.2" cy="8.2" r="1.6" fill="#ffd1e0" />
    </svg>
  );
}

export function MunchIcon({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M7 18C4.5 16.5 3.5 13.2 4.8 10.4C6 7.8 9.2 7.2 11.4 9.2L12 9.8L12.6 9.2C14.8 7.2 18 7.8 19.2 10.4C20.5 13.2 19.5 16.5 17 18C14.8 19.3 12 17.6 12 15.6C12 17.6 9.2 19.3 7 18Z"
        fill="#ffd166"
        stroke="#160c24"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <circle cx="8.5" cy="13" r="1.4" fill="#160c24" />
      <circle cx="15.5" cy="13" r="1.4" fill="#160c24" />
    </svg>
  );
}

export function WobbleIcon({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9.5" fill="#2d1a4b" stroke="#160c24" strokeWidth="2.2" />
      <path
        d="M12 12C13.4 10.4 15.5 11.2 15.4 13C15.2 15.5 11.6 16.8 9.5 15C6.8 12.8 7.6 8.2 11 7.2C15 6 18.6 9.4 17.8 13.8"
        fill="none"
        stroke="#2ec4b6"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CapIcon({ className = 'w-3.5 h-3.5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="#ffd166" stroke="#160c24" strokeWidth="2.4" />
      <circle cx="12" cy="12" r="4.5" fill="#f4a261" stroke="#160c24" strokeWidth="1.6" />
    </svg>
  );
}

export function GossipIcon({ className = 'w-3.5 h-3.5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="3" fill="#2ec4b6" stroke="#160c24" strokeWidth="2.2" />
      <line x1="8" y1="9.5" x2="16" y2="9.5" stroke="#160c24" strokeWidth="2" strokeLinecap="round" />
      <line x1="8" y1="14" x2="13.5" y2="14" stroke="#160c24" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function SockIcon({ className = 'w-3.5 h-3.5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M9 4H15V13L19 16C20 17 19.2 19.5 17 19.5H10C8.5 19.5 8 18.2 8 17V4H9Z"
        fill="#ff85b3"
        stroke="#160c24"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <rect x="9" y="6.5" width="6" height="2.4" fill="#ffd166" />
    </svg>
  );
}

export function PhaseIcon({ phase, className = 'w-4 h-4' }: { phase: 'day' | 'dusk' | 'night'; className?: string }) {
  if (phase === 'day') {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <circle cx="12" cy="12" r="5.5" fill="#ffd166" stroke="#160c24" strokeWidth="2" />
        <path d="M12 2V5M12 19V22M2 12H5M19 12H22M4.9 4.9L7 7M17 17L19.1 19.1M19.1 4.9L17 7M7 17L4.9 19.1" stroke="#ffd166" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    );
  }
  if (phase === 'dusk') {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <circle cx="12" cy="12" r="8" fill="#ff5d8f" stroke="#160c24" strokeWidth="2.2" />
        <path d="M6 12H18M12 4V20" stroke="#ffd166" strokeWidth="1.8" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M17.5 14.5A7.5 7.5 0 0 1 9.5 6.5A7.5 7.5 0 1 0 17.5 14.5Z"
        fill="#b388ff"
        stroke="#160c24"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
