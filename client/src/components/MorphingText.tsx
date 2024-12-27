import { cn } from '@nextui-org/react'
import { FC, useEffect, useRef, useState } from 'react'

export const MorphingText: FC<{
  texts: [string, string]
  classNames?: {
    container?: string
    text?: string
  }
  morphTime?: number
}> = ({ texts, classNames = {}, morphTime = 1 }) => {
  const text1Ref = useRef<HTMLSpanElement>(null)
  const text2Ref = useRef<HTMLSpanElement>(null)
  const [currentTexts, setCurrentTexts] = useState(texts)
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    if (texts[0] !== currentTexts[0] || texts[1] !== currentTexts[1]) {
      setCurrentTexts(texts)
      setIsAnimating(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texts])

  useEffect(() => {
    if (
      text1Ref.current === null ||
      text2Ref.current === null ||
      !isAnimating
    ) {
      return
    }

    let morph = 0
    let animationFrameId: number

    const setMorph = (fraction: number) => {
      if (text1Ref.current === null || text2Ref.current === null) return

      // Text1 starts visible (old text) and fades out
      text1Ref.current!.style.filter = `blur(${Math.min(8 / (1 - fraction) - 8, 100)}px)`
      text1Ref.current!.style.opacity = `${Math.pow(1 - fraction, 0.4) * 100}%`

      // Text2 starts invisible (new text) and fades in
      text2Ref.current!.style.filter = `blur(${Math.min(8 / fraction - 8, 100)}px)`
      text2Ref.current!.style.opacity = `${Math.pow(fraction, 0.4) * 100}%`
    }

    const animate = () => {
      morph += 0.016 // Roughly 60fps
      const fraction = morph / morphTime

      if (fraction < 1) {
        setMorph(fraction)
        animationFrameId = requestAnimationFrame(animate)
      } else {
        // Animation complete
        text1Ref.current!.style.filter = ''
        text1Ref.current!.style.opacity = '0%'
        text2Ref.current!.style.filter = ''
        text2Ref.current!.style.opacity = '100%'
        setIsAnimating(false)
      }
    }

    // Start animation
    text1Ref.current!.style.filter = ''
    text1Ref.current!.style.opacity = '100%'
    text2Ref.current!.style.filter = ''
    text2Ref.current!.style.opacity = '0%'
    animate()

    return () => {
      cancelAnimationFrame(animationFrameId)
    }
  }, [currentTexts, morphTime, isAnimating])

  return (
    <div className={cn('relative filter-gooey w-full', classNames.container)}>
      {/* Invisible placeholder to maintain height */}
      <span
        className={cn(
          'invisible transition-[font-size] duration-1000',
          classNames.text
        )}
      >
        {currentTexts[1] || <>&nbsp;</>}
      </span>

      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        aria-hidden
      >
        <span
          ref={text1Ref}
          className={cn(
            'absolute inset-0 flex items-center justify-center transition-[font-size] duration-1000',
            classNames.text
          )}
        >
          {currentTexts[0]}
        </span>
        <span
          ref={text2Ref}
          className={cn(
            'absolute inset-0 flex items-center justify-center transition-[font-size] duration-1000',
            classNames.text
          )}
        >
          {currentTexts[1]}
        </span>
      </div>

      <svg className="absolute" style={{ width: 0, height: 0 }}>
        <defs>
          <filter id="gooey-filter">
            <feColorMatrix
              in="SourceGraphic"
              type="matrix"
              values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 255 -140"
            />
          </filter>
        </defs>
      </svg>
    </div>
  )
}
