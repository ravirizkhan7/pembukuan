import React from 'react';
import { LucideIcon, X } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline-primary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: LucideIcon | React.ComponentType<{ size?: number; className?: string; color?: string }>;
  className?: string;
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  disabled = false,
  onClick,
  type = 'button',
  className = '',
  ...props
}: ButtonProps) {
  const sizeClass = size === 'sm' ? 'btn-sm' : size === 'lg' ? 'btn-lg' : '';
  const variantClass = `btn-${variant}`;

  return (
    <button
      type={type}
      className={`btn ${variantClass} ${sizeClass} ${className}`}
      disabled={disabled}
      onClick={onClick}
      {...props}
    >
      {Icon && <Icon size={size === 'sm' ? 14 : 16} />}
      {children}
    </button>
  );
}

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'primary' | 'success' | 'danger' | 'warning' | 'neutral';
  icon?: LucideIcon | React.ComponentType<{ size?: number; className?: string; color?: string }>;
  className?: string;
}

export function Badge({
  children,
  variant = 'primary',
  icon: Icon,
  className = ''
}: BadgeProps) {
  return (
    <span className={`badge badge-${variant} ${className}`}>
      {Icon && <Icon size={12} />}
      {children}
    </span>
  );
}

export interface CardProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: LucideIcon | React.ComponentType<{ size?: number; className?: string; color?: string }>;
  actions?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function Card({
  title,
  subtitle,
  icon: Icon,
  actions,
  children,
  footer,
  className = '',
  style
}: CardProps) {
  return (
    <div className={`card ${className}`} style={style}>
      {(title || actions) && (
        <div className="card-header">
          <div>
            {title && (
              <h3 className="card-title">
                {Icon && <Icon size={16} className="text-primary" />}
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-muted" style={{ fontSize: '12px', marginTop: '2px' }}>
                {subtitle}
              </p>
            )}
          </div>
          {actions && <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>{actions}</div>}
        </div>
      )}
      <div className="card-body">{children}</div>
      {footer && <div className="card-footer">{footer}</div>}
    </div>
  );
}

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  icon?: LucideIcon | React.ComponentType<{ size?: number; className?: string; color?: string }>;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'md' | 'lg';
}

export function Modal({
  isOpen,
  onClose,
  title,
  icon: Icon,
  children,
  footer,
  size = 'md'
}: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={`modal-content ${size === 'lg' ? 'modal-lg' : ''}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-header">
          <h3 className="card-title" style={{ fontSize: '15px' }}>
            {Icon && <Icon size={18} className="text-primary" />}
            {title}
          </h3>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onClose}
            aria-label="Tutup"
            style={{ minHeight: '36px', minWidth: '36px', padding: '6px' }}
          >
            <X size={16} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
