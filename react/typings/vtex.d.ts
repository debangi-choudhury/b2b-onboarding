declare module 'vtex.css-handles' {
  export function useCssHandles<T extends string>(
    handles: readonly T[]
  ): Record<T, string>
}

declare module 'vtex.render-runtime' {
  export function useRuntime(): {
    culture: { locale: string }
    rootPath?: string
    query?: Record<string, string | undefined>
    navigate: (options: { to: string }) => void
  }
}

declare module '*.graphql' {
  import type { DocumentNode } from 'graphql'

  const value: DocumentNode
  export default value
}

/* Only the vtex.styleguide components and props this app uses */
declare module 'vtex.styleguide' {
  import type { ComponentType, ReactNode } from 'react'

  export const Layout: ComponentType<{
    pageHeader?: ReactNode
    fullWidth?: boolean
  }>
  export const PageHeader: ComponentType<{
    title: ReactNode
    subtitle?: ReactNode
    linkLabel?: ReactNode
    onLinkClick?: () => void
  }>

  export const PageBlock: ComponentType<{
    title?: ReactNode
    subtitle?: ReactNode
    variation?: 'full' | 'half' | 'annotated' | 'aside'
  }>

  export const Button: ComponentType<{
    variation?:
      | 'primary'
      | 'secondary'
      | 'tertiary'
      | 'danger'
      | 'danger-tertiary'
    size?: 'small' | 'regular' | 'large'
    isLoading?: boolean
    disabled?: boolean
    onClick?: () => void
    href?: string
    target?: string
    children?: ReactNode
  }>

  export const Tag: ComponentType<{
    type?: 'success' | 'error' | 'warning' | 'neutral'
    variation?: 'low'
    size?: 'small' | 'regular'
    children?: ReactNode
  }>

  export const Spinner: ComponentType<{ size?: number }>
  export const Alert: ComponentType<{
    type: 'success' | 'error' | 'warning'
    onClose?: () => void
    children?: ReactNode
  }>

  export const Textarea: ComponentType<{
    label?: ReactNode
    value?: string
    onChange?: (e: { target: { value: string } }) => void
    helpText?: ReactNode
    errorMessage?: ReactNode
    rows?: number
    maxLength?: number
  }>

  export const Modal: ComponentType<{
    isOpen: boolean
    onClose: () => void
    title?: ReactNode
    bottomBar?: ReactNode
    responsiveFullScreen?: boolean
    children?: ReactNode
  }>
}
