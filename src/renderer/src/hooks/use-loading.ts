import { createContext, useContext, useReducer, useCallback } from 'react'

type LoadingAction = { type: 'INC' } | { type: 'DEC' }

function loadingReducer(count: number, action: LoadingAction): number {
    if (action.type === 'INC') return count + 1
    if (action.type === 'DEC') return Math.max(0, count - 1)
    return count
}

type LoadingContextValue = {
    count: number
    dispatch: React.Dispatch<LoadingAction>
}

export const LoadingContext = createContext<LoadingContextValue>({
    count: 0,
    dispatch: () => undefined
})

export function useLoadingReducer(): LoadingContextValue {
    const [count, dispatch] = useReducer(loadingReducer, 0)
    return { count, dispatch }
}

export function useLoading(): {
    isLoading: boolean
    start: () => void
    stop: () => void
    withLoading: <T>(fn: () => Promise<T>) => Promise<T>
} {
    const { count, dispatch } = useContext(LoadingContext)

    const start = useCallback(() => dispatch({ type: 'INC' }), [dispatch])
    const stop = useCallback(() => dispatch({ type: 'DEC' }), [dispatch])

    const withLoading = useCallback(
        <T>(fn: () => Promise<T>): Promise<T> => {
            dispatch({ type: 'INC' })
            return fn().finally(() => dispatch({ type: 'DEC' }))
        },
        [dispatch]
    )

    return { isLoading: count > 0, start, stop, withLoading }
}
