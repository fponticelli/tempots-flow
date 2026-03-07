import { createSmoothStepStrategy } from '@tempots/flow/edges'
import { makeDirectionalScenarios } from './helpers'

export const smoothStepPathScenarios = makeDirectionalScenarios('smooth-step', createSmoothStepStrategy)
