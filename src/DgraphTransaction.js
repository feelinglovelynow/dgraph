import { enumContentType } from './enumContentType.js'


/**
 * Creates a transaction object with lots of features to ease workflow with [dgraph cloud instances](https://dgraph.io/product). Guidance came from [here](https://dgraph.io/docs/dql/clients/raw-http/).
 * @param { import('./typedefs.js').DgraphTransactionConstructor } params
 */
export function DgraphTransaction ({ apiKey, endpoint, readOnly, bestEffort, timeout }) {
  if (!apiKey) throw { id: 'fln__dgraph__missing-apiKey', message: 'Transaction constructor needs an apiKey', _errorData: { apiKey } }
  if (!endpoint) throw { id: 'fln__dgraph__missing-endpoint', message: 'Transaction constructor needs an endpoint', _errorData: { endpoint } }


  /** @type { string[] } */
  let keys
  /** @type { string[] } */
  let preds
  /** @type { string } */
  let hash
  /** @type { number } */
  let startTs = 0
  /** @type { boolean } */
  let isAborted
  /** @type { boolean } */
  let isClosed = false
  /** @type { boolean } */
  let isCommited = false
  /** @type { boolean } */
  let didMutations = false


  if (!timeout) timeout = 600
  if (!readOnly) readOnly = false


  /**
   * Query dgraph cloud instance. Only accepts DQL syntax. IF closeWhenDone is set to true the transaction will not be allowed to be used again (does not send a request to dgraph cloud instance, just sets this.isClosed to true)
   * @param { boolean } closeWhenDone - IF closeWhenDone is set to true the transaction will not be allowed to be used again (does not send a request to dgraph cloud instance, just sets this.isClosed to true)
   * @param { string } query - Only accepts DQL syntax.
   * @returns { Promise<import('./typedefs.js').DgraphResponse> }
  */
  this.query = async function  (closeWhenDone, query) {
    if (isAborted) throw { id: 'fln__dgraph__already-aborted', message: 'Transaction already aborted', _errorData: { query } }
    else if (isCommited) throw { id: 'fln__dgraph__already-commited', message: 'Transaction already commited', _errorData: { query } }
    else if (isClosed) throw { id: 'fln__dgraph__already-closed', message: 'Transaction already closed', _errorData: { query } }
    else {
      const searchParams = new URLSearchParams()

      if (hash) searchParams.set('hash', hash)
      if (startTs !== 0) searchParams.set('startTs', String(startTs))
      if (Number(timeout) > 0) searchParams.set('timeout', String(timeout) + 's')
      if (readOnly) searchParams.set('ro', 'true')
      if (bestEffort) searchParams.set('be', 'true')

      const searchParamsStr = searchParams.toString()
      const path = searchParamsStr ? `query?${ searchParamsStr }` : 'query'
      const r = await api({ path, body: query, contentType: enumContentType.dql, abort: this.abort })

      if (closeWhenDone) isClosed = true
      else if (r?.extensions?.txn) syncResponseExtensions(r.extensions.txn)

      return r
    } 
  }


  /**
   * Mutate dgraph cloud instance. Only accepts `rdf` triples syntax. If `commitNow` is true we send query param to dgraph cloud instance in this mutation api call that this is the last query or mutation coming from this transation   * @param { import('./typedefs.js').DgraphMutationOptions } dgraphMutationOptions
   * @returns { Promise<import('./typedefs.js').DgraphResponse> }
  */
  this.mutate = async function ({ mutation, remove, commitNow }) {
    if (!mutation && !remove) throw { id: 'fln__dgraph__empty-mutate', message: 'Mutate function requires a mutation or remove string' }
    else if (mutation && remove) throw { id: 'fln__dgraph__full-mutate', message: 'Mutate function requires only a mutation or a remove string but not both' }
    else if (isAborted) throw { id: 'fln__dgraph__already-aborted', message: 'Transaction already aborted', _errorData: { mutation, remove, commitNow } }
    else if (isCommited) throw { id: 'fln__dgraph__already-commited', message: 'Transaction already commited', _errorData: { mutation, remove, commitNow } }
    else if (isClosed) throw { id: 'fln__dgraph__already-closed', message: 'Transaction already closed', _errorData: { mutation, remove, commitNow } }
    else if (readOnly) throw { id: 'fln__dgraph__readonly-mutation', message: 'Readonly transactions may not contain mutations', _errorData: { mutation, remove, commitNow } }
    else {
      didMutations = true

      const body = mutation ? `{ set { ${ mutation } } }` : `{ delete { ${ remove } } }`

      const searchParams = new URLSearchParams()
      if (commitNow) searchParams.set('commitNow', 'true')
      if (hash) searchParams.set('hash', String(hash))
      if (startTs) searchParams.set('startTs', String(startTs))

      const searchParamsStr = searchParams.toString()
      const path = searchParamsStr ? `mutate?${ searchParamsStr }` : 'mutate'
      const r = await api({ path, body, contentType: enumContentType.rdf, abort: this.abort })

      if (commitNow) isCommited = true
      else if (r?.extensions?.txn) syncResponseExtensions(r.extensions.txn)

      return r
    }
  }


  /**
   * Commit all mutations that have been done with this transaction. IF transaction has done any mutations => send an api call to dgraph cloud instance to let it know no more incoming actions will be coming from this transaction and to `commit` all that has been done by this transaction. IF transaction has done no mutations => set `this.isCommited` to true so no further queries or mutations may happen with transaction.
   * @returns { Promise<void | import('./typedefs.js').DgraphResponse> }
  */  
  this.commit = async function () {
    if (isAborted) throw { id: 'fln__dgraph__already-aborted', message: 'Transaction already aborted' }
    else if (isCommited) throw { id: 'fln__dgraph__already-commited', message: 'Transaction already commited' }
    else if (isClosed) throw { id: 'fln__dgraph__already-closed', message: 'Transaction already closed' }
    else {
      isCommited = true

      if (didMutations) { // IF transaction did mutations => api call to "/commit" happens
        const body = JSON.stringify(keys)

        const searchParams = new URLSearchParams()
        searchParams.set('startTs', String(startTs))
        if (hash) searchParams.set('hash', hash)

        const path = 'commit?' + searchParams.toString()

        return await api({ path, body, contentType: enumContentType.json, abort: this.abort })
      }
    }
  }


  /**
   * Abort all mutations that have been done with this transaction. IF transaction has done any mutations => send an api call to dgraph cloud instance to let it know no more incoming actions will be coming from this transaction and to `rollback` all that has been done by this transaction. IF transaction has done no mutations => set `this.aborted` to true so no further queries or mutations may happen with transaction.
   * @returns { Promise<void | import('./typedefs.js').DgraphResponse> }
  */
  this.abort = async function () {
    if (!isAborted) {
      isAborted = true

      if (didMutations) { // IF transaction did mutations => api call to "/commit?abort=true" happens
        const searchParams = new URLSearchParams()
        searchParams.set('startTs', String(startTs))
        searchParams.set('abort', 'true')
        if (hash) searchParams.set('hash', hash)

        const path = 'commit?' + searchParams.toString()

        return await api({ path, abort: this.abort })
      }
    }
  }


  /**
   * Fetch dgraph cloud instance
   * @param { object } param
   * @param { string } param.path - Url piece after the endpoint `/`
   * @param { enumContentType } [param.contentType] - Optional: The option that will be sent in the header for the key
   * @param { string } [param.body] - Optional: Fetch request body
   * @param { () => Promise<void | import('./typedefs.js').DgraphResponse> } param.abort - Dgraph transaction object
   * @returns { Promise<import('./typedefs.js').DgraphResponse> }
  */  
  async function api  ({ path, body, contentType, abort }) {
    /** @type { import('./typedefs.js').DgraphAPIHeaders } */
    const headers = { 'X-Auth-Token': apiKey }
    if (contentType) headers['Content-Type'] = contentType

    /** @type { RequestInit } */
    const requestInit = { method: 'POST', headers }
    if (body) requestInit.body = body

    const url = endpoint +'/'+ path

    try {
      const rFetch = await fetch(url, requestInit)

      if (rFetch.status < 200 || rFetch.status >= 300) throw rFetch
      else return await rFetch.json()
    } catch (e) {
      await abort()
      throw e
    }
  }


  /**
   * Sync extensions from response with their values in this transaction 
   * @param { import('./typedefs.js').DgraphExtensionsTxn } extensionsTxn 
  */
  function syncResponseExtensions (extensionsTxn) {
    if (extensionsTxn) {
      if (extensionsTxn.hash) hash = extensionsTxn.hash

      if (startTs === 0) startTs = extensionsTxn.start_ts 
      else if (startTs !== extensionsTxn.start_ts) throw { id: 'fln__dgraph__start-ts-mismatch', message: 'The start_ts on the last request does not match the start_ts in the transaction', data: { transactionStartTs: startTs, responseStartTs: extensionsTxn.start_ts } }

      if (extensionsTxn.keys) keys = mergeArrays(keys, extensionsTxn.keys)
      if (extensionsTxn.preds) preds = mergeArrays(preds, extensionsTxn.preds)
    }
  }


  /**
   * Accepts 2 array of strings; Concats them, removes any duplicates and returns the result
   * @param { string[] } array1 - First array
   * @param { string[] } array2 - Second array
   * @returns { string[] }
  */
  function mergeArrays(array1, array2) {
    if (!array1 && !array2) return []
    else if (array1 && !array2) return array1
    else if (!array1 && array2) return array2
    else {
      const concat = array1.concat(array2) // concat arrays
      const set = new Set(concat) // remove duplicates
      return Array.from(set) // convert set to an array
    }
  }
}
