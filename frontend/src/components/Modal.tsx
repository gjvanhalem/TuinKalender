"use client";

import React, { ReactNode, useEffect } from "react";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children?: ReactNode;
  maxWidth?: string;
  footer?: ReactNode;
}

export default function Modal({ isOpen, onClose, title, children, maxWidth = "max-w-2xl", footer }: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 md:p-6 bg-on-surface/40 backdrop-blur-sm animate-in fade-in duration-300">
      <div 
        className={`bg-surface rounded-2xl shadow-2xl w-full ${maxWidth} max-h-[95vh] md:max-h-[90vh] flex flex-col overflow-hidden border border-outline-variant/10`}
      >
        <div className="p-4 md:p-6 border-b border-outline-variant/10 flex justify-between items-center bg-surface-container-high/50 shrink-0">
          <h2 className="font-headline text-xl md:text-2xl font-bold text-on-surface truncate pr-4">{title}</h2>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-colors active:scale-90 shrink-0"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        
        <div className="flex-grow overflow-auto p-4 md:p-8 custom-scrollbar">
          {children}
        </div>

        {footer && (
          <div className="p-4 md:p-6 bg-surface-container-high/30 border-t border-outline-variant/10 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
