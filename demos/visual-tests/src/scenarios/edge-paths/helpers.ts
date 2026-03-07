import type { EdgeRoutingStrategy } from '@tempots/flow'
import type { TestScenario } from '../../types'
import { makeNode, makeEdge, makeGraph } from '../helpers'
import { manualLayout } from '@tempots/flow/layouts'

interface DirectionConfig {
  readonly suffix: string
  readonly label: string
  readonly portPlacement: 'horizontal' | 'vertical'
  readonly sourcePos: { x: number; y: number }
  readonly targetPos: { x: number; y: number }
}

const directions: readonly DirectionConfig[] = [
  { suffix: 'lr', label: 'Left→Right', portPlacement: 'horizontal', sourcePos: { x: 50, y: 150 }, targetPos: { x: 450, y: 300 } },
  { suffix: 'rl', label: 'Right→Left', portPlacement: 'horizontal', sourcePos: { x: 450, y: 150 }, targetPos: { x: 50, y: 300 } },
  { suffix: 'tb', label: 'Top→Bottom', portPlacement: 'vertical', sourcePos: { x: 200, y: 50 }, targetPos: { x: 350, y: 400 } },
  { suffix: 'bt', label: 'Bottom→Top', portPlacement: 'vertical', sourcePos: { x: 200, y: 400 }, targetPos: { x: 350, y: 50 } },
]

export function makeDirectionalScenarios(
  strategyName: string,
  createStrategy: () => EdgeRoutingStrategy,
  bundled?: boolean,
): TestScenario[] {
  return directions.map((dir) => {
    const nodes = bundled
      ? [
          makeNode('a', 'Source', [], ['out1', 'out2', 'out3']),
          makeNode('b', 'Target', ['in1', 'in2', 'in3'], []),
        ]
      : [
          makeNode('a', 'Source', [], ['out']),
          makeNode('b', 'Target', ['in'], []),
        ]

    const edges = bundled
      ? [
          makeEdge('e1', 'a', 'out1', 'b', 'in1'),
          makeEdge('e2', 'a', 'out2', 'b', 'in2'),
          makeEdge('e3', 'a', 'out3', 'b', 'in3'),
        ]
      : [makeEdge('e1', 'a', 'out', 'b', 'in')]

    return {
      id: `edge-paths--${strategyName}-${dir.suffix}`,
      name: `${strategyName} ${dir.label}`,
      category: 'edge-paths',
      description: `${strategyName} edge routing, ${dir.label} direction`,
      graph: makeGraph(nodes, edges),
      config: {
        edgeRouting: createStrategy(),
        layout: manualLayout,
        portPlacement: dir.portPlacement,
        grid: false,
        fitViewOnInit: true,
        initialPositions: new Map([
          ['a', dir.sourcePos],
          ['b', dir.targetPos],
        ]),
      },
    }
  })
}
