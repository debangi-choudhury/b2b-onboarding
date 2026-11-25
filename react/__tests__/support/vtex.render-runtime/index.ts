export const navigate = jest.fn()

export const useRuntime = jest.fn(() => ({
  culture: { locale: 'en-US' },
  rootPath: '',
  query: {},
  navigate,
}))
