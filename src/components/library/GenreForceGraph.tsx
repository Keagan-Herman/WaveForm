/**
 * GenreForceGraph.tsx
 *
 * D3 force-directed genre graph. The strictest D3/React boundary in the project.
 *
 * THE BOUNDARY RULES — read this before touching this file:
 *
 * 1. React renders ONE thing: the <svg> container element. Nothing else.
 *
 * 2. D3 owns everything inside the SVG. It creates, updates and removes
 *    nodes and links imperatively via selections. React never touches them.
 *
 * 3. The simulation is initialised ONCE in a useRef. It is NEVER recreated
 *    when props change. Data updates go through simulation.nodes() and
 *    simulation.force('link').links() followed by .alpha().restart().
 *
 * 4. On unmount, simulation.stop() is called. Without this the simulation
 *    runs forever in the background consuming CPU.
 *
 * 5. Event handlers (click, hover) are attached via D3's .on() method,
 *    not via React synthetic events. They call the onSelectGenre callback
 *    which is stored in a ref to avoid stale closures.
 *
 * WHY NOT USE A REACT-SPECIFIC D3 WRAPPER:
 * Libraries like react-force-graph abstract this boundary away but add
 * significant bundle weight and reduce control. Doing it directly is
 * harder but produces a cleaner result and is the right thing to show
 * in a portfolio.
 */

import { useRef, useEffect, type FC } from 'react'
import * as d3 from 'd3'
import { useVisualiserStore } from '@/stores/visualiserStore'
import type { GenreNode, GenreLink, GenreGraphData } from '@/lib/genreGraph'

interface GenreForceGraphProps {
  data: GenreGraphData
  width: number
  height: number
  activeGenre: string | null
  onSelectGenre: (genre: string | null) => void
}

// Colour scale — maps genre cluster to a hue
const colorScale = d3.scaleOrdinal(
  d3.schemeTableau10.map(c => {
    // Desaturate Tableau10 slightly to fit the dark theme
    const hsl = d3.hsl(c)
    hsl.s *= 0.7
    hsl.l = 0.55
    return hsl.formatHex()
  })
)

