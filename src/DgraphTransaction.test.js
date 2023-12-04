import { enumContentType } from './enumContentType.js'
import { DgraphTransaction } from './DgraphTransaction.js'
import { describe, test, expect, jest } from '@jest/globals'


let fetchMock
const startTs = 9
const timeout = 20
const hash = 'hash'
const apiKey = 'abc'
const method = 'POST'
const mismatchStartTs = 18
const remove = '<abc> * * .'
const array1 = [ 'abc', 'def' ]
const array2 = [ 'abc', 'def', 'ghi', 'jkl' ]
const endpoint = 'https://example.com'
const falsyOptions = [ '', null, undefined ]

const mutation = `
  _:session <dgraph.type> "Abc" .
  _:session <Session.user> <abc> .
`

const query = `
  query {
    users(func: eq(User.email, "chris@gmail.com")) {
      uid
      email: User.email
      firstName: User.firstName
    }
  }
`


/**
 * @param { string } [action]
 * @returns { void }
*/
function setMock(action) {
  fetchMock = jest
    .spyOn(global, 'fetch')
    .mockImplementation(() => assetsFetchMock(action))
}


function clearMock () {
  jest.restoreAllMocks()
}


/**
 * @param { string } [action]
 * @returns { Response }
*/
function assetsFetchMock(action) {
  return Promise.resolve({
    ok: true,
    status: action && Number(action) ? Number(action) : 200,
    json: async () => ({
      extensions: {
        txn: {
          hash,
          keys: action === 'two' ? array2 : array1,
          preds: action === 'two' ? array2 : array1,
          start_ts: action === 'mismatch' ? mismatchStartTs : startTs,
        }
      }
    })
  })
}


