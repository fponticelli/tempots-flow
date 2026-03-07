import { createBezierStrategy } from '@tempots/flow/edges'
import { makeDirectionalScenarios } from './helpers'

export const bezierPathScenarios = makeDirectionalScenarios('bezier', createBezierStrategy)
