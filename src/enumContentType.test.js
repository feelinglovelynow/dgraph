import { test, expect } from '@jest/globals'
import { enumContentType } from './enumContentType.js'


test('enumContentType equals', () => {
  expect(enumContentType).toEqual({ dql: 'application/dql', json: 'application/json', rdf: 'application/rdf' })
})