describe('DgraphTransaction', () => {
  describe('throws if', () => {
    test('params is falsy', () => {
      for (const params of falsyOptions) {
        try {
          new DgraphTransaction(params)
        } catch (e) {
          expect(e).toEqual({ id: 'fln__dgraph__missing-params', message: 'Transaction constructor needs a params object', _errorData: { params } })
        }
      }
    })

    test('params.apiKey is falsy', () => {
      for (const apiKey of falsyOptions) {
        try {
          new DgraphTransaction({ apiKey })
        } catch (e) {
          expect(e).toEqual({ id: 'fln__dgraph__missing-apiKey', message: 'Transaction constructor needs an apiKey', _errorData: { apiKey } })
        }
      }
    })

    test('params.endpoint is falsy', () => {
      for (const endpoint of falsyOptions) {
        try {
          new DgraphTransaction({ apiKey: 'apiKey', endpoint })
        } catch (e) {
          expect(e).toEqual({ id: 'fln__dgraph__missing-endpoint', message: 'Transaction constructor needs an endpoint', _errorData: { endpoint } })
        }
      }
    })
  })


  describe('.query()', () => {
    beforeEach(() => {
      setMock()
    })

    afterEach(() => {
      clearMock()
    })

    describe('throws if', () => {
      test('api call has a response status less then 200', async () => {
        const status = 199
        const transaction = new DgraphTransaction({ apiKey, endpoint, timeout, readOnly: true, bestEffort: true })
        await transaction.query(false, query)

        expect(fetchMock).toHaveBeenCalled()
        expect(fetchMock).toHaveBeenCalledWith(`${ endpoint }/query?timeout=${ timeout }s&ro=true&be=true`, { body: query, headers: { 'Content-Type': enumContentType.dql, 'X-Auth-Token': apiKey }, method })

        clearMock()
        setMock(String(status))

        try {
          await transaction.query(false, query)
        } catch (e) {
          expect(e.status).toEqual(status)
        }
      })

      test('api call has a response status is >= 300', async () => {
        const status = 300
        const transaction = new DgraphTransaction({ apiKey, endpoint, timeout, readOnly: true, bestEffort: true })
        await transaction.query(false, query)

        expect(fetchMock).toHaveBeenCalled()
        expect(fetchMock).toHaveBeenCalledWith(`${ endpoint }/query?timeout=${ timeout }s&ro=true&be=true`, { body: query, headers: { 'Content-Type': enumContentType.dql, 'X-Auth-Token': apiKey }, method })

        clearMock()
        setMock(String(status))

        try {
          await transaction.query(false, query)
        } catch (e) {
          expect(e.status).toEqual(status)
        }
      })

      test('api call has a start_ts mismatch', async () => {
        const transaction = new DgraphTransaction({ apiKey, endpoint, timeout, readOnly: true, bestEffort: true })
        await transaction.query(false, query)

        expect(fetchMock).toHaveBeenCalled()
        expect(fetchMock).toHaveBeenCalledWith(`${ endpoint }/query?timeout=${ timeout }s&ro=true&be=true`, { body: query, headers: { 'Content-Type': enumContentType.dql, 'X-Auth-Token': apiKey }, method })

        clearMock()
        setMock('mismatch')

        try {
          await transaction.query(false, query)
        } catch (e) {
          expect(e).toEqual({ id: 'fln__dgraph__start-ts-mismatch', message: 'The start_ts on the last request does not match the start_ts in the transaction', _errorData: { transactionStartTs: startTs, responseStartTs: mismatchStartTs } })
        }
      })
      test('called after aborted', async () => {
        const transaction = new DgraphTransaction({ apiKey, endpoint, timeout, readOnly: true, bestEffort: true })
        await transaction.query(false, query)

        expect(fetchMock).toHaveBeenCalled()
        expect(fetchMock).toHaveBeenCalledWith(`${ endpoint }/query?timeout=${ timeout }s&ro=true&be=true`, { body: query, headers: { 'Content-Type': enumContentType.dql, 'X-Auth-Token': apiKey }, method })

        clearMock()
        setMock()

        await transaction.abort()

        try {
          await transaction.query(false, query)
        } catch (e) {
          expect(e).toEqual({ id: 'fln__dgraph__already-aborted', message: 'Transaction already aborted', _errorData: { query } })
        }
      })

      test('called after committed', async () => {
        const transaction = new DgraphTransaction({ apiKey, endpoint, timeout, readOnly: true, bestEffort: true })
        await transaction.query(false, query)

        expect(fetchMock).toHaveBeenCalled()
        expect(fetchMock).toHaveBeenCalledWith(`${ endpoint }/query?timeout=${ timeout }s&ro=true&be=true`, { body: query, headers: { 'Content-Type': enumContentType.dql, 'X-Auth-Token': apiKey }, method })

        clearMock()
        setMock()

        await transaction.commit()

        try {
          await transaction.query(false, query)
        } catch (e) {
          expect(e).toEqual({ id: 'fln__dgraph__already-commited', message: 'Transaction already commited', _errorData: { query } })
        }
      })

      test('called after closed', async () => {
        const transaction = new DgraphTransaction({ apiKey, endpoint, timeout, readOnly: true, bestEffort: true })
        await transaction.query(true, query)

        expect(fetchMock).toHaveBeenCalled()
        expect(fetchMock).toHaveBeenCalledWith(`${ endpoint }/query?timeout=${ timeout }s&ro=true&be=true`, { body: query, headers: { 'Content-Type': enumContentType.dql, 'X-Auth-Token': apiKey }, method })

        clearMock()
        setMock()

        try {
          await transaction.query(true, query)
        } catch (e) {
          expect(e).toEqual({ id: 'fln__dgraph__already-closed', message: 'Transaction already closed', _errorData: { query } })
        }
      })
    })

    describe('does the proper fetch when', () => {
      test('timeout is not set, readOnly is not set and bestEffort is not set', () => {
        const transaction = new DgraphTransaction({ apiKey, endpoint })

        transaction.query(true, query)
        expect(fetchMock).toHaveBeenCalled()
        expect(fetchMock).toHaveBeenCalledWith(`${ endpoint }/query?timeout=600s`, { body: query, headers: { 'Content-Type': enumContentType.dql, 'X-Auth-Token': apiKey }, method })
      })

      test('timeout is set, readOnly is not set and bestEffort is not set', () => {
        const transaction = new DgraphTransaction({ apiKey, endpoint, timeout })
        transaction.query(true, query)

        expect(fetchMock).toHaveBeenCalled()
        expect(fetchMock).toHaveBeenCalledWith(`${ endpoint }/query?timeout=${ timeout }s`, { body: query, headers: { 'Content-Type': enumContentType.dql, 'X-Auth-Token': apiKey }, method })
      })

      test('timeout is set, readOnly is set and bestEffort is not set', () => {
        const transaction = new DgraphTransaction({ apiKey, endpoint, timeout, readOnly: true })
        transaction.query(true, query)

        expect(fetchMock).toHaveBeenCalled()
        expect(fetchMock).toHaveBeenCalledWith(`${ endpoint }/query?timeout=${ timeout }s&ro=true`, { body: query, headers: { 'Content-Type': enumContentType.dql, 'X-Auth-Token': apiKey }, method })
      })

      test('timeout is set, readOnly is set and bestEffort is set', () => {
        const transaction = new DgraphTransaction({ apiKey, endpoint, timeout, readOnly: true, bestEffort: true })
        transaction.query(true, query)

        expect(fetchMock).toHaveBeenCalled()
        expect(fetchMock).toHaveBeenCalledWith(`${ endpoint }/query?timeout=${ timeout }s&ro=true&be=true`, { body: query, headers: { 'Content-Type': enumContentType.dql, 'X-Auth-Token': apiKey }, method })
      })

      test('hash is set, startTs is set, timeout is set, readOnly is set and bestEffort is set', async () => {
        const transaction = new DgraphTransaction({ apiKey, endpoint, timeout, readOnly: true, bestEffort: true })
        await transaction.query(false, query)

        expect(fetchMock).toHaveBeenCalled()
        expect(fetchMock).toHaveBeenCalledWith(`${ endpoint }/query?timeout=${ timeout }s&ro=true&be=true`, { body: query, headers: { 'Content-Type': enumContentType.dql, 'X-Auth-Token': apiKey }, method })

        clearMock()
        setMock()

        await transaction.query(true, query)
        expect(fetchMock).toHaveBeenCalled()
        expect(fetchMock).toHaveBeenCalledWith(`${ endpoint }/query?startTs=${ startTs }&hash=${ hash }&timeout=${ timeout }s&ro=true&be=true`, { body: query, headers: { 'Content-Type': enumContentType.dql, 'X-Auth-Token': apiKey }, method })
      })
    })
  })


  describe('.mutate()', () => {
    beforeEach(() => {
      setMock()
    })

    afterEach(() => {
      clearMock()
    })

    describe('throws if', () => {
      test('api call has a response status less then 200', async () => {
        const status = 199
        const transaction = new DgraphTransaction({ apiKey, endpoint })
        await transaction.mutate({ mutation })

        expect(fetchMock).toHaveBeenCalled()
        expect(fetchMock).toHaveBeenCalledWith(`${ endpoint }/mutate`, { body: `{ set { ${ mutation } } }`, headers: { 'Content-Type': enumContentType.rdf, 'X-Auth-Token': apiKey }, method })

        clearMock()
        setMock(String(status))

        try {
          await transaction.mutate({ mutation })
        } catch (e) {
          expect(e.status).toEqual(status)
        }
      })

      test('api call has a response status is >= 300', async () => {
        const status = 300
        const transaction = new DgraphTransaction({ apiKey, endpoint, timeout })
        await transaction.mutate({ remove })

        expect(fetchMock).toHaveBeenCalled()
        expect(fetchMock).toHaveBeenCalledWith(`${ endpoint }/mutate`, { body: `{ delete { ${ remove } } }`, headers: { 'Content-Type': enumContentType.rdf, 'X-Auth-Token': apiKey }, method })

        clearMock()
        setMock(String(status))

        try {
          await transaction.mutate({ remove })
        } catch (e) {
          expect(e.status).toEqual(status)
        }
      })

      test('api call has a start_ts mismatch', async () => {
        const transaction = new DgraphTransaction({ apiKey, endpoint, timeout })
        await transaction.mutate({ remove })

        expect(fetchMock).toHaveBeenCalled()
        expect(fetchMock).toHaveBeenCalledWith(`${endpoint}/mutate`, { body: `{ delete { ${remove} } }`, headers: { 'Content-Type': enumContentType.rdf, 'X-Auth-Token': apiKey }, method })

        clearMock()
        setMock('mismatch')

        try {
          await transaction.mutate({ mutation })
        } catch (e) {
          expect(e).toEqual({ id: 'fln__dgraph__start-ts-mismatch', message: 'The start_ts on the last request does not match the start_ts in the transaction', _errorData: { transactionStartTs: startTs, responseStartTs: mismatchStartTs } })
        }
      })

      test('params is falsy', async () => {
        for (const params of falsyOptions) {
          try {
            const transaction = new DgraphTransaction({ apiKey, endpoint })
            await transaction.mutate(params)
          } catch (e) {
            expect(e).toEqual({ id: 'fln__dgraph__missing-params', message: 'Mutate function needs a params object', _errorData: { params } })
          }
        }
      })

      test('mutation and remove is falsy', async () => {
        for (const value of falsyOptions) {
          try {
            const transaction = new DgraphTransaction({ apiKey, endpoint })
            await transaction.mutate({ mutation: value, remove: value })
          } catch (e) {
            expect(e).toEqual({ id: 'fln__dgraph__empty-mutate', message: 'Mutate function requires a mutation or remove string', _errorData: { mutation: value, remove: value } })
          }
        }
      })

      test('mutation and remove is truthy', async () => {
        try {
          const transaction = new DgraphTransaction({ apiKey, endpoint })
          await transaction.mutate({ mutation, remove })
        } catch (e) {
          expect(e).toEqual({ id: 'fln__dgraph__full-mutate', message: 'Mutate function requires only a mutation or a remove string but not both' })
        }
      })

      test('called after aborted', async () => {
        const transaction = new DgraphTransaction({ apiKey, endpoint })
        await transaction.mutate({ mutation })

        expect(fetchMock).toHaveBeenCalled()
        expect(fetchMock).toHaveBeenCalledWith(`${ endpoint }/mutate`, { body: `{ set { ${ mutation } } }`, headers: { 'Content-Type': enumContentType.rdf, 'X-Auth-Token': apiKey }, method })

        clearMock()
        setMock()

        await transaction.abort()

        try {
          await transaction.mutate({ mutation })
        } catch (e) {
          expect(e).toEqual({ id: 'fln__dgraph__already-aborted', message: 'Transaction already aborted', _errorData: { mutation, remove: undefined } })
        }
      })

      test('called after aborted', async () => {
        const transaction = new DgraphTransaction({ apiKey, endpoint })
        await transaction.mutate({ mutation })

        expect(fetchMock).toHaveBeenCalled()
        expect(fetchMock).toHaveBeenCalledWith(`${ endpoint }/mutate`, { body: `{ set { ${ mutation } } }`, headers: { 'Content-Type': enumContentType.rdf, 'X-Auth-Token': apiKey }, method })

        clearMock()
        setMock()

        await transaction.abort()

        try {
          await transaction.mutate({ mutation })
        } catch (e) {
          expect(e).toEqual({ id: 'fln__dgraph__already-aborted', message: 'Transaction already aborted', _errorData: { mutation, remove: undefined } })
        }
      })

      test('called after committed via .commit()', async () => {
        const transaction = new DgraphTransaction({ apiKey, endpoint })
        await transaction.mutate({ mutation })

        expect(fetchMock).toHaveBeenCalled()
        expect(fetchMock).toHaveBeenCalledWith(`${ endpoint }/mutate`, { body: `{ set { ${ mutation } } }`, headers: { 'Content-Type': enumContentType.rdf, 'X-Auth-Token': apiKey }, method })

        clearMock()
        setMock()

        await transaction.commit()

        try {
          await transaction.mutate({ mutation })
        } catch (e) {
          expect(e).toEqual({ id: 'fln__dgraph__already-commited', message: 'Transaction already commited', _errorData: { mutation, remove: undefined } })
        }
      })

      test('called after committed via { commitNow: true }', async () => {
        const transaction = new DgraphTransaction({ apiKey, endpoint })
        await transaction.mutate({ mutation, commitNow: true })

        expect(fetchMock).toHaveBeenCalled()
        expect(fetchMock).toHaveBeenCalledWith(`${ endpoint }/mutate?commitNow=true`, { body: `{ set { ${ mutation } } }`, headers: { 'Content-Type': enumContentType.rdf, 'X-Auth-Token': apiKey }, method })

        clearMock()
        setMock()

        try {
          await transaction.mutate({ mutation })
        } catch (e) {
          expect(e).toEqual({ id: 'fln__dgraph__already-commited', message: 'Transaction already commited', _errorData: { mutation, remove: undefined } })
        }
      })

      test('called after closed', async () => {
        const transaction = new DgraphTransaction({ apiKey, endpoint, timeout })
        await transaction.query(true, query)

        expect(fetchMock).toHaveBeenCalled()
        expect(fetchMock).toHaveBeenCalledWith(`${ endpoint }/query?timeout=${ timeout }s`, { body: query, headers: { 'Content-Type': 'application/dql', 'X-Auth-Token': apiKey }, method })

        clearMock()
        setMock()

        try {
          await transaction.mutate({ mutation })
        } catch (e) {
          expect(e).toEqual({ id: 'fln__dgraph__already-closed', message: 'Transaction already closed', _errorData: { mutation, remove: undefined, commitNow: undefined } })
        }
      })

      test('called when readOnly is true', async () => {
        const transaction = new DgraphTransaction({ apiKey, endpoint, timeout, readOnly: true })
        await transaction.query(false, query)

        expect(fetchMock).toHaveBeenCalled()
        expect(fetchMock).toHaveBeenCalledWith(`${ endpoint }/query?timeout=${ timeout }s&ro=true`, { body: query, headers: { 'Content-Type': 'application/dql', 'X-Auth-Token': apiKey }, method })

        clearMock()
        setMock()

        try {
          await transaction.mutate({ mutation })
        } catch (e) {
          expect(e).toEqual({ id: 'fln__dgraph__readonly-mutation', message: 'Readonly transactions may not contain mutations', _errorData: { mutation, remove: undefined, commitNow: undefined } })
        }
      })
    })

    describe('does the proper fetch when', () => {
      test('mutation is set', async () => {
        const transaction = new DgraphTransaction({ apiKey, endpoint })
        await transaction.mutate({ mutation })

        expect(fetchMock).toHaveBeenCalled()
        expect(fetchMock).toHaveBeenCalledWith(`${ endpoint }/mutate`, { body: `{ set { ${ mutation } } }`, headers: { 'Content-Type': enumContentType.rdf, 'X-Auth-Token': apiKey }, method })
      })

      test('mutation is set and commitNow is set', async () => {
        const transaction = new DgraphTransaction({ apiKey, endpoint })
        await transaction.mutate({ mutation, commitNow: true })

        expect(fetchMock).toHaveBeenCalled()
        expect(fetchMock).toHaveBeenCalledWith(`${ endpoint }/mutate?commitNow=true`, { body: `{ set { ${ mutation } } }`, headers: { 'Content-Type': enumContentType.rdf, 'X-Auth-Token': apiKey }, method })
      })

      test('hash is set, startTs is set and mutation is set', async () => {
        const transaction = new DgraphTransaction({ apiKey, endpoint })
        await transaction.mutate({ mutation })

        expect(fetchMock).toHaveBeenCalled()
        expect(fetchMock).toHaveBeenCalledWith(`${ endpoint }/mutate`, { body: `{ set { ${ mutation } } }`, headers: { 'Content-Type': enumContentType.rdf, 'X-Auth-Token': apiKey }, method })

        clearMock()
        setMock()

        await transaction.mutate({ mutation })
        expect(fetchMock).toHaveBeenCalled()
        expect(fetchMock).toHaveBeenCalledWith(`${ endpoint }/mutate?startTs=${ startTs }&hash=${ hash }`, { body: `{ set { ${ mutation } } }`, headers: { 'Content-Type': enumContentType.rdf, 'X-Auth-Token': apiKey }, method })
      })

      test('remove is set', async () => {
        const transaction = new DgraphTransaction({ apiKey, endpoint })
        await transaction.mutate({ remove })

        expect(fetchMock).toHaveBeenCalled()
        expect(fetchMock).toHaveBeenCalledWith(`${ endpoint }/mutate`, { body: `{ delete { ${ remove } } }`, headers: { 'Content-Type': enumContentType.rdf, 'X-Auth-Token': apiKey }, method })
      })

      test('remove is set and commitNow is set', async () => {
        const transaction = new DgraphTransaction({ apiKey, endpoint })
        await transaction.mutate({ remove, commitNow: true })

        expect(fetchMock).toHaveBeenCalled()
        expect(fetchMock).toHaveBeenCalledWith(`${ endpoint }/mutate?commitNow=true`, { body: `{ delete { ${ remove } } }`, headers: { 'Content-Type': enumContentType.rdf, 'X-Auth-Token': apiKey }, method })
      })

      test('hash is set, startTs is set and remove is set', async () => {
        const transaction = new DgraphTransaction({ apiKey, endpoint })
        await transaction.mutate({ remove })

        expect(fetchMock).toHaveBeenCalled()
        expect(fetchMock).toHaveBeenCalledWith(`${ endpoint }/mutate`, { body: `{ delete { ${ remove } } }`, headers: { 'Content-Type': enumContentType.rdf, 'X-Auth-Token': apiKey }, method })

        clearMock()
        setMock()

        await transaction.mutate({ remove })
        expect(fetchMock).toHaveBeenCalled()
        expect(fetchMock).toHaveBeenCalledWith(`${ endpoint }/mutate?startTs=${ startTs }&hash=${ hash }`, { body: `{ delete { ${ remove } } }`, headers: { 'Content-Type': enumContentType.rdf, 'X-Auth-Token': apiKey }, method })
      })
    })
  })


  describe('.commit()', () => {
    beforeEach(() => {
      setMock()
    })

    afterEach(() => {
      clearMock()
    })

    describe('throws if', () => {
      test('api call has a response status less then 200', async () => {
        const status = 199
        const transaction = new DgraphTransaction({ apiKey, endpoint })
        await transaction.mutate({ mutation })

        expect(fetchMock).toHaveBeenCalled()
        expect(fetchMock).toHaveBeenCalledWith(`${ endpoint }/mutate`, { body: `{ set { ${ mutation } } }`, headers: { 'Content-Type': enumContentType.rdf, 'X-Auth-Token': apiKey }, method })

        clearMock()
        setMock(String(status))

        try {
          await transaction.commit()
        } catch (e) {
          expect(e.status).toEqual(status)
        }
      })

      test('api call has a response status is >= 300', async () => {
        const status = 300
        const transaction = new DgraphTransaction({ apiKey, endpoint, timeout })
        await transaction.mutate({ remove })

        expect(fetchMock).toHaveBeenCalled()
        expect(fetchMock).toHaveBeenCalledWith(`${ endpoint }/mutate`, { body: `{ delete { ${ remove } } }`, headers: { 'Content-Type': enumContentType.rdf, 'X-Auth-Token': apiKey }, method })

        clearMock()
        setMock(String(status))

        try {
          await transaction.commit()
        } catch (e) {
          expect(e.status).toEqual(status)
        }
      })

      test('called after aborted', async () => {
        const transaction = new DgraphTransaction({ apiKey, endpoint })
        await transaction.mutate({ mutation })

        expect(fetchMock).toHaveBeenCalled()
        expect(fetchMock).toHaveBeenCalledWith(`${ endpoint }/mutate`, { body: `{ set { ${ mutation } } }`, headers: { 'Content-Type': enumContentType.rdf, 'X-Auth-Token': apiKey }, method })

        clearMock()
        setMock()

        await transaction.abort()

        try {
          await transaction.commit()
        } catch (e) {
          expect(e).toEqual({ id: 'fln__dgraph__already-aborted', message: 'Transaction already aborted' })
        }
      })

      test('called after committed via commitNow', async () => {
        const transaction = new DgraphTransaction({ apiKey, endpoint })
        await transaction.mutate({ mutation, commitNow: true })

        expect(fetchMock).toHaveBeenCalled()
        expect(fetchMock).toHaveBeenCalledWith(`${ endpoint }/mutate?commitNow=true`, { body: `{ set { ${ mutation } } }`, headers: { 'Content-Type': enumContentType.rdf, 'X-Auth-Token': apiKey }, method })

        clearMock()
        setMock()

        try {
          await transaction.commit()
        } catch (e) {
          expect(e).toEqual({ id: 'fln__dgraph__already-commited', message: 'Transaction already commited' })
        }
      })

      test('called after committed via .commit()', async () => {
        const transaction = new DgraphTransaction({ apiKey, endpoint })
        await transaction.mutate({ mutation })

        expect(fetchMock).toHaveBeenCalled()
        expect(fetchMock).toHaveBeenCalledWith(`${ endpoint }/mutate`, { body: `{ set { ${ mutation } } }`, headers: { 'Content-Type': enumContentType.rdf, 'X-Auth-Token': apiKey }, method })

        clearMock()
        setMock()

        await transaction.commit()

        try {
          await transaction.commit()
        } catch (e) {
          expect(e).toEqual({ id: 'fln__dgraph__already-commited', message: 'Transaction already commited' })
        }
      })

      test('called after closed', async () => {
        const transaction = new DgraphTransaction({ apiKey, endpoint, timeout })
        await transaction.query(true, query)

        expect(fetchMock).toHaveBeenCalled()
        expect(fetchMock).toHaveBeenCalledWith(`${ endpoint }/query?timeout=${ timeout }s`, { body: query, headers: { 'Content-Type': 'application/dql', 'X-Auth-Token': apiKey }, method })

        clearMock()
        setMock()

        try {
          await transaction.commit()
        } catch (e) {
          expect(e).toEqual({ id: 'fln__dgraph__already-closed', message: 'Transaction already closed' })
        }
      })
    })

    test('does the proper fetch when the transaction has done a mutation', async () => {
      const transaction = new DgraphTransaction({ apiKey, endpoint })
      await transaction.mutate({ mutation })

      expect(fetchMock).toHaveBeenCalled()
      expect(fetchMock).toHaveBeenCalledWith(`${ endpoint }/mutate`, { body: `{ set { ${ mutation } } }`, headers: { 'Content-Type': enumContentType.rdf, 'X-Auth-Token': apiKey }, method })

      clearMock()
      setMock('two')

      await transaction.commit()
      expect(fetchMock).toHaveBeenCalled()
      expect(fetchMock).toHaveBeenCalledWith(`${ endpoint }/commit?startTs=${ startTs }&hash=${ hash }`, { body: JSON.stringify({ keys: array1, preds: array1 }), headers: { 'Content-Type': enumContentType.json, 'X-Auth-Token': apiKey }, method })
    })

    test('does no fetch when the transaction has only done a query', async () => {
      const transaction = new DgraphTransaction({ apiKey, endpoint })
      await transaction.commit()
      expect(fetchMock).not.toHaveBeenCalled()
    })

    test('does no fetch when the transaction has only done a query', async () => {
      const transaction = new DgraphTransaction({ apiKey, endpoint })
      await transaction.query(false, query)

      clearMock()
      setMock()

      await transaction.commit()
      expect(fetchMock).not.toHaveBeenCalled()
    })

    test('one mutations happen', async () => {
      const transaction = new DgraphTransaction({ apiKey, endpoint })
      await transaction.mutate({ remove })

      expect(fetchMock).toHaveBeenCalled()
      expect(fetchMock).toHaveBeenCalledWith(`${endpoint}/mutate`, { body: `{ delete { ${remove} } }`, headers: { 'Content-Type': enumContentType.rdf, 'X-Auth-Token': apiKey }, method })

      clearMock()
      setMock('two')

      await transaction.commit()
      expect(fetchMock).toHaveBeenCalled()
      expect(fetchMock).toHaveBeenCalledWith(`${endpoint}/commit?startTs=${startTs}&hash=${hash}`, { 'body': JSON.stringify({ keys: array1, preds: array1 }), 'headers': { 'Content-Type': enumContentType.json, 'X-Auth-Token': apiKey }, method })
    })
    test('multiple mutations happen', async () => {
      const transaction = new DgraphTransaction({ apiKey, endpoint })
      await transaction.mutate({ remove })

      expect(fetchMock).toHaveBeenCalled()
      expect(fetchMock).toHaveBeenCalledWith(`${ endpoint }/mutate`, { body: `{ delete { ${ remove } } }`, headers: { 'Content-Type': enumContentType.rdf, 'X-Auth-Token': apiKey }, method })

      clearMock()
      setMock('two')

      await transaction.mutate({ remove })
      expect(fetchMock).toHaveBeenCalled()
      expect(fetchMock).toHaveBeenCalledWith(`${ endpoint }/mutate?startTs=${ startTs }&hash=${ hash }`, { body: `{ delete { ${ remove } } }`, headers: { 'Content-Type': enumContentType.rdf, 'X-Auth-Token': apiKey }, method })
    
      clearMock()
      setMock('two')

      await transaction.commit()
      expect(fetchMock).toHaveBeenCalled()
      expect(fetchMock).toHaveBeenCalledWith(`${ endpoint }/commit?startTs=${ startTs }&hash=${ hash }`, {'body': JSON.stringify({ keys: array2, preds: array2 }), 'headers': {'Content-Type': enumContentType.json, 'X-Auth-Token': apiKey }, method })
    })
  })


  describe('.abort()', () => {
    beforeEach(() => {
      setMock()
    })

    afterEach(() => {
      clearMock()
    })

    test('throws if api call has a response status less then 200', async () => {
      const status = 199
      const transaction = new DgraphTransaction({ apiKey, endpoint })
      await transaction.mutate({ mutation })

      expect(fetchMock).toHaveBeenCalled()
      expect(fetchMock).toHaveBeenCalledWith(`${ endpoint }/mutate`, { body: `{ set { ${ mutation } } }`, headers: { 'Content-Type': enumContentType.rdf, 'X-Auth-Token': apiKey }, method })

      clearMock()
      setMock(String(status))

      try {
        await transaction.abort()
      } catch (e) {
        expect(e.status).toEqual(status)
      }
    })

    test('throws if api call has a response status is >= 300', async () => {
      const status = 300
      const transaction = new DgraphTransaction({ apiKey, endpoint, timeout })
      await transaction.mutate({ remove })

      expect(fetchMock).toHaveBeenCalled()
      expect(fetchMock).toHaveBeenCalledWith(`${ endpoint }/mutate`, { body: `{ delete { ${ remove } } }`, headers: { 'Content-Type': enumContentType.rdf, 'X-Auth-Token': apiKey }, method })

      clearMock()
      setMock(String(status))

      try {
        await transaction.abort()
      } catch (e) {
        expect(e.status).toEqual(status)
      }
    })

    test('does the proper fetch when the transaction has done a mutation and has not been aborted', async () => {
      const transaction = new DgraphTransaction({ apiKey, endpoint })
      await transaction.mutate({ mutation })

      expect(fetchMock).toHaveBeenCalled()
      expect(fetchMock).toHaveBeenCalledWith(`${ endpoint }/mutate`, { body: `{ set { ${ mutation } } }`, headers: { 'Content-Type': enumContentType.rdf, 'X-Auth-Token': apiKey }, method })

      clearMock()
      setMock('two')

      await transaction.abort()
      expect(fetchMock).toHaveBeenCalled()
      expect(fetchMock).toHaveBeenCalledWith(`${ endpoint }/commit?startTs=${ startTs }&hash=${ hash }&abort=true`, { headers: { 'X-Auth-Token': apiKey }, method })
    })

    test('does no fetch when the transaction has aborted', async () => {
      const transaction = new DgraphTransaction({ apiKey, endpoint })
      await transaction.abort()
      await transaction.abort()
      expect(fetchMock).not.toHaveBeenCalled()
    })

    test('does no fetch when the transaction has only done a query', async () => {
      const transaction = new DgraphTransaction({ apiKey, endpoint })
      await transaction.query(false, query)

      clearMock()
      setMock()

      await transaction.abort()
      expect(fetchMock).not.toHaveBeenCalled()
    })
  })
})
