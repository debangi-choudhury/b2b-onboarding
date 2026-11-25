import React from 'react'

/*
 * Plain HTML stand-ins for the VTEX Styleguide components the Admin pages
 * use, keeping the props the pages rely on: labels, values, disabled and
 * loading states, and the modal's open state.
 */

type Children = { children?: React.ReactNode }

export const Layout = ({
  pageHeader,
  children,
}: Children & { pageHeader?: React.ReactNode }) => (
  <div>
    {pageHeader}
    {children}
  </div>
)

export const PageHeader = ({
  title,
  subtitle,
  linkLabel,
  onLinkClick,
}: {
  title: string
  subtitle?: string
  linkLabel?: string
  onLinkClick?: () => void
}) => (
  <header>
    {linkLabel && (
      <button type="button" onClick={onLinkClick}>
        {linkLabel}
      </button>
    )}
    <h1>{title}</h1>
    {subtitle && <p>{subtitle}</p>}
  </header>
)

export const PageBlock = ({
  title,
  children,
}: Children & { title?: string; variation?: string }) => (
  <section>
    {title && <h2>{title}</h2>}
    {children}
  </section>
)

export const Alert = ({
  type,
  children,
  onClose,
}: Children & { type: string; onClose?: () => void }) => (
  <div role="alert" data-type={type}>
    {children}
    {onClose && (
      <button type="button" onClick={onClose}>
        Close alert
      </button>
    )}
  </div>
)

export const Button = ({
  children,
  onClick,
  disabled,
  isLoading,
  type = 'button',
}: Children & {
  onClick?: () => void
  disabled?: boolean
  isLoading?: boolean
  type?: 'button' | 'submit'
  variation?: string
  size?: string
}) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled || isLoading}
    aria-busy={isLoading || undefined}
  >
    {children}
  </button>
)

export const Spinner = () => <span role="progressbar" />

export const Tag = ({
  type,
  children,
}: Children & { type?: string; size?: string; variation?: string }) => (
  <span data-tag={type}>{children}</span>
)

export const Textarea = ({
  label,
  value,
  onChange,
  maxLength,
  rows,
}: {
  label: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  maxLength?: number
  rows?: number
}) => (
  <label>
    {label}
    <textarea
      value={value}
      onChange={onChange}
      maxLength={maxLength}
      rows={rows}
    />
  </label>
)

export const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  bottomBar,
}: Children & {
  isOpen: boolean
  onClose: () => void
  title: string
  bottomBar?: React.ReactNode
}) =>
  isOpen ? (
    <div role="dialog" aria-label={title}>
      <h2>{title}</h2>
      {children}
      {bottomBar}
      <button type="button" onClick={onClose}>
        Close dialog
      </button>
    </div>
  ) : null
