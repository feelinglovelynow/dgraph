import { enumContentType } from './enumContentType.js'


/**
 * @typedef { object } DgraphTransactionConstructor
 * @property { string } apiKey Found @ Dgraph Cloud > Settings > Api Keys
 * @property { string } endpoint Found @ Dgraph Cloud > GraphQL Endpoint. **IMPORTANT: remove /graphql from endpoint before sending to this constructor**
 * @property { boolean= } readOnly Optional: Read only transactions are useful to increase read speed because they can circumvent the usual consensus protocol. Read-only transactions cannot contain mutations.
 * @property { boolean= } bestEffort Optional: Asks Dgraph Alpha to try to get timestamps from memory on a best-effort basis to reduce the number of outbound requests to Zero. This may yield improved latencies in read-bound workloads where linearizable reads are not strictly needed.
 * @property { number } [timeout=600] DEFAULT is 600: Max seconds any query of this transaction will be allowed to be attempted
 */


/**
 * @typedef { Object } DgraphAPIHeaders
 * @prop { string } X-Auth-Token - For Dgraph Cloud’s API key authentication (where you pass in any API key you would generate from the “API Keys” tab on the Settings page). The API key passed can be one of two kinds: Admin API key or Client API key. 
 * @prop { enumContentType= } Content-Type - application/rdf for .mutate(), application/dql for .query() and application/json for .commit(), 
*/


/**
 * @typedef { Object } DgraphExtensionsTxn
 * @prop { number } start_ts - Start timestamp that uniquely identifies a transaction and doesn’t change over the transaction lifecycle
 * @prop { string } hash
 * @prop { string[] } keys - The set of keys modified by the transaction. Aids in transaction conflict detection. Every mutation sends back a new set of keys. `this.#mergeArrays` merges the response keys with the existing keys.
 * @prop { string[] } preds - The set of predicates modified by the transaction. Aids in predicate move detection. Every mutation sends back a new set of preds. `this.#mergeArrays` merges the response preds with the existing preds.
 * @prop { boolean } readOnly
 * @prop { boolean= } aborted
 */


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
