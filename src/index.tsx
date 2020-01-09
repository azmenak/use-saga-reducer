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
import {
  runSaga,
  stdChannel,
  Saga,
  RunSagaOptions,
  SagaMonitor,
  EffectMiddleware
} from 'redux-saga'

type SagaIOKeys = keyof Pick<
  RunSagaOptions<any, any>,
  'channel' | 'dispatch' | 'getState'
>
type ExposedRunSagaOptions<A, S> = Omit<RunSagaOptions<A, S>, SagaIOKeys>

interface SagaProdiderProps extends ExposedRunSagaOptions<any, any> {}

const SagaContext = createContext<SagaProdiderProps>({})

/**
 * Passes values into `runSaga` of each decendent `useSagaReducer` call.
 *
 * Methods are merged with local values, context methods are run first.
 * Context value is merged with local value, local values will override
 * existing properties.
 * @param props Optional saga options
 */
export const SagaProvider: React.FC<SagaProdiderProps> = ({
  children,
  ...props
}) => {
  return <SagaContext.Provider value={props} children={children} />
}

type VoidMethod = (...args: any[]) => void

function mergeVoidMethods(
  contextMethod: VoidMethod | undefined,
  localMethod: VoidMethod | undefined
): VoidMethod | undefined {
  if (!contextMethod && !localMethod) {
    return
  }

  if (contextMethod && !localMethod) {
    return contextMethod
  }

  if (!contextMethod && localMethod) {
    return localMethod
  }

  return (...args: any[]) => {
    contextMethod!(...args)
    localMethod!(...args)
  }
}

function mergeSagaMonitors(
  contextMonitor: SagaMonitor | undefined,
  localMonitor: SagaMonitor | undefined
): SagaMonitor | undefined {
  if (!contextMonitor && !localMonitor) {
    return
  }

  if (contextMonitor && !localMonitor) {
    return contextMonitor
  }

  if (!contextMonitor && localMonitor) {
    return localMonitor
  }

  const sagaMonitorKeys: (keyof SagaMonitor)[] = [
    'actionDispatched',
    'effectCancelled',
    'effectRejected',
    'effectResolved',
    'effectTriggered',
    'rootSagaStarted'
  ]

  const combinedSagaMonitor: SagaMonitor = {}
  for (const key of sagaMonitorKeys) {
    const method = mergeVoidMethods(contextMonitor![key], localMonitor![key])
    if (method) {
      combinedSagaMonitor[key] = method
    }
  }

  return combinedSagaMonitor
}

function mergeEffectMiddlewares(
  contextMiddlewares: EffectMiddleware[] | undefined,
  localMiddlewares: EffectMiddleware[] | undefined
): EffectMiddleware[] | undefined {
  if (!contextMiddlewares && !localMiddlewares) {
    return
  }

  if (contextMiddlewares && !localMiddlewares) {
    return contextMiddlewares
  }

  if (!contextMiddlewares && localMiddlewares) {
    return localMiddlewares
  }

  return [...contextMiddlewares!, ...localMiddlewares!]
}

/**
 * Create an saga, disconnected from redux with its own state and dispatch.
 *
 * @see https://github.com/azmenak/use-saga-reducer
 * @example
 * ```
 * function* dataFetcher() {
 *   try {
 *     const data = yield call(API.fetchData)
 *     yield put({type: 'FETCH_SUCCESS', payload: data})
 *   } catch (error) {
 *     yield put({type: 'FETCH_ERROR'})
 *   }
 * }
 *
 * function* dataFetchingSaga() {
 *   yield takeLatest('FETCH', dataFetcher)
 * }
 *
 * function reducer(state = {}, action) {
 *   if (action.type === 'FETCH_SUCCESS') {
 *     return action.payload
 *   }
 *
 *   return state
 * }
 *
 * //...
 *
 * const [state, dispatch] = useSagaReducer(saga, reducer)
 * ```
 */
export function useSagaReducer<
  S extends Saga<never[]>,
  R extends Reducer<any, any>,
  I
>(
  /**
   * Saga method, called when the component mounts, must be a generator function.
   * Same as would be passed to reduxSaga.runSaga
   */
  saga: S,
  /**
   * Reducer method, passed into React's `useReducer` method
   */
  reducer: R,
  /**
   * Optional initalized argument, passed into React's `useReducer` method
   */
  initializerArg?: I,
  /**
   * Store initialized function, passed into React's `useReducer` method
   */
  initializer?: (arg: I) => ReducerState<R>,
  /**
   * Additional options passed into the `runSaga` method
   *
   * Supports:
   * ```
   * sagaMonitor // each monitor will run context methods then local methods
   * onError // runs context method then local method
   * context // merges context values into local values
   * effectMiddlewares // combines with context middleswares, running context first
   * ```
   * @see https://redux-saga.js.org/docs/api/#runsagaoptions-saga-args
   */
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

  const sagaContext = useContext(SagaContext)

  useEffect(() => {
    const options = runSagaOptions || {}
    const context = {
      ...sagaContext.context,
      ...options.context
    }
    const sagaMonitor = mergeSagaMonitors(
      sagaContext.sagaMonitor,
      options.sagaMonitor
    )
    const onError = mergeVoidMethods(sagaContext.onError, options.onError)
    const effectMiddlewares = mergeEffectMiddlewares(
      sagaContext.effectMiddlewares,
      options.effectMiddlewares
    )
    const sagaOptions: RunSagaOptions<any, any> = {
      ...sagaIO,
      context,
      sagaMonitor,
      onError,
      effectMiddlewares
    }

    const task = runSaga<any, any, any>(sagaOptions, saga)

    return () => {
      task.cancel()
    }
  }, [])

  return [state, sagaIO.dispatch]
}

/**
 * Helper function to create custom redux-saga effects
 * @param type unique type string
 * @param payload any object
 */
export function makeCustomEffect(type: string, payload: object) {
  return {
    '@@redux-saga/custom': true,
    combinator: false,
    type,
    payload
  }
}

export default useSagaReducer
