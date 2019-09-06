import * as React from 'react'

import {takeEvery, put, select, delay} from 'redux-saga/effects'
import {render, fireEvent, act} from '@testing-library/react'
import {useSagaReducer} from '.'

function flushPromiseQueue() {
  return new Promise((resolve) => {
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

    await act(async () => {})

    expect(el.textContent).toBe('2')
  })
})
