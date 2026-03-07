import { createStepStrategy } from '@tempots/flow/edges'
import { makeDirectionalScenarios } from './helpers'

export const stepPathScenarios = makeDirectionalScenarios('step', createStepStrategy)
