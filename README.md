# use-saga-reducer

![npm](https://img.shields.io/npm/v/use-saga-reducer.svg)
[![codecov](https://codecov.io/gh/azmenak/use-saga-reducer/branch/master/graph/badge.svg)](https://codecov.io/gh/azmenak/use-saga-reducer)
[![Build Status](https://travis-ci.org/azmenak/use-saga-reducer.svg?branch=master)](https://travis-ci.org/azmenak/use-saga-reducer)
![NPM](https://img.shields.io/npm/l/use-saga-reducer.svg)

Use sagas without redux! This library provides an abstraction over Redux Saga's
[External API](https://redux-saga.js.org/docs/api/index.html#external-api).

## Install

```
npm install use-saga-reducer
```

## Usage

```tsx
import useSagaReducer from 'use-saga-reducer'
import {takeLatest, call, put} from 'redux-saga/effects'

function* dataFetcher() {
  try {
    const data = yield call(API.fetchData)
    yield put({type: 'FETCH_SUCCESS', payload: data})
  } catch (error) {
    yield put({type: 'FETCH_ERROR'})
  }
}

function* dataFetchingSaga() {
  yield takeLatest('FETCH', dataFetcher)
}

function reducer(state = {}, action) {
  if (action.type === 'FETCH_SUCCESS') {
    return action.payload
  }

  return state
}

const DataFetchingComponent: React.FC = () => {
  const [state, dispatch] = useSagaReducer(dataFetchingSaga, reducer)

  return (
    <>
      <pre>{state}</pre>
      <button onClick={() => dispatch({type: 'FETCH'})}>Fetch Data</button>
    </>
  )
}
```
