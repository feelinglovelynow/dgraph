import { enumContentType } from './enumContentType.js'


export class DgraphTransaction {
  /** @type { string[] } */
  #keys = []
  /** @type { string[] } */
  #preds = []
  #hash = ''
  #apiKey = ''
  #endpoint = ''
  #startTs = 0
  #timeout = 600
  #readOnly = false
  #bestEffort = false
  #isClosed = false
  #isCommited = false
  #isAborted = false
  #didMutations = false


  /**
   * Creates a transaction object with lots of features to ease workflow with [dgraph cloud instances](https://dgraph.io/product). Guidance came from [here](https://dgraph.io/docs/dql/clients/raw-http/).
   * @param { import('./typedefs.js').DgraphTransactionConstructor } params - `{ apiKey: string, endpoint: string, readOnly?: boolean, bestEffort?: boolean, timeout: number }`
   * @throws { { id: 'fln__dgraph__missing-apiKey', message: 'Transaction constructor needs an apiKey', _errorData: { apiKey } } } - `IF (!apiKey)`
   * @throws { { id: 'fln__dgraph__missing-endpoint', message: 'Transaction constructor needs an endpoint', _errorData: { endpoint } } } - `IF (!endpoint)`
  */
  constructor (params) {
    this.#validateConstructor(params)

    const { apiKey, endpoint, readOnly, bestEffort, timeout } = params

    this.#apiKey = apiKey
    this.#endpoint = endpoint

    if (readOnly) this.#readOnly = readOnly
    if (bestEffort) this.#bestEffort = bestEffort
    if (timeout) this.#timeout = timeout
  }


  /**
   * Throw an error if there is an issue in th constructor
   * @param { import('./typedefs.js').DgraphTransactionConstructor } params - `{ apiKey: string, endpoint: string, readOnly?: boolean, bestEffort?: boolean, timeout: number }`
   * @throws { { id: 'fln__dgraph__missing-apiKey', message: 'Transaction constructor needs an apiKey', _errorData: { apiKey } } } - `IF (!apiKey)`
   * @throws { { id: 'fln__dgraph__missing-endpoint', message: 'Transaction constructor needs an endpoint', _errorData: { endpoint } } } - `IF (!endpoint)`
   * @returns { void }
  */
  #validateConstructor (params) {
    if (!params || typeof params !== 'object') throw { id: 'fln__dgraph__missing-params', message: 'Transaction constructor needs a params object', _errorData: { params } }

    const { apiKey, endpoint } = params

