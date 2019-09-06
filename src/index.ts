import {
  useReducer,
  useRef,
  useMemo,
  useEffect,
  Reducer,
  ReducerState,
  ReducerAction,
  Dispatch
} from 'react'
import {runSaga, stdChannel, Saga, RunSagaOptions} from 'redux-saga'

type SagaIOKeys = keyof Pick<
  RunSagaOptions<any, any>,
  'channel' | 'dispatch' | 'getState'
>
type ExposedRunSagaOptions<A, S> = Omit<RunSagaOptions<A, S>, SagaIOKeys>

interface UseSagaReducerStateOptions<S> {
  initialState: S
}

interface UseSagaReducerInitializeWithArgsOptions<
  R extends Reducer<any, any>,
  I
> {
  initializerArg: I
  initializer: (arg: I) => ReducerState<R>
}
interface UseSagaReducerInitializeWithoutArgsOptions<
  R extends Reducer<any, any>
> {
  initializer: () => ReducerState<R>
}

export type UseSagaReducerReducerOptions<R extends Reducer<any, any>, I> =
  | UseSagaReducerStateOptions<R>
  | UseSagaReducerInitializeWithArgsOptions<R, I>
  | UseSagaReducerInitializeWithoutArgsOptions<R>
  | {}

export type UseSagaReducerOptions<
  R extends Reducer<any, any>,
  I
> = UseSagaReducerReducerOptions<R, I> & ExposedRunSagaOptions<any, any>

export function useSagaReducer<S extends Saga, R extends Reducer<any, any>, I>(
  saga: S,
  reducer: R,
  options: UseSagaReducerOptions<R, I> = {}
): [ReducerState<R>, Dispatch<ReducerAction<R>>] {
  const [state, reactDispatch] = useReducer(
    reducer,
    // @ts-ignore
    options.initialState || options.initializerArg,
    // @ts-ignore
    options.initializer
  )

  const stateRef = useRef(state)
  const sagaIO: Pick<RunSagaOptions<any, any>, SagaIOKeys> = useMemo(() => {
    const channel = stdChannel()
    const dispatch = (action: ReducerAction<R>) => {
      setImmediate(channel.put, action)
      reactDispatch(action)
    }
    const getState = () => stateRef.current

    return {
      channel,
      dispatch,
      getState
    }
  }, [])

  useEffect(() => {
    const sagaOptions: RunSagaOptions<any, any> = {
      ...sagaIO,
      sagaMonitor: options.sagaMonitor,
      onError: options.onError,
      context: options.context,
      effectMiddlewares: options.effectMiddlewares
    }

    const task = runSaga(sagaOptions, saga)

    return () => {
      task.cancel()
    }
  })

  return [state, sagaIO.dispatch]
}
