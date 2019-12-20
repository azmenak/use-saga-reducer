import React, {
  useReducer,
  useRef,
  useMemo,
  useEffect,
  useContext,
  Reducer,
  ReducerState,
  ReducerAction,
  Dispatch,
  createContext
} from 'react'
import {runSaga, stdChannel, Saga, RunSagaOptions} from 'redux-saga'

type SagaIOKeys = keyof Pick<
  RunSagaOptions<any, any>,
  'channel' | 'dispatch' | 'getState'
>
type ExposedRunSagaOptions<A, S> = Omit<RunSagaOptions<A, S>, SagaIOKeys>

interface SagaProdiderProps {
  value: object
}

const SagaContext = createContext<object>({})

export const SagaProvider: React.FC<SagaProdiderProps> = (props) => {
  return <SagaContext.Provider {...props} />
}

export function useSagaReducer<
  S extends Saga<never[]>,
  R extends Reducer<any, any>,
  I
>(
  saga: S,
  reducer: R,
  initializerArg?: I,
  initializer?: (arg: I) => ReducerState<R>,
  runSagaOptions?: ExposedRunSagaOptions<any, S>
): [ReducerState<R>, Dispatch<ReducerAction<R>>] {
  const [state, reactDispatch] = useReducer(
    reducer,
    initializerArg as any,
    initializer as any
  )

  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  const sagaIO: Required<Pick<
    RunSagaOptions<any, S>,
    SagaIOKeys
  >> = useMemo(() => {
    const channel = stdChannel()
    const dispatch = (action: ReducerAction<R>) => {
      reactDispatch(action)
      Promise.resolve().then(() => {
        channel.put(action)
      })
    }
    const getState = () => stateRef.current

    return {
      channel,
      dispatch,
      getState
    }
  }, [])

  const sagaContextValue = useContext(SagaContext)

  useEffect(() => {
    const options = runSagaOptions || {}
    const context = {
      ...sagaContextValue,
      ...options.context
    }
    const sagaOptions: RunSagaOptions<any, any> = {
      ...sagaIO,
      context,
      sagaMonitor: options.sagaMonitor,
      onError: options.onError,
      effectMiddlewares: options.effectMiddlewares
    }

    const task = runSaga<any, any, any>(sagaOptions, saga)

    return () => {
      task.cancel()
    }
  }, [])

  return [state, sagaIO.dispatch]
}

export default useSagaReducer
