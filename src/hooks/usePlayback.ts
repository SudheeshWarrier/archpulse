import { useState, useEffect, useRef, useCallback } from 'react'

type Speed = 'slow' | 'normal' | 'fast'

export function usePlayback(opts: { stepsCount: number }) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [speed, _setSpeed] = useState<Speed>('normal')
  const [loop, setLoop] = useState(true)
  const timerRef = useRef<number | null>(null)

  const msForSpeed = useCallback((s: Speed) => (s === 'slow' ? 2000 : s === 'fast' ? 500 : 1000), [])

  useEffect(() => {
    if (!isPlaying) {
      if (timerRef.current) {
        window.clearInterval(timerRef.current)
        timerRef.current = null
      }
      return
    }
    const ms = msForSpeed(speed)
    timerRef.current = window.setInterval(() => {
      setCurrentStep((prev) => {
        const next = prev + 1
        if (next >= Math.max(1, opts.stepsCount)) {
          if (loop) return 0
          setIsPlaying(false)
          return prev
        }
        return next
      })
    }, ms)

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [isPlaying, speed, loop, opts.stepsCount, msForSpeed])

  useEffect(() => {
    if (opts.stepsCount === 0 && currentStep !== 0) {
      setCurrentStep(0)
      return
    }
    if (opts.stepsCount > 0 && currentStep >= opts.stepsCount) {
      setCurrentStep(opts.stepsCount - 1)
    }
  }, [currentStep, opts.stepsCount])

  const togglePlay = useCallback(() => setIsPlaying((v) => !v), [])
  const next = useCallback(() => setCurrentStep((s) => Math.min(Math.max(0, opts.stepsCount - 1), s + 1)), [opts.stepsCount])
  const prev = useCallback(() => setCurrentStep((s) => Math.max(0, s - 1)), [])

  const setCurrentStepClamped = useCallback(
    (i: number) => setCurrentStep(Math.max(0, Math.min(Math.max(0, opts.stepsCount - 1), i))),
    [opts.stepsCount]
  )

  return {
    isPlaying,
    togglePlay,
    next,
    prev,
    currentStep,
    setCurrentStep: setCurrentStepClamped,
    speed,
    setSpeed: (s: Speed) => _setSpeed(s),
    loop,
    setLoop: (v: boolean) => setLoop(v)
  }
}
