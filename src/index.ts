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
  const sagaIO: Required<
    Pick<RunSagaOptions<any, S>, SagaIOKeys>
  > = useMemo(() => {
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
    const options = runSagaOptions || {}
    const sagaOptions: RunSagaOptions<any, any> = {
      ...sagaIO,
      sagaMonitor: options.sagaMonitor,
      onError: options.onError,
      context: options.context,
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
