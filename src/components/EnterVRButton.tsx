import React from 'react';

interface VRButtonProps {
  isSupported: boolean;
  onClick: () => void;
  inSession: boolean;
}

/**
 * EnterVRButton — The physical ignition for the AGI Mind.
 */
export const EnterVRButton: React.FC<VRButtonProps> = ({ isSupported, onClick, inSession }) => {
  if (!isSupported) return null;

  if (inSession) {
    return (
      <div style={{ 
        position: 'absolute', 
        top: 20, 
        left: '50%', 
        transform: 'translateX(-50%)',
        color: '#00ffcc',
        fontFamily: 'monospace',
        textShadow: '0 0 10px #00ffcc',
        zIndex: 1001
      }}>
        👁️ Imersão Neural Ativa
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      style={{
        position: 'absolute',
        bottom: '30px',
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '15px 30px',
        background: 'rgba(0, 255, 204, 0.1)',
        border: '1px solid #00ffcc',
        color: '#00ffcc',
        fontFamily: 'monospace',
        fontSize: '16px',
        cursor: 'pointer',
        boxShadow: '0 0 15px rgba(0, 255, 204, 0.5)',
        textTransform: 'uppercase',
        letterSpacing: '2px',
        zIndex: 1000,
        backdropFilter: 'blur(5px)',
        transition: 'all 0.3s ease'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(0, 255, 204, 0.2)';
        e.currentTarget.style.boxShadow = '0 0 25px rgba(0, 255, 204, 0.8)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'rgba(0, 255, 204, 0.1)';
        e.currentTarget.style.boxShadow = '0 0 15px rgba(0, 255, 204, 0.5)';
      }}
    >
      Enter AGI Mind (VR)
    </button>
  );
};