export const GenreForceGraph: FC<GenreForceGraphProps> = ({
  data,
  width,
  height,
  activeGenre,
  onSelectGenre,
}) => {
  const svgRef = useRef<SVGSVGElement>(null)

  // Simulation lives in a ref — never recreated
  const simulationRef = useRef<d3.Simulation<GenreNode, GenreLink> | null>(null)

  // Keep callback in a ref to avoid stale closures in D3 event handlers
  const onSelectRef = useRef(onSelectGenre)
  const activeGenreRef = useRef(activeGenre)

  useEffect(() => {
    onSelectRef.current = onSelectGenre
  }, [onSelectGenre])

  useEffect(() => {
    activeGenreRef.current = activeGenre
  }, [activeGenre])

  // ── Initialise simulation once on mount ───────────────────────────────
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    // Clear any previous content (handles strict mode double-mount)
    d3.select(svg).selectAll('*').remove()

    // Root group — we'll zoom/pan this later if needed
    const g = d3.select(svg).append('g').attr('class', 'root')

    // Link layer (behind nodes)
    g.append('g').attr('class', 'links')
    // Node layer
    g.append('g').attr('class', 'nodes')
    // Label layer (on top)
    g.append('g').attr('class', 'labels')

    // Initialise simulation with empty data — data is set in the second effect
    const simulation = d3
      .forceSimulation<GenreNode>([])
      .force(
        'link',
        d3
          .forceLink<GenreNode, GenreLink>([])
          .id(d => d.id)
          .distance(d => 80 - (d.weight as number) * 8) // closer = more shared artists
          .strength(0.4)
      )
      .force('charge', d3.forceManyBody().strength(-120))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force(
        'collision',
        d3.forceCollide<GenreNode>().radius(d => nodeRadius(d) + 4)
      )
      .alphaDecay(0.03) // slower decay = more time to settle
      .velocityDecay(0.4) // more damping = less jitter

    simulationRef.current = simulation

    // Tick handler — D3 calls this on every simulation step
    simulation.on('tick', () => {
      const root = d3.select(svg).select('g.root')
      const { bassPower, beat } = useVisualiserStore.getState()

      root
        .select('g.links')
        .selectAll<SVGLineElement, GenreLink>('line')
        .attr('x1', d => (d.source as GenreNode).x ?? 0)
        .attr('y1', d => (d.source as GenreNode).y ?? 0)
        .attr('x2', d => (d.target as GenreNode).x ?? 0)
        .attr('y2', d => (d.target as GenreNode).y ?? 0)
        .attr('stroke-opacity', 0.2 + bassPower * 0.4)
        .attr('stroke', beat ? '#fff' : 'rgba(232,245,232,0.1)')

      root
        .select('g.nodes')
        .selectAll<SVGCircleElement, GenreNode>('circle')
        .attr('cx', d => clamp(d.x ?? 0, 20, width - 20))
        .attr('cy', d => clamp(d.y ?? 0, 20, height - 20))
        .attr('r', d => nodeRadius(d) * (1 + bassPower * 0.15))

      root
        .select('g.labels')
        .selectAll<SVGTextElement, GenreNode>('text')
        .attr('x', d => clamp(d.x ?? 0, 20, width - 20))
        .attr(
          'y',
          d => clamp(d.y ?? 0, 20, height - 20) + nodeRadius(d) * (1 + bassPower * 0.15) + 10
        )
        .attr('opacity', 0.5 + bassPower * 0.5)
    })

    // Drag behaviour
    const drag = d3
      .drag<SVGCircleElement, GenreNode>()
      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart()
        d.fx = d.x
        d.fy = d.y
      })
      .on('drag', (event, d) => {
        d.fx = event.x
        d.fy = event.y
      })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0)
        d.fx = null
        d.fy = null
      })

    // Store drag on the svg element so the data effect can access it
    ;(svg as SVGSVGElement & { __drag?: typeof drag }).__drag = drag

    return () => {
      simulation.stop()
      simulationRef.current = null
      d3.select(svg).selectAll('*').remove()
    }
  }, [width, height]) // Only re-initialise if dimensions change

  // ── Update data without recreating the simulation ─────────────────────
  useEffect(() => {
    const svg = svgRef.current
    const simulation = simulationRef.current
    if (!svg || !simulation) return

    const { nodes, links } = data
    const drag = (
      svg as SVGSVGElement & {
        __drag?: d3.DragBehavior<SVGCircleElement, GenreNode, GenreNode | d3.SubjectPosition>
      }
    ).__drag

    const root = d3.select(svg).select('g.root')

    // ── Links ────────────────────────────────────────────────────────────
    const linkSel = root
      .select('g.links')
      .selectAll<SVGLineElement, GenreLink>('line')
      .data(links, d => {
        const s = typeof d.source === 'string' ? d.source : d.source.id
        const t = typeof d.target === 'string' ? d.target : d.target.id
        return `${s}||${t}`
      })

    linkSel.exit().remove()

    linkSel
      .enter()
      .append('line')
      .merge(linkSel as d3.Selection<SVGLineElement, GenreLink, SVGGElement, unknown>)
      .attr('stroke', 'rgba(232,245,232,0.08)')
      .attr('stroke-width', d => Math.min((d.weight as number) * 0.8, 3))

    // ── Nodes ────────────────────────────────────────────────────────────
    const nodeSel = root
      .select('g.nodes')
      .selectAll<SVGCircleElement, GenreNode>('circle')
      .data(nodes, d => d.id)

    nodeSel.exit().transition().duration(300).attr('r', 0).style('opacity', 0).remove()

    const nodeEnter = nodeSel
      .enter()
      .append('circle')
      .attr('r', 0)
      .style('opacity', 0)
      .style('cursor', 'pointer')
      .on('click', (_event, d) => {
        const current = activeGenreRef.current
        onSelectRef.current(current === d.id ? null : d.id)
      })
      .on('mouseenter', function (_event, d) {
        d3.select(this)
          .transition()
          .duration(150)
          .attr('r', nodeRadius(d) * 1.25)
      })
      .on('mouseleave', function (_event, d) {
        d3.select(this).transition().duration(150).attr('r', nodeRadius(d))
      })

    if (drag) nodeEnter.call(drag)

    nodeEnter
      .transition()
      .duration(400)
      .attr('r', d => nodeRadius(d))
      .style('opacity', 1)

    // Merge enter + update
    root
      .select('g.nodes')
      .selectAll<SVGCircleElement, GenreNode>('circle')
      .attr('fill', d => colorScale(d.id))
      .attr('stroke', d => (activeGenreRef.current === d.id ? '#fff' : 'rgba(255,255,255,0.15)'))
      .attr('stroke-width', d => (activeGenreRef.current === d.id ? 2 : 1))

    // ── Labels ───────────────────────────────────────────────────────────
    const labelSel = root
      .select('g.labels')
      .selectAll<SVGTextElement, GenreNode>('text')
      .data(nodes, d => d.id)

    labelSel.exit().transition().duration(200).style('opacity', 0).remove()

    labelSel
      .enter()
      .append('text')
      .style('opacity', 0)
      .text(d => d.label)
      .transition()
      .duration(400)
      .style('opacity', 1)

    root
      .select('g.labels')
      .selectAll<SVGTextElement, GenreNode>('text')
      .attr('text-anchor', 'middle')
      .attr('fill', d => (activeGenreRef.current === d.id ? '#fff' : 'rgba(232,245,232,0.45)'))
      .style('font-size', d => `${Math.max(9, Math.min(11, 8 + d.count))}px`)
      .style('font-family', 'monospace')
      .style('pointer-events', 'none')
      .style('user-select', 'none')
      .text(d => d.label)

    // ── Feed updated data into simulation ────────────────────────────────
    // This is the key: we update the simulation's data in-place rather
    // than recreating the simulation. Existing nodes keep their positions.
    simulation.nodes(nodes)
    const linkForce = simulation.force<d3.ForceLink<GenreNode, GenreLink>>('link')
    linkForce?.links(links)

    // Gentle restart — alpha 0.3 settles quickly without a violent reshuffle
    simulation.alpha(0.3).restart()
  }, [data]) // Runs when data changes — simulation ref is stable

  // ── Update active genre styling without restarting simulation ─────────
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    d3.select(svg)
      .select('g.nodes')
      .selectAll<SVGCircleElement, GenreNode>('circle')
      .transition()
      .duration(300)
      .attr('stroke', d => (activeGenre === d.id ? '#fff' : 'rgba(255,255,255,0.15)'))
      .attr('stroke-width', d => (activeGenre === d.id ? 2 : 1))
      .style('opacity', d => (activeGenre === null || activeGenre === d.id ? 1 : 0.15))

    d3.select(svg)
      .select('g.labels')
      .selectAll<SVGTextElement, GenreNode>('text')
      .transition()
      .duration(300)
      .attr('fill', d => (activeGenre === d.id ? '#fff' : 'rgba(232,245,232,0.45)'))
      .style('opacity', d => (activeGenre === null || activeGenre === d.id ? 1 : 0.05))

    d3.select(svg)
      .select('g.links')
      .selectAll<SVGLineElement, GenreLink>('line')
      .transition()
      .duration(300)
      .style('opacity', d => {
        if (activeGenre === null) return 1
        const s = typeof d.source === 'string' ? d.source : d.source.id
        const t = typeof d.target === 'string' ? d.target : d.target.id
        return s === activeGenre || t === activeGenre ? 1 : 0.02
      })
  }, [activeGenre]) // Styling only — no simulation touch

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      style={{ display: 'block', overflow: 'visible' }}
      aria-label="Genre relationship graph"
      role="img"
    />
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────

function nodeRadius(d: GenreNode): number {
  // Base 6px + up to 10px based on track count
  return 6 + Math.min(d.count * 2, 10)
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
