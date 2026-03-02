import type { PortDirection } from '../types/graph'
import type {
  Position,
  Dimensions,
  ComputedPortPosition,
  PortSide,
  PortPlacement,
} from '../types/layout'

const HEADER_HEIGHT = 32
const PORT_VERTICAL_GAP = 24
const PORT_FIRST_OFFSET = 16
const PORT_HORIZONTAL_GAP = 24

export function computePortPosition(
  nodePos: Position,
  nodeDims: Dimensions,
  portDirection: PortDirection,
  portIndex: number,
  totalPorts: number,
  portPlacement: PortPlacement = 'horizontal',
): ComputedPortPosition {
  if (portPlacement === 'vertical') {
    const side: PortSide = portDirection === 'input' ? 'top' : 'bottom'
    const totalWidth = (totalPorts - 1) * PORT_HORIZONTAL_GAP
    const startX = nodePos.x + nodeDims.width / 2 - totalWidth / 2
    const x =
      totalPorts === 1 ? nodePos.x + nodeDims.width / 2 : startX + portIndex * PORT_HORIZONTAL_GAP
    const y = side === 'top' ? nodePos.y : nodePos.y + nodeDims.height

    return { x, y, side }
  }

  const side: PortSide = portDirection === 'input' ? 'left' : 'right'
  const x = side === 'left' ? nodePos.x : nodePos.x + nodeDims.width
  const y = nodePos.y + HEADER_HEIGHT + PORT_FIRST_OFFSET + portIndex * PORT_VERTICAL_GAP

  return { x, y, side }
}

export function computePortPositionsForNode(
  nodePos: Position,
  nodeDims: Dimensions,
  ports: readonly { readonly id: string; readonly direction: PortDirection }[],
  portPlacement: PortPlacement = 'horizontal',
): ReadonlyMap<string, ComputedPortPosition> {
  const result = new Map<string, ComputedPortPosition>()
  let inputIndex = 0
  let outputIndex = 0

  const inputCount = ports.filter((p) => p.direction === 'input').length
  const outputCount = ports.filter((p) => p.direction === 'output').length

  for (const port of ports) {
    const index = port.direction === 'input' ? inputIndex++ : outputIndex++
    const totalForDirection = port.direction === 'input' ? inputCount : outputCount
    result.set(
      port.id,
      computePortPosition(
        nodePos,
        nodeDims,
        port.direction,
        index,
        totalForDirection,
        portPlacement,
      ),
    )
  }

  return result
}
