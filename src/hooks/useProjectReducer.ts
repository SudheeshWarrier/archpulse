import { useReducer, type Dispatch } from 'react'
import { ArchElement, AnimationStep, ProjectState } from '../types'

const initialState: ProjectState = {
  version: '1.0',
  svg: '',
  elements: {},
  steps: []
}

type Action =
  | { type: 'SET_SVG'; payload: { svg: string; elements: Record<string, ArchElement> } }
  | { type: 'SET_PROJECT'; payload: ProjectState }
  | { type: 'ADD_STEP'; payload?: Partial<AnimationStep> }
  | { type: 'REMOVE_STEP'; payload: string }
  | { type: 'REORDER_STEPS'; payload: string[] }
  | { type: 'UPDATE_STEP'; payload: { stepId: string; label?: string } }
  | { type: 'ASSIGN_ELEMENT'; payload: { stepId: string; elementId: string } }
  | { type: 'UNASSIGN_ELEMENT'; payload: { stepId: string; elementId: string } }
  | { type: 'SET_STEPS'; payload: AnimationStep[] }

function toggleInList(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id]
}

function reducer(state: ProjectState, action: Action): ProjectState {
  switch (action.type) {
    case 'SET_SVG':
      return { ...state, svg: action.payload.svg, elements: action.payload.elements }
    case 'ADD_STEP': {
      const id = `step-${Date.now()}-${state.steps.length + 1}`
      const step: AnimationStep = {
        id,
        label: action.payload?.label ?? `Animation ${state.steps.length + 1}`,
        highlight: action.payload?.highlight ?? [],
        flow: action.payload?.flow ?? [],
        durationMs: action.payload?.durationMs ?? 1200
      }
      return { ...state, steps: [...state.steps, step] }
    }
    case 'REMOVE_STEP':
      return { ...state, steps: state.steps.filter((s) => s.id !== action.payload) }
    case 'REORDER_STEPS':
      return {
        ...state,
        steps: action.payload.map((id) => state.steps.find((s) => s.id === id)!).filter(Boolean)
      }
    case 'UPDATE_STEP':
      return {
        ...state,
        steps: state.steps.map((s) =>
          s.id === action.payload.stepId ? { ...s, label: action.payload.label ?? s.label } : s
        )
      }
    case 'ASSIGN_ELEMENT': {
      const { stepId, elementId } = action.payload
      const element = state.elements[elementId]
      if (!element) return state

      return {
        ...state,
        steps: state.steps.map((s) => {
          if (s.id !== stepId) return s

          if (element.type === 'edge') {
            const flow = toggleInList(s.flow, elementId)
            return { ...s, flow }
          }

          const highlight = toggleInList(s.highlight, elementId)
          return { ...s, highlight }
        })
      }
    }
    case 'UNASSIGN_ELEMENT': {
      const { stepId, elementId } = action.payload
      return {
        ...state,
        steps: state.steps.map((s) =>
          s.id === stepId
            ? {
                ...s,
                highlight: s.highlight.filter((id) => id !== elementId),
                flow: s.flow.filter((id) => id !== elementId)
              }
            : s
        )
      }
    }
    case 'SET_STEPS':
      return { ...state, steps: action.payload }
    case 'SET_PROJECT':
      return action.payload
    default:
      return state
  }
}

export function useProjectReducer() {
  return useReducer(reducer, initialState)
}

export type ProjectDispatch = Dispatch<Action>
