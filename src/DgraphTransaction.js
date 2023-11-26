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
   * @param { import('./typedefs.js').DgraphTransactionConstructor } params
   */
  constructor({ apiKey, endpoint, readOnly, bestEffort, timeout }) {
    if (!apiKey) throw { id: 'fln__dgraph__missing-apiKey', message: 'Transaction constructor needs an apiKey', _errorData: { apiKey } }
    if (!endpoint) throw { id: 'fln__dgraph__missing-endpoint', message: 'Transaction constructor needs an endpoint', _errorData: { endpoint } }

    this.#apiKey = apiKey
    this.#endpoint = endpoint

    if (readOnly) this.#readOnly = readOnly
    if (bestEffort) this.#bestEffort = bestEffort
    if (timeout) this.#timeout = timeout
  }


  /**
   * Query dgraph cloud instance. Only accepts DQL syntax. IF closeWhenDone is set to true the transaction will not be allowed to be used again (does not send a request to dgraph cloud instance, just sets this.isClosed to true)
   * @param { boolean } closeWhenDone - IF closeWhenDone is set to true the transaction will not be allowed to be used again (does not send a request to dgraph cloud instance, just sets this.isClosed to true)
   * @param { string } query - Only accepts DQL syntax.
   * @returns { Promise<import('./typedefs.js').DgraphResponse> }
  */
  async query  (closeWhenDone, query) {
    if (this.#isAborted) throw { id: 'fln__dgraph__already-aborted', message: 'Transaction already aborted', _errorData: { query } }
    else if (this.#isCommited) throw { id: 'fln__dgraph__already-commited', message: 'Transaction already commited', _errorData: { query } }
    else if (this.#isClosed) throw { id: 'fln__dgraph__already-closed', message: 'Transaction already closed', _errorData: { query } }
    else {
      const searchParams = new URLSearchParams()

      if (this.#hash) searchParams.set('hash', this.#hash)
      if (this.#startTs !== 0) searchParams.set('startTs', String(this.#startTs))
      if (this.#timeout > 0) searchParams.set('timeout', String(this.#timeout) + 's')
      if (this.#readOnly) searchParams.set('ro', 'true')
      if (this.#bestEffort) searchParams.set('be', 'true')

      const searchParamsStr = searchParams.toString()
      const path = searchParamsStr ? `query?${ searchParamsStr }` : 'query'
      const r = await this.#api({ path, body: query, contentType: enumContentType.dql })

      if (closeWhenDone) this.#isClosed = true
      else if (r?.extensions?.txn) this.#syncResponseExtensions(r.extensions.txn)

      return r
    } 
  }


  /**
   * Mutate dgraph cloud instance. Only accepts `rdf` triples syntax. If `commitNow` is true we send query param to dgraph cloud instance in this mutation api call that this is the last query or mutation coming from this transation   * @param { import('./typedefs.js').DgraphMutationOptions } dgraphMutationOptions
   * @returns { Promise<import('./typedefs.js').DgraphResponse> }
  */
  async mutate ({ mutation, remove, commitNow }) {
    if (!mutation && !remove) throw { id: 'fln__dgraph__empty-mutate', message: 'Mutate function requires a mutation or remove string' }
    else if (mutation && remove) throw { id: 'fln__dgraph__full-mutate', message: 'Mutate function requires only a mutation or a remove string but not both' }
    else if (this.#isAborted) throw { id: 'fln__dgraph__already-aborted', message: 'Transaction already aborted', _errorData: { mutation, remove, commitNow } }
    else if (this.#isCommited) throw { id: 'fln__dgraph__already-commited', message: 'Transaction already commited', _errorData: { mutation, remove, commitNow } }
    else if (this.#isClosed) throw { id: 'fln__dgraph__already-closed', message: 'Transaction already closed', _errorData: { mutation, remove, commitNow } }
    else if (this.#readOnly) throw { id: 'fln__dgraph__readonly-mutation', message: 'Readonly transactions may not contain mutations', _errorData: { mutation, remove, commitNow } }
    else {
      this.#didMutations = true

      const body = mutation ? `{ set { ${ mutation } } }` : `{ delete { ${ remove } } }`

      const searchParams = new URLSearchParams()
      if (commitNow) searchParams.set('commitNow', 'true')
      if (this.#hash) searchParams.set('hash', this.#hash)
      if (this.#startTs) searchParams.set('startTs', String(this.#startTs))

      const searchParamsStr = searchParams.toString()
      const path = searchParamsStr ? `mutate?${ searchParamsStr }` : 'mutate'
      const r = await this.#api({ path, body, contentType: enumContentType.rdf })

      if (commitNow) this.#isCommited = true
      else if (r?.extensions?.txn) this.#syncResponseExtensions(r.extensions.txn)

      return r
    }
  }


  /**
   * Commit all mutations that have been done with this transaction. IF transaction has done any mutations => send an api call to dgraph cloud instance to let it know no more incoming actions will be coming from this transaction and to `commit` all that has been done by this transaction. IF transaction has done no mutations => set `this.isCommited` to true so no further queries or mutations may happen with transaction.
   * @returns { Promise<void | import('./typedefs.js').DgraphResponse> }
  */  
  async commit () {
    if (this.#isAborted) throw { id: 'fln__dgraph__already-aborted', message: 'Transaction already aborted' }
    else if (this.#isCommited) throw { id: 'fln__dgraph__already-commited', message: 'Transaction already commited' }
    else if (this.#isClosed) throw { id: 'fln__dgraph__already-closed', message: 'Transaction already closed' }
    else {
      this.#isCommited = true

      if (this.#didMutations) { // IF transaction did mutations => api call to "/commit" happens
        const body = JSON.stringify(this.#keys)

        const searchParams = new URLSearchParams()
        searchParams.set('startTs', String(this.#startTs))
        if (this.#hash) searchParams.set('hash', this.#hash)

        const path = 'commit?' + searchParams.toString()

        return await this.#api({ path, body, contentType: enumContentType.json })
      }
    }
  }


  /**
   * Abort all mutations that have been done with this transaction. IF transaction has done any mutations => send an api call to dgraph cloud instance to let it know no more incoming actions will be coming from this transaction and to `rollback` all that has been done by this transaction. IF transaction has done no mutations => set `this.aborted` to true so no further queries or mutations may happen with transaction.
   * @returns { Promise<void | import('./typedefs.js').DgraphResponse> }
  */
  async abort () {
    if (!this.#isAborted) {
      this.#isAborted = true

      if (this.#didMutations) { // IF transaction did mutations => api call to "/commit?abort=true" happens
        const searchParams = new URLSearchParams()
        searchParams.set('startTs', String(this.#startTs))
        searchParams.set('abort', 'true')
        if (this.#hash) searchParams.set('hash', this.#hash)

        const path = 'commit?' + searchParams.toString()

        return await this.#api({ path })
      }
    }
  }


  /**
   * Fetch dgraph cloud instance
   * @param { object } param
   * @param { string } param.path - Url piece after the endpoint `/`
   * @param { enumContentType } [param.contentType] - Optional: The option that will be sent in the header for the key
   * @param { string } [param.body] - Optional: Fetch request body
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

      if (rFetch.status < 200 || rFetch.status >= 300) throw rFetch
      else return await rFetch.json()
    } catch (e) {
      await this.abort()
      throw e
    }
  }


  /**
   * Sync extensions from response with their values in this transaction 
   * @param { import('./typedefs.js').DgraphExtensionsTxn } extensionsTxn 
  */
  #syncResponseExtensions (extensionsTxn) {
    if (extensionsTxn) {
      if (extensionsTxn.hash) this.#hash = extensionsTxn.hash

      if (this.#startTs === 0) this.#startTs = extensionsTxn.start_ts 
      else if (this.#startTs !== extensionsTxn.start_ts) throw { id: 'fln__dgraph__start-ts-mismatch', message: 'The start_ts on the last request does not match the start_ts in the transaction', data: { transactionStartTs: this.#startTs, responseStartTs: extensionsTxn.start_ts } }

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
  #mergeArrays(array1, array2) {
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
