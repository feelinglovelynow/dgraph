# 🕉 @feelinglovelynow/dgraph


## 💎 Install
```bash
pnpm add @feelinglovelynow/dgraph
```


## 🙏 Description
* B/c the npm package [dgraph-js-http](https://www.npmjs.com/package/dgraph-js-http?activeTab=dependencies) has a dependency on `jsonwebtoken` it does not work on the edge
*  `@feelinglovelynow/dgraph` has 0 dependencies and works on the edge
* Features a `DgraphTransaction` class that creates a transaction object with lots of features to ease workflow with [dgraph cloud instances](https://dgraph.io/product). Guidance came from [here](https://dgraph.io/docs/dql/clients/raw-http/).
* Not officially supported by Dgraph btw, just created to get Dgraph loveliness in [Cloudflare Workers](https://workers.cloudflare.com/)! All the features [my site](https://feelinglovelynow.com/) uses everyday are included; if there is something you'd love that isn't included, let's chat please!


## 💚 Constructor
```ts
constructor ({ apiKey, endpoint, readOnly, bestEffort, timeout })
```
* **REQUIRED**: `apiKey { string }`: Found @ Dgraph Cloud > Settings > Api Keys
* **REQUIRED**: `endpoint { string }`: Found @ Dgraph Cloud > GraphQL Endpoint. **Remove /graphql from endpoint b4 sending to this constructor**
* **Default is false**: `readOnly { boolean }`: Read only transactions are useful to increase read speed because they can circumvent the usual consensus protocol. Read-only transactions cannot contain mutations.
* **Default is false**: `bestEffort { boolean }`: The `bestEffort` flag asks Dgraph Alpha to try to get timestamps from memory on a best-effort basis to reduce the number of outbound requests to Zero. This may yield improved latencies in read-bound workloads where linearizable reads are not strictly needed.
* **Default is 600**: `timeout { number }:` Max seconds any query of this transaction will be allowed to be attempted


## 💛 Mutations
* `transaction.mutate({ mutation, remove, commitNow }: DgraphMutationOptions): Promise<DgraphResponse>`
* Mutate dgraph cloud instance.
* Only accepts `rdf` triples syntax
* If `commitNow` is true we send query param to dgraph cloud instance in this mutation api call that this is the last query or mutation coming from this transation
```ts
const t1 = new DgraphTransaction({ ...txnOptions() })

await t1.mutate({ // remove + commit t1
  commitNow: true,
  remove: `<${ uid }> * * .`
})

const t2 = new DgraphTransaction({ ...txnOptions() })

await t2.mutate({ // mutation
  mutation: `
    <${ uid2 }> <Abc.xyz> "${ abc }" .
    <${ uid3 }> <Abc.xyz> "${ abc }" .
    <${ uid4 }> <Abc.xyz> "${ abc }" .
  `
})

await t2.mutate({ remove: `<${ uid5 }> * * .` }) // remove

await t2.commit() // commit t2
```

## 🧡 Query
* `transaction.query(closeWhenDone: boolean, query: string): Promise<DgraphResponse>`
* Query dgraph cloud instance
* Only accepts `DQL` syntax
* IF `closeWhenDone` is set to true the transaction will not be allowed to be used again (does not send a request to dgraph cloud instance, just sets `this.isClosed` to true)
```ts
async function getProducts (): Promise<Product[]> {
  const transaction = new DgraphTransaction({ ...txnOptions(), readOnly: true, bestEffort: true })

  const r = await transaction.query(true, `
    query {
      products(func: type(Product)) {
        uid
        name: Product.name
      }
    }
  `)

  return r?.data?.products as Product[]
}
```


## ❤️ Example: txnOptions()
* PUBLIC_ENVIRONMENT is set via [@feelinglovelynow/env-write](https://www.npmjs.com/package/@feelinglovelynow/env-write)
* All other variables like `DGRAPH_CLOUD_API_KEY` are in the `.env` file
```ts
import { PUBLIC_ENVIRONMENT } from '$env/static/public'
import { DGRAPH_CLOUD_URL, DGRAPH_CLOUD_API_KEY, DGRAPH_CLOUD_URL_QA, DGRAPH_CLOUD_API_KEY_QA } from '$env/static/private'


export default function txnOptions (pointMain?: boolean): { endpoint: string, apiKey: string } {
  return pointMain || PUBLIC_ENVIRONMENT === 'main' ?
    { endpoint: DGRAPH_CLOUD_URL, apiKey: DGRAPH_CLOUD_API_KEY } :
    { endpoint: DGRAPH_CLOUD_URL_QA, apiKey: DGRAPH_CLOUD_API_KEY_QA }
}
```


## 💟 TYPE: DgraphResponse
```ts
/** @typedef { DgraphQueryResponse | DgraphMutationResponse | DgraphCommitResponse | DgraphAbortResponse | DgraphErrorResponse } DgraphResponse */

/**
 * @typedef { Object } DgraphQueryResponse
 * @prop { any } data
 * @prop { { txn: DgraphExtensionsTxn } } extensions
 * @prop { never= } name
 * @prop { never= } url
 * @prop { never= } errors
 * @prop { never= } code
 * @prop { never= } message
*/

/**
 * @typedef { Object } DgraphMutationResponse
 * @prop { { code: string, message: string, queries: any, uids: any } } data
 * @prop { { txn: DgraphExtensionsTxn } } extensions
 * @prop { never= } name
 * @prop { never= } url
 * @prop { never= } errors
 * @prop { never= } code
 * @prop { never= } message
*/

/**
 * @typedef { Object } DgraphCommitResponse
 * @prop { { code: string, message: string } } data
 * @prop { { txn: DgraphExtensionsTxn } } extensions
 * @prop { never= } name
 * @prop { never= } url
 * @prop { never= } errors
 * @prop { never= } code
 * @prop { never= } message
*/

/**
 * @typedef { Object } DgraphAbortResponse
 * @prop { never= } data
 * @prop { never= } extensions
 * @prop { never= } name
 * @prop { never= } url
 * @prop { never= } errors
 * @prop { string } code
 * @prop { string } message
 * @prop { never= } code
 * @prop { never= } message
*/

/**
 * @typedef { Object } DgraphErrorResponse
 * @prop { never= } data
 * @prop { never= } extensions
 * @prop { string } name
 * @prop { string } url
 * @prop { { message: string, extensions: { code: string } }[] } errors
 * @prop { never= } code
 * @prop { never= } message
*/
```

## 🌟 TYPE: DgraphMutationOptions
```ts
/** @typedef { DgraphMutation | DgraphRemove } DgraphMutationOptions */

/**
 * @typedef DgraphMutation
 * @prop { boolean= } commitNow - If `commitNow` is true we send query param to dgraph cloud instance in this mutation api call that this is the last query or mutation coming from this transation
 * @prop { string } mutation - Only accepts `rdf` triples syntax
 * @prop { never= } remove
*/

/**
 * @typedef DgraphRemove
 * @prop { boolean= } commitNow - If `commitNow` is true we send query param to dgraph cloud instance in this mutation api call that this is the last query or mutation coming from this transation
 * @prop { never= } mutation
 * @prop { string } remove - Only accepts `rdf` triples syntax
*/
```

## ✨ Abort
* `transaction.abort(): Promise<DgraphResponse | void>`
* IF transaction has done any mutations => send an api call to dgraph cloud instance to let it know no more incoming actions will be coming from this transaction and to `rollback` all that has been done by this transaction
* IF transaction has done no mutations => set `this.aborted` to true so no further queries or mutations may happen with transaction


## 🚀 Commit
* `transaction.commit(): Promise<DgraphResponse | void>`
* IF transaction has done any mutations => send an api call to dgraph cloud instance to let it know no more incoming actions will be coming from this transaction and to `commit` all that has been done by this transaction
* IF transaction has done no mutations => set `this.isCommited` to true so no further queries or mutations may happen with transaction


## 🔥 Errors we may throw
* `this.query()` |  `this.mutate()` |  `this.abort()` |  `this.commit()`
* Basically saying for any of the above functions if the status in not between 200 and 300 we will abort the transaction and throw the error
```ts
try {
  const rFetch = await fetch(url, requestInit)

  if (rFetch.status < 200 || rFetch.status >= 300) throw rFetch
  else return await rFetch.json()
} catch (e) {
  await this.abort()
  throw e
}
```
* `constructor()`
```ts
if (!apiKey) throw { id: 'fln__dgraph__missing-apiKey', message: 'Transaction constructor needs an apiKey', _errorData: { apiKey } }
if (!endpoint) throw { id: 'fln__dgraph__missing-endpoint', message: 'Transaction constructor needs an endpoint', _errorData: { endpoint } }
```
* `this.query()`
```ts
if (this.isAborted) throw { id: 'fln__dgraph__already-aborted', message: 'Transaction already aborted', _errorData: { query } }
else if (this.isCommited) throw { id: 'fln__dgraph__already-commited', message: 'Transaction already commited', _errorData: { query } }
else if (this.isClosed) throw { id: 'fln__dgraph__already-closed', message: 'Transaction already closed', _errorData: { query } }
```
* `this.mutate()`
```ts
if (!mutation && !remove) throw { id: 'fln__dgraph__empty-mutate', message: 'Mutate function requires a mutation or remove string' }
else if (this.isAborted) throw { id: 'fln__dgraph__already-aborted', message: 'Transaction already aborted', _errorData: { mutation, remove, commitNow } }
else if (this.isCommited) throw { id: 'fln__dgraph__already-commited', message: 'Transaction already commited', _errorData: { mutation, remove, commitNow } }
else if (this.isClosed) throw { id: 'fln__dgraph__already-closed', message: 'Transaction already closed', _errorData: { mutation, remove, commitNow } }
else if (this.readOnly) throw { id: 'fln__dgraph__readonly-mutation', message: 'Readonly transactions may not contain mutations', _errorData: { mutation, remove, commitNow } }
```
* `this.commit()`
```ts
if (this.isAborted) throw { id: 'fln__dgraph__already-aborted', message: 'Transaction already aborted' }
else if (this.isCommited) throw { id: 'fln__dgraph__already-commited', message: 'Transaction already commited' }
else if (this.isClosed) throw { id: 'fln__dgraph__already-closed', message: 'Transaction already closed' }
```



## 🎁 All Our Packages
1. @feelinglovelynow/dgraph: [NPM](https://www.npmjs.com/package/@feelinglovelynow/dgraph) ⋅ [Github](https://github.com/feelinglovelynow/dgraph)
1. @feelinglovelynow/env-write: [NPM](https://www.npmjs.com/package/@feelinglovelynow/env-write) ⋅ [Github](https://github.com/feelinglovelynow/env-write)
1. @feelinglovelynow/get-form-entries: [NPM](https://www.npmjs.com/package/@feelinglovelynow/get-form-entries) ⋅ [Github](https://github.com/feelinglovelynow/get-form-entries)
1. @feelinglovelynow/get-relative-time: [NPM](https://www.npmjs.com/package/@feelinglovelynow/get-relative-time) ⋅ [Github](https://github.com/feelinglovelynow/get-relative-time)
1. @feelinglovelynow/global-style: [NPM](https://www.npmjs.com/package/@feelinglovelynow/global-style) ⋅ [Github](https://github.com/feelinglovelynow/global-style)
1. @feelinglovelynow/jwt: [NPM](https://www.npmjs.com/package/@feelinglovelynow/jwt) ⋅ [Github](https://github.com/feelinglovelynow/jwt)
1. @feelinglovelynow/loop-backwards: [NPM](https://www.npmjs.com/package/@feelinglovelynow/loop-backward) ⋅ [Github](https://github.com/feelinglovelynow/loop-backwards)
1. @feelinglovelynow/slug: [NPM](https://www.npmjs.com/package/@feelinglovelynow/slug) ⋅ [Github](https://github.com/feelinglovelynow/slug)
1. @feelinglovelynow/svelte-catch: [NPM](https://www.npmjs.com/package/@feelinglovelynow/svelte-catch) ⋅ [Github](https://github.com/feelinglovelynow/svelte-catch)
1. @feelinglovelynow/svelte-kv: [NPM](https://www.npmjs.com/package/@feelinglovelynow/svelte-kv) ⋅ [Github](https://github.com/feelinglovelynow/svelte-kv)
1. @feelinglovelynow/svelte-loading-anchor: [NPM](https://www.npmjs.com/package/@feelinglovelynow/svelte-loading-anchor) ⋅ [Github](https://github.com/feelinglovelynow/svelte-loading-anchor)
1. @feelinglovelynow/svelte-modal: [NPM](https://www.npmjs.com/package/@feelinglovelynow/svelte-modal) ⋅ [Github](https://github.com/feelinglovelynow/svelte-modal)
1. @feelinglovelynow/svelte-turnstile: [NPM](https://www.npmjs.com/package/@feelinglovelynow/svelte-turnstile) ⋅ [Github](https://github.com/feelinglovelynow/svelte-turnstile)
1. @feelinglovelynow/toast: [NPM](https://www.npmjs.com/package/@feelinglovelynow/toast) ⋅ [Github](https://github.com/feelinglovelynow/toast)
