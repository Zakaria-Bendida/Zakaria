import React, { useEffect, useState, useRef } from 'react';
import type { Ambulance } from '../../data/mockData';
import { Ambulance as AmbulanceIcon, Check, X } from 'lucide-react';

interface AmbulanceSelectionPanelProps {
  isOpen: boolean;
  onClose: () => void;
  ambulances: Ambulance[];
  selectedIds: number[];
  onToggleSelect: (id: number) => void;
}

const AmbulanceSelectionPanel: React.FC<AmbulanceSelectionPanelProps> = ({
  isOpen,
  onClose,
  ambulances,
  selectedIds,
  onToggleSelect
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ x: window.innerWidth - 380, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  // Initial animation
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => setIsVisible(true));
    } else {
      setIsVisible(false);
    }
  }, [isOpen]);

  // Handle Dragging
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        // Calculate new position
        let newX = e.clientX - dragOffset.x;
        let newY = e.clientY - dragOffset.y;
        
        // Prevent dragging outside the window
        const maxX = window.innerWidth - (panelRef.current?.offsetWidth || 350);
        const maxY = window.innerHeight - (panelRef.current?.offsetHeight || 400);
        
        newX = Math.max(0, Math.min(newX, maxX));
        newY = Math.max(0, Math.min(newY, maxY));

        setPosition({ x: newX, y: newY });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  if (!isOpen && !isVisible) return null;

  const availableAmbulances = ambulances.filter(a => a.statut === 'Disponible' && a.latitude && a.longitude);

  return (
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: '350px',
        maxHeight: '600px',
        backgroundColor: '#ffffff',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)',
        zIndex: 2000,
        display: 'flex',
        flexDirection: 'column',
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(10px)',
        transition: isDragging ? 'none' : 'opacity 0.2s ease, transform 0.2s ease',
        overflow: 'hidden'
      }}
    >
      {/* Draggable Header */}
      <div 
        style={{ 
          padding: '12px 16px', 
          backgroundColor: '#f8f9fa', 
          borderBottom: '1px solid #e9ecef',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'move',
          userSelect: 'none'
        }}
        onMouseDown={handleMouseDown}
      >
        <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
          <AmbulanceIcon className="mr-2" size={18} />
          Sélection des ambulances
        </div>
        <button 
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
            color: '#6c757d'
          }}
        >
          <X size={18} />
        </button>
      </div>
      
      {/* Scrollable Content */}
      <div style={{ padding: '16px', overflowY: 'auto', flex: 1, maxHeight: '400px' }}>
        {availableAmbulances.length === 0 ? (
          <div className="ui warning message">
            <p>Aucune ambulance disponible ou géolocalisée.</p>
          </div>
        ) : (
          <div className="ui middle aligned divided list">
            {availableAmbulances.map(ambulance => {
              const isSelected = selectedIds.includes(ambulance.id);
              return (
                <div 
                  key={ambulance.id} 
                  className="item" 
                  style={{ padding: '12px 0', cursor: 'pointer', display: 'flex', alignItems: 'center' }} 
                  onClick={() => onToggleSelect(ambulance.id)}
                >
                  <div className="ui radio checkbox" style={{ marginRight: '1rem' }}>
                    <input 
                      type="radio" 
                      name="ambulanceSelection"
                      checked={isSelected}
                      readOnly
                    />
                    <label></label>
                  </div>
                  <AmbulanceIcon className="ui avatar image" size={24} color={isSelected ? 'red' : 'gray'} style={{ marginRight: '1rem' }} />
                  <div className="content">
                    <div className="header">{ambulance.immatriculation}</div>
                    <div className="description" style={{ fontSize: '0.85em', color: '#6c757d', marginTop: '2px' }}>
                      {ambulance.type} | {ambulance.kilometrage} km
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      {/* Footer */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid #e9ecef', backgroundColor: '#fff' }}>
        <button className="ui primary fluid button" onClick={onClose}>
          Fermer
        </button>
      </div>
    </div>
  );
};

export default AmbulanceSelectionPanel;