    if (!apiKey) throw { id: 'fln__dgraph__missing-apiKey', message: 'Transaction constructor needs an apiKey', _errorData: { apiKey } }
    if (!endpoint) throw { id: 'fln__dgraph__missing-endpoint', message: 'Transaction constructor needs an endpoint', _errorData: { endpoint } }
  }


  /**
   * Query dgraph cloud instance
   * @param { boolean } closeWhenDone - IF closeWhenDone is set to true the transaction will not be allowed to be used again (does not send a request to dgraph cloud instance, just sets this.isClosed to true)
   * @param { string } query - Only accepts DQL syntax
   * @throws { { id: 'fln__dgraph__already-aborted', message: 'Transaction already aborted', _errorData: { query } } } - `IF (this.#isAborted)`
   * @throws { { id: 'fln__dgraph__already-commited', message: 'Transaction already commited', _errorData: { query } } } - `IF (this.#isCommited)`
   * @throws { { id: 'fln__dgraph__already-closed', message: 'Transaction already closed', _errorData: { query } } } - `IF (this.#isClosed)`
   * @returns { Promise<import('./typedefs.js').DgraphResponse> }
  */
  async query (closeWhenDone, query) {
    this.#validateQuery(query)

    const searchParams = new URLSearchParams()

    if (this.#startTs) searchParams.set('startTs', String(this.#startTs))
    if (this.#hash) searchParams.set('hash', this.#hash)
    if (this.#timeout > 0) searchParams.set('timeout', String(this.#timeout) + 's')
    if (this.#readOnly) searchParams.set('ro', 'true')
    if (this.#bestEffort) searchParams.set('be', 'true')

    const searchParamsStr = searchParams.toString()
    const path = `query?${ searchParamsStr }`
    const r = await this.#api({ path, body: query, contentType: enumContentType.dql })

    if (closeWhenDone) this.#isClosed = true
    else if (r?.extensions?.txn) this.#syncResponseExtensions(r.extensions.txn)

    return r
  }


  /**
   * Throw an error if there is an issue with this query
   * @param { string } query - Only accepts DQL syntax
   * @throws { { id: 'fln__dgraph__already-aborted', message: 'Transaction already aborted', _errorData: { query } } } - `IF (this.#isAborted)`
   * @throws { { id: 'fln__dgraph__already-commited', message: 'Transaction already commited', _errorData: { query } } } - `IF (this.#isCommited)`
   * @throws { { id: 'fln__dgraph__already-closed', message: 'Transaction already closed', _errorData: { query } } } - `IF (this.#isClosed)`
   * @returns { void }
  */
  #validateQuery (query) {
    if (this.#isAborted) throw { id: 'fln__dgraph__already-aborted', message: 'Transaction already aborted', _errorData: { query } }
    if (this.#isCommited) throw { id: 'fln__dgraph__already-commited', message: 'Transaction already commited', _errorData: { query } }
    if (this.#isClosed) throw { id: 'fln__dgraph__already-closed', message: 'Transaction already closed', _errorData: { query } }
  }


  /**
   * Mutate dgraph cloud instance. Only accepts `rdf` triples syntax. If `commitNow` is true we send `commitNow=true` in this mutation api calls query param AND set `this.#isCommited = true`
   * @param { import('./typedefs.js').DgraphMutationOptions } params - `{ mutation?: string, remove?: string, commitNow: boolean }` - Either `mutation` OR `remove` must be defined
   * @throws { { id: 'fln__dgraph__missing-params', message: 'Mutate function needs a params object', _errorData: { params } } } - `IF (!params || typeof params !== 'object')`
   * @throws { { id: 'fln__dgraph__empty-mutate', message: 'Mutate function requires a mutation or remove string', _errorData: { mutation, remove } } } - `IF (!mutation && !remove)`
   * @throws { { id: 'fln__dgraph__full-mutate', message: 'Mutate function requires only a mutation or a remove string but not both' } } - `IF (mutation && remove)`
   * @throws { { id: 'fln__dgraph__already-aborted', message: 'Transaction already aborted', _errorData: { mutation, remove, commitNow } } } - `IF (this.#isAborted)`
   * @throws { { id: 'fln__dgraph__already-commited', message: 'Transaction already commited', _errorData: { mutation, remove, commitNow } } } - `IF (this.#isCommited)`
   * @throws { { id: 'fln__dgraph__already-closed', message: 'Transaction already closed', _errorData: { mutation, remove, commitNow } } } - `IF (this.#isClosed)`
   * @throws { { id: 'fln__dgraph__readonly-mutation', message: 'Readonly transactions may not contain mutations', _errorData: { mutation, remove, commitNow } } } - `IF (this.#readOnly)`
   * @returns { Promise<import('./typedefs.js').DgraphResponse> }
  */
  async mutate (params) {
    this.#validateMutate(params)
    this.#didMutations = true

    const { mutation, remove, commitNow } = params
    const body = mutation ? `{ set { ${ mutation } } }` : `{ delete { ${ remove } } }`
    const searchParams = new URLSearchParams()

    if (commitNow) searchParams.set('commitNow', 'true')
    if (this.#startTs) searchParams.set('startTs', String(this.#startTs))
    if (this.#hash) searchParams.set('hash', this.#hash)

    const searchParamsStr = searchParams.toString()
    const path = searchParamsStr ? `mutate?${searchParamsStr}` : 'mutate'
    const r = await this.#api({ path, body, contentType: enumContentType.rdf })

    if (commitNow) this.#isCommited = true
    else if (r?.extensions?.txn) this.#syncResponseExtensions(r.extensions.txn)

    return r
  }


  /**
   * Throw an error if there is an issue with this mutation
   * @param { import('./typedefs.js').DgraphMutationOptions } params - `{ mutation?: string, remove?: string, commitNow: boolean }` - Either `mutation` OR `remove` must be defined
   * @throws { { id: 'fln__dgraph__missing-params', message: 'Mutate function needs a params object', _errorData: { params } } } - `IF (!params || typeof params !== 'object')`
   * @throws { { id: 'fln__dgraph__empty-mutate', message: 'Mutate function requires a mutation or remove string', _errorData: { mutation, remove } } } - `IF (!mutation && !remove)`
   * @throws { { id: 'fln__dgraph__full-mutate', message: 'Mutate function requires only a mutation or a remove string but not both' } } - `IF (mutation && remove)`
   * @throws { { id: 'fln__dgraph__already-aborted', message: 'Transaction already aborted', _errorData: { mutation, remove, commitNow } } } - `IF (this.#isAborted)`
   * @throws { { id: 'fln__dgraph__already-commited', message: 'Transaction already commited', _errorData: { mutation, remove, commitNow } } } - `IF (this.#isCommited)`
   * @throws { { id: 'fln__dgraph__already-closed', message: 'Transaction already closed', _errorData: { mutation, remove, commitNow } } } - `IF (this.#isClosed)`
   * @throws { { id: 'fln__dgraph__readonly-mutation', message: 'Readonly transactions may not contain mutations', _errorData: { mutation, remove, commitNow } } } - `IF (this.#readOnly)`
   * @returns { void }
  */
  #validateMutate (params) {
    if (!params || typeof params !== 'object') throw { id: 'fln__dgraph__missing-params', message: 'Mutate function needs a params object', _errorData: { params } }

    const { mutation, remove, commitNow } = params

    if (!mutation && !remove) throw { id: 'fln__dgraph__empty-mutate', message: 'Mutate function requires a mutation or remove string', _errorData: { mutation, remove } }
    if (mutation && remove) throw { id: 'fln__dgraph__full-mutate', message: 'Mutate function requires only a mutation or a remove string but not both' }
    if (this.#isAborted) throw { id: 'fln__dgraph__already-aborted', message: 'Transaction already aborted', _errorData: { mutation, remove, commitNow } }
    if (this.#isCommited) throw { id: 'fln__dgraph__already-commited', message: 'Transaction already commited', _errorData: { mutation, remove, commitNow } }
    if (this.#isClosed) throw { id: 'fln__dgraph__already-closed', message: 'Transaction already closed', _errorData: { mutation, remove, commitNow } }
    if (this.#readOnly) throw { id: 'fln__dgraph__readonly-mutation', message: 'Readonly transactions may not contain mutations', _errorData: { mutation, remove, commitNow } }
  }


  /**
   * Commit all mutations that have been done with this transaction. IF transaction has done any mutations => set `this.#isCommited = true` AND send a `/commit` api call to dgraph cloud instance to ask it know to commit this transaction (affirm all transaction's mutations). IF transaction has done no mutations => set `this.#isCommited = true`
   * @throws { { id: 'fln__dgraph__already-aborted', message: 'Transaction already aborted' } } - `IF (this.#isAborted)`
   * @throws { { id: 'fln__dgraph__already-commited', message: 'Transaction already commited' } } - `IF (this.#isCommited)`
   * @throws { { id: 'fln__dgraph__already-closed', message: 'Transaction already closed' } } - `IF (this.#isClosed)`
   * @returns { Promise<void | import('./typedefs.js').DgraphResponse> }
  */  
  async commit () {
    this.#validateCommit()
    this.#isCommited = true

    if (this.#didMutations) { // IF transaction did mutations => api call to "/commit" happens
      const body = JSON.stringify({
        keys: this.#keys,
        preds: this.#preds,
      })

      const searchParams = new URLSearchParams()
      searchParams.set('startTs', String(this.#startTs))
      searchParams.set('hash', this.#hash)

      const path = 'commit?' + searchParams.toString()
      return await this.#api({ path, body, contentType: enumContentType.json })
    }
  }


  /**
   * Throw an error if there is an issue with this commit
   * @throws { { id: 'fln__dgraph__already-aborted', message: 'Transaction already aborted' } } - `IF (this.#isAborted)`
   * @throws { { id: 'fln__dgraph__already-commited', message: 'Transaction already commited' } } - `IF (this.#isCommited)`
   * @throws { { id: 'fln__dgraph__already-closed', message: 'Transaction already closed' } } - `IF (this.#isClosed)`
   * @returns { void }
  */
  #validateCommit () {
    if (this.#isAborted) throw { id: 'fln__dgraph__already-aborted', message: 'Transaction already aborted' }
    if (this.#isCommited) throw { id: 'fln__dgraph__already-commited', message: 'Transaction already commited' }
    if (this.#isClosed) throw { id: 'fln__dgraph__already-closed', message: 'Transaction already closed' }
  }


  /**
   * Abort all mutations that have been done with this transaction. IF transaction has done any mutations => set `this.#isAborted = true` AND send `/commit?abort=true` api call to dgraph cloud instance to ask it to `rollback` all mutations that have been done by this transaction. IF transaction has done no mutations => set `this.#isAborted = true`
   * @returns { Promise<void | import('./typedefs.js').DgraphResponse> }
  */
  async abort () {
    if (!this.#isAborted) {
      this.#isAborted = true

      if (this.#didMutations) { // IF transaction did mutations => api call to "/commit?abort=true" happens
        const searchParams = new URLSearchParams()
        searchParams.set('startTs', String(this.#startTs))
        searchParams.set('hash', this.#hash)
        searchParams.set('abort', 'true')
        const path = 'commit?' + searchParams.toString()

        return await this.#api({ path })
      }
    }
  }


  /**
   * Fetch dgraph cloud instance
   * @param { object } param `{ path: string, contentType?: enumContentType, body?: string }`
   * @param { string } param.path - Url piece after the endpoint `/`
   * @param { enumContentType } [param.contentType] - Optional: The option that will be sent in the header for the key
   * @param { string } [param.body] - Optional: Fetch request body
   * @throws { e } - `IF (rFetch.status >= 300)`
   * @returns { Promise<import('./typedefs.js').DgraphResponse> }
  */  
  async #api  ({ path, body, contentType }) {
    /** @type { import('./typedefs.js').DgraphAPIHeaders } */
    const headers = { 'X-Auth-Token': this.#apiKey }
    if (contentType) headers['Content-Type'] = contentType

    /** @type { RequestInit } */
    const requestInit = { method: 'POST', headers }
    if (body) requestInit.body = body

    const url = this.#endpoint +'/'+ path

    try {
      const rFetch = await fetch(url, requestInit)

      if (rFetch.status >= 300) throw rFetch
      else return await rFetch.json()
    } catch (e) {
      await this.abort()
      throw e
    }
  }


  /**
   * Sync extensions from response with their values in this transaction 
   * @param { import('./typedefs.js').DgraphExtensionsTxn } extensionsTxn - `{ start_ts: number, hash: string, keys?: string[], preds?: string[], readOnly?: boolean, aborted?: boolean }`
  */
  #syncResponseExtensions (extensionsTxn) {
    if (extensionsTxn) {
      if (extensionsTxn.hash) this.#hash = extensionsTxn.hash

      if (this.#startTs === 0) this.#startTs = extensionsTxn.start_ts 
      else if (this.#startTs !== extensionsTxn.start_ts) throw { id: 'fln__dgraph__start-ts-mismatch', message: 'The start_ts of the last request does not match the start_ts in the transaction', _errorData: { transactionStartTs: this.#startTs, responseStartTs: extensionsTxn.start_ts } }

      if (extensionsTxn.keys) this.#keys = this.#mergeArrays(this.#keys, extensionsTxn.keys)
      if (extensionsTxn.preds) this.#preds = this.#mergeArrays(this.#preds, extensionsTxn.preds)
    }
  }


  /**
   * Accepts 2 array of strings; Concats them, removes any duplicates and returns the result
   * @param { string[] } array1 - First array
   * @param { string[] } array2 - Second array
   * @returns { string[] }
  */
  #mergeArrays (array1, array2) {
    const united = array1.concat(array2) // concat arrays
    const unique = new Set(united) // remove duplicates
    return Array.from(unique) // convert set to an array
  }
}
