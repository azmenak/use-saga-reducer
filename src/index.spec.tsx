import * as React from 'react'

import {takeEvery} from 'redux-saga/effects'
import {render, fireEvent} from '@testing-library/react'
import {useSagaReducer} from '.'

function flushPromiseQueue() {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve()
    }, 0)
  })
}

const testCaller = jest.fn()
const testAction = {
  type: 'TEST'
}

function* testSaga() {
  yield takeEvery(testAction.type, testCaller)
}

function testReducer(state = {}) {
  return state
}

function TestUseSagaReducer() {
  const [state, dispatch] = useSagaReducer(testSaga, testReducer)

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

describe('useSagaReducer()', () => {
  it('yields actions taken by `takeEvery`', async () => {
    const {getByTestId} = render(<TestUseSagaReducer />)

    const button = getByTestId('button')

    fireEvent.click(button)
    await flushPromiseQueue()
    expect(testCaller.mock.calls.length).toBe(1)

    fireEvent.click(button)
    await flushPromiseQueue()
    expect(testCaller.mock.calls.length).toBe(2)
  })
})
