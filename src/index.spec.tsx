import React from 'react'

import {
  takeEvery,
  put,
  select,
  delay,
  getContext,
  setContext,
  spawn
} from 'redux-saga/effects'
import {SagaMonitor} from 'redux-saga'
import {render, fireEvent, act} from '@testing-library/react'

import useSagaReducer, {SagaProvider, makeCustomEffect} from '.'

function flushPromiseQueue() {
  return new Promise<undefined>((resolve) => {
    setTimeout(() => {
      resolve()
    }, 0)
  })
}

describe('useSagaReducer()', () => {
  it('yields actions taken by `takeEvery`', async () => {
    const testCaller = jest.fn()
    const testAction = {
      type: 'TEST'
    }
    const testPutAction = {
      type: 'TEST_PUT'
    }
    const testReducer = jest.fn((state = {}, action: any) => {
      return state
    })

    function* testSaga() {
      yield put(testPutAction)
      yield takeEvery(testAction.type, testCaller)
    }

    function TestUseSagaReducer() {
      const [, dispatch] = useSagaReducer(testSaga, testReducer, {})

      return (
        <div>
          <button
            data-testid='button'
            onClick={() => {
              dispatch(testAction)
            }}
          >
            TEST
          </button>
        </div>
      )
    }

    const {getByTestId} = render(<TestUseSagaReducer />)
    const button = getByTestId('button')

    expect(testReducer).toHaveBeenCalledWith({}, testPutAction)

    fireEvent.click(button)
    await flushPromiseQueue()
    expect(testCaller.mock.calls.length).toBe(1)

    fireEvent.click(button)
    await flushPromiseQueue()
    expect(testCaller.mock.calls.length).toBe(2)
  })

  it('saga can update the state using put actions', async () => {
    const testReducer = jest.fn((state = {}, action: any) => {
      if (action.payload) {
        return action.payload
      }

      return state
    })

    function* testSaga() {
      yield delay(0)
      const state = yield select()
      yield put({
        type: 'UPDATE',
        payload: {
          count: state.count + 1
        }
      })
    }
    function TestUseSagaReducer() {
      const [state] = useSagaReducer(testSaga, testReducer, {count: 1})

      return <div data-testid='test'>{state.count}</div>
    }

    const {getByTestId} = render(<TestUseSagaReducer />)
    const el = getByTestId('test')

    expect(el.textContent).toBe('1')

    await act(flushPromiseQueue)

    expect(el.textContent).toBe('2')
  })

  it('saga updates the state available to yield select()', async () => {
    let testState: any
    const testReducer = jest.fn((state = {}, action: any) => {
      if (action.type === 'INCREMENT') {
        return {
          count: state.count + 1
        }
      }

      if (action.type === 'SET') {
        return {
          count: action.payload
        }
      }

      return state
    })

    function* increment() {
      const {count} = yield select()
      testState = count
    }

    function* incrementAsync() {
      const state = yield select()
      yield put({
        type: 'SET',
        payload: state.count + 1
      })

      yield delay(0)
      const {count} = yield select()
      testState = count
    }

    function* testSaga() {
      yield takeEvery('INCREMENT', increment)
      yield takeEvery('INCREMENT_ASYNC', incrementAsync)
    }

    function TestUseSagaReducer() {
      const [, dispatch] = useSagaReducer(testSaga, testReducer, {count: 1})

      return (
        <div>
          <button
            data-testid='button'
            onClick={() => {
              dispatch({
                type: 'INCREMENT'
              })
            }}
          >
            TEST
          </button>
          <button
            data-testid='button-async'
            onClick={() => {
              dispatch({
                type: 'INCREMENT_ASYNC'
              })
            }}
          >
            TEST
          </button>
        </div>
      )
    }

    const {getByTestId} = render(<TestUseSagaReducer />)
    const button = getByTestId('button')
    const buttonAsync = getByTestId('button-async')

    fireEvent.click(button)
    await act(flushPromiseQueue)

    expect(testState).toEqual(2)

    fireEvent.click(button)
    await act(flushPromiseQueue)

    expect(testState).toEqual(3)

    fireEvent.click(buttonAsync)
    await act(flushPromiseQueue)
    // Add a second flush here, once to wait for microtasks queue from put,
    // second one to wait for timer queue from delay task
    await act(flushPromiseQueue)

    expect(testState).toEqual(4)
  })

  it('provides context values in sagas passed to provider', async () => {
    const testReducer = jest.fn((state = {}, action: any) => {
      return state
    })

    function* updateContextValue({payload}: {type: string; payload: string}) {
      yield setContext({foo: payload})
      const contextValue = yield getContext('foo')
      yield put({
        type: 'CONTEXT_VALUE',
        payload: contextValue
      })
    }

    function* testSaga() {
      const contextValue = yield getContext('foo')
      yield put({
        type: 'CONTEXT_VALUE',
        payload: contextValue
      })
      yield takeEvery('UPDATE_CONTEXT', updateContextValue)
    }

    const globalState = {foo: 'bar'}

    function TestApp() {
      return (
        <SagaProvider context={globalState}>
          <TestUseSagaReducer />
        </SagaProvider>
      )
    }

    function TestUseSagaReducer() {
      const [, dispatch] = useSagaReducer(testSaga, testReducer, {})
      return (
        <div>
          <button
            data-testid='button'
            onClick={() => {
              dispatch({
                type: 'UPDATE_CONTEXT',
                payload: 'baz'
              })
            }}
          >
            TEST
          </button>
        </div>
      )
    }

    const {getByTestId} = render(<TestApp />)
    const button = getByTestId('button')

    expect(testReducer).toHaveBeenCalledWith(
      {},
      {type: 'CONTEXT_VALUE', payload: 'bar'}
    )

    fireEvent.click(button)

    await flushPromiseQueue()

    expect(testReducer).toHaveBeenNthCalledWith(
      2,
      {},
      {type: 'UPDATE_CONTEXT', payload: 'baz'}
    )
    expect(testReducer).toHaveBeenNthCalledWith(
      3,
      {},
      {type: 'CONTEXT_VALUE', payload: 'baz'}
    )
  })

  it('calls sagaMonitor, onError, and effectMiddlewares from context', async () => {
    const testReducer = jest.fn((state = {}, action: any) => {
      return state
    })

    function* errorThrower() {
      throw new Error('Happy Test')
    }

    function* testErrorSaga() {
      yield takeEvery('TEST_ERROR', errorThrower)
    }

    function* testSaga() {
      yield put({
        type: 'TEST_INIT',
        payload: 'TEST'
      })
      yield spawn(testErrorSaga)
    }

    const testMonior: SagaMonitor = {
      effectTriggered: jest.fn()
    }

    const testOnError = jest.fn()

    const testIntercept = jest.fn()
    const testEffectMiddleware = jest.fn((next) => (effect: any) => {
      testIntercept(effect)
      return next(effect)
    })

    function TestApp() {
      return (
        <SagaProvider
          sagaMonitor={testMonior}
          onError={testOnError}
          effectMiddlewares={[testEffectMiddleware]}
        >
          <TestUseSagaReducer />
        </SagaProvider>
      )
    }

    function TestUseSagaReducer() {
      const [, dispatch] = useSagaReducer(testSaga, testReducer, {})
      return (
        <div>
          <button
            data-testid='button'
            onClick={() => {
              dispatch({
                type: 'TEST_ERROR'
              })
            }}
          >
            TEST
          </button>
        </div>
      )
    }

    const {getByTestId} = render(<TestApp />)
    const button = getByTestId('button')

    // Distpaches
    // - init
    // - spawn
    // - takeEvery (take effects inside a spawned process dispatch twice)
    expect(testMonior.effectTriggered).toHaveBeenCalledTimes(4)
    expect(testOnError).not.toHaveBeenCalled()
    expect(testIntercept).toHaveBeenCalledTimes(4)

    fireEvent.click(button)

    await flushPromiseQueue()

    expect(testMonior.effectTriggered).toHaveBeenCalledTimes(5)
    expect(testOnError).toHaveBeenCalledTimes(1)
    expect(testIntercept).toHaveBeenCalledTimes(5)
  })

  it('supports yield-ing to custom effects', async () => {
    const testReducer = jest.fn((state = {}, action: any) => {
      return state
    })

    function testPut(action: object) {
      return makeCustomEffect('TEST_PUT', {action})
    }

    function* testSaga() {
      yield put({
        type: 'TEST_INIT',
        payload: 'TEST'
      })
      yield testPut({
        type: 'TEST_TEST_PUT'
      })
    }

    let testPutCount = 0
    const testMonior: SagaMonitor = {
      effectTriggered: jest.fn((options) => {
        if (options.effect.type === 'TEST_PUT') {
          testPutCount += 1
        }
      })
    }

    function TestApp() {
      return (
        <SagaProvider sagaMonitor={testMonior}>
          <TestUseSagaReducer />
        </SagaProvider>
      )
    }

    function TestUseSagaReducer() {
      const [, dispatch] = useSagaReducer(testSaga, testReducer, {})
      return (
        <div>
          <button
            data-testid='button'
            onClick={() => {
              dispatch({
                type: 'TEST_TEST_PUT'
              })
            }}
          >
            TEST
          </button>
        </div>
      )
    }

    const {getByTestId} = render(<TestApp />)
    const button = getByTestId('button')

    expect(testMonior.effectTriggered).toHaveBeenCalledTimes(2)
    expect(testPutCount).toBe(1)

    fireEvent.click(button)

    await flushPromiseQueue()

    expect(testMonior.effectTriggered).toHaveBeenCalledTimes(2)
    expect(testPutCount).toBe(1)
  })

  it('supports yield-ing to custom effects with middleware', async () => {
    const testReducer = jest.fn((state = {}, action: any) => {
      return state
    })

    function testSelect(value: object) {
      return makeCustomEffect('TEST_SELECT', {value})
    }

    const testRecorder = jest.fn()

    function* testSaga() {
      const value = yield testSelect({foo: 'bar'})
      testRecorder(value)
    }

    const testSelectMiddleware = (next: any) => (effect: any) => {
      if (effect.type === 'TEST_SELECT') {
        next(effect.payload.value)
        return
      }

      next(effect)
    }

    function TestApp() {
      return (
        <SagaProvider effectMiddlewares={[testSelectMiddleware]}>
          <TestUseSagaReducer />
        </SagaProvider>
      )
    }

    function TestUseSagaReducer() {
      const [,] = useSagaReducer(testSaga, testReducer, {})
      return <div />
    }

    render(<TestApp />)

    expect(testRecorder).toHaveBeenCalledWith({foo: 'bar'})
  })
})
