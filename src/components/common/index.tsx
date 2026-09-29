import React from 'react';
import { LucideIcon } from 'lucide-react';

export interface PageHeaderProps {
  title: string;
  category?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function PageHeader({
  title,
  category,
  subtitle,
  actions
}: PageHeaderProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        marginBottom: '20px',
        paddingBottom: '14px',
        borderBottom: '1px solid var(--color-border)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        <span
          style={{
            display: 'inline-block',
            width: '4px',
            height: category ? '36px' : '20px',
            backgroundColor: 'var(--color-primary)',
            borderRadius: '2px',
            marginTop: '2px',
            flexShrink: 0
          }}
          aria-hidden="true"
        />
        <div>
          {category && (
            <div
              style={{
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--color-primary)',
                marginBottom: '2px'
              }}
            >
              {category}
            </div>
          )}
          <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--color-dark-text)', letterSpacing: '-0.2px' }}>
            {title}
          </h1>
          {subtitle && (
            <p className="text-muted" style={{ margin: '3px 0 0 0', fontSize: '12.5px' }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {actions && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {actions}
        </div>
      )}
    </div>
  );
}

export interface MetricCardProps {
  title: string;
  value: string;
  unit?: string;
  subtitle?: string;
  icon?: LucideIcon | React.ComponentType<{ size?: number; className?: string; color?: string }>;
  trend?: string;
}

export function MetricCard({
  title,
  value,
  unit = '',
  subtitle,
  icon: Icon
}: MetricCardProps) {
  return (
    <div
      style={{
        backgroundColor: 'var(--color-white)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--border-radius-sm)',
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minHeight: '104px',
        boxShadow: 'var(--shadow-sm)',
        position: 'relative'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span
          style={{
            fontSize: '11.5px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.4px',
            color: 'var(--color-muted-text)'
          }}
        >
          {title}
        </span>
        {Icon && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '28px',
              height: '28px',
              borderRadius: 'var(--border-radius-xs)',
              backgroundColor: 'var(--color-primary-light)',
              color: 'var(--color-primary)'
            }}
          >
            <Icon size={15} />
          </span>
        )}
      </div>

      <div style={{ margin: '8px 0 2px 0' }}>
        <div
          style={{
            fontSize: '20px',
            fontWeight: 700,
            color: 'var(--color-dark-text)',
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '-0.3px'
          }}
        >
          {value}
          {unit && (
            <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-muted-text)', marginLeft: '4px' }}>
              {unit}
            </span>
          )}
        </div>
      </div>

      {subtitle && (
        <div style={{ fontSize: '12px', color: 'var(--color-muted-text)' }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}
