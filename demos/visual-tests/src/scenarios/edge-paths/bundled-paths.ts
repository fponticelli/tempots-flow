import { createBundledStrategy } from '@tempots/flow/edges'
import { makeDirectionalScenarios } from './helpers'

export const bundledPathScenarios = makeDirectionalScenarios('bundled', createBundledStrategy, true)
