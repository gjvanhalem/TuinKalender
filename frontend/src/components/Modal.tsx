"use client";

import React, { ReactNode, useEffect } from "react";
import { X } from "lucide-react";

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
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div 
        className={`bg-white rounded-[40px] shadow-2xl w-full ${maxWidth} flex flex-col overflow-hidden border border-slate-100`}
      >
        <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
          <h2 className="text-2xl font-black text-slate-900">{title}</h2>
          <button 
            onClick={onClose}
            className="p-3 bg-white hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-2xl transition-all shadow-sm border border-slate-100"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="flex-grow overflow-auto p-8 custom-scrollbar">
          {children}
        </div>

        {footer && (
          <div className="p-6 bg-slate-50 border-t border-slate-100">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
