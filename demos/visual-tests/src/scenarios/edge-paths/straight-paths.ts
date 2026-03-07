import { createStraightStrategy } from '@tempots/flow/edges'
import { makeDirectionalScenarios } from './helpers'

export const straightPathScenarios = makeDirectionalScenarios('straight', createStraightStrategy)
