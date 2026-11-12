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
  }
}
