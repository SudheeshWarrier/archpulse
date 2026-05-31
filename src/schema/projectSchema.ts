import { z } from 'zod'

export const ArchElementSchema = z.object({
  id: z.string(),
  type: z.union([z.literal('node'), z.literal('edge')]),
  domSelector: z.string(),
  interactive: z.boolean().optional()
})

export const AnimationStepSchema = z.object({
  id: z.string(),
  label: z.string(),
  highlight: z.array(z.string()),
  flow: z.array(z.string()),
  nodeAnimation: z.enum(['highlight', 'fade-in', 'scale-up', 'color-change', 'bounce', 'pulse-grow', 'rotate', 'blink']),
  edgeAnimation: z.enum(['draw-path', 'flow', 'fade-in', 'pulse', 'dash-flow', 'glow-pulse', 'wave', 'shimmer']),
  durationMs: z.number()
})

export const ProjectStateSchema = z.object({
  version: z.literal('1.0'),
  svg: z.string(),
  elements: z.record(ArchElementSchema),
  steps: z.array(AnimationStepSchema)
})

export type ProjectState = z.infer<typeof ProjectStateSchema>

export default ProjectStateSchema
