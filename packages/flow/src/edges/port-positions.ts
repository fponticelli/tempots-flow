import type { PortDirection } from '../types/graph'
import type { Position, Dimensions, ComputedPortPosition, PortSide } from '../types/layout'

const HEADER_HEIGHT = 32
const PORT_VERTICAL_GAP = 24
const PORT_FIRST_OFFSET = 16

export function computePortPosition(
  nodePos: Position,
  nodeDims: Dimensions,
  portDirection: PortDirection,
  portIndex: number,
  _totalPorts: number,
): ComputedPortPosition {
  const side: PortSide = portDirection === 'input' ? 'left' : 'right'
  const x = side === 'left' ? nodePos.x : nodePos.x + nodeDims.width
  const y = nodePos.y + HEADER_HEIGHT + PORT_FIRST_OFFSET + portIndex * PORT_VERTICAL_GAP

  return { x, y, side }
}

export function computePortPositionsForNode(
  nodePos: Position,
  nodeDims: Dimensions,
  ports: readonly { readonly id: string; readonly direction: PortDirection }[],
): ReadonlyMap<string, ComputedPortPosition> {
  const result = new Map<string, ComputedPortPosition>()
  let inputIndex = 0
  let outputIndex = 0

  for (const port of ports) {
    const index = port.direction === 'input' ? inputIndex++ : outputIndex++
    const totalForDirection = ports.filter((p) => p.direction === port.direction).length
    result.set(
      port.id,
      computePortPosition(nodePos, nodeDims, port.direction, index, totalForDirection),
    )
  }

  return result
}
