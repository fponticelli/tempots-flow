import { createOrthogonalStrategy } from '@tempots/flow/edges'
import { makeDirectionalScenarios } from './helpers'

export const orthogonalPathScenarios = makeDirectionalScenarios('orthogonal', createOrthogonalStrategy)
