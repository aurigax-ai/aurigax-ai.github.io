import { useEffect, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { ShotSources } from '@/lib/shots'

export interface Slide {
  id: string
  label: string
  caption: string
  alt: string
  image: ShotSources
}

const SIZES = '(min-width: 1296px) 1136px, calc(100vw - 4rem)'

export function Showcase({ slides }: { slides: Slide[] }) {
  const [active, setActive] = useState(slides[0].id)
  const [touring, setTouring] = useState(true)

  useEffect(() => {
    for (const slide of slides.slice(1)) {
      const image = new Image()
      image.sizes = SIZES
      image.srcset = slide.image.srcset
    }
  }, [slides])

  function advance(): void {
    const index = slides.findIndex((slide) => slide.id === active)
    setActive(slides[(index + 1) % slides.length].id)
  }

  return (
    <Tabs
      data-showcase
      value={active}
      onValueChange={(value) => {
        setActive(String(value))
        setTouring(false)
      }}
      className="gap-0"
    >
      <TabsList variant="line" className="h-auto w-full justify-start gap-1 overflow-x-auto p-0 group-data-horizontal/tabs:h-auto">
        {slides.map((slide) => (
          <TabsTrigger
            key={slide.id}
            value={slide.id}
            className="h-auto flex-none px-3 pt-1 pb-3 text-[0.9375rem] after:hidden data-active:text-foreground"
          >
            {slide.label}
            <span aria-hidden="true" className="absolute inset-x-3 bottom-0 h-0.5 overflow-hidden rounded-full bg-border">
              {slide.id === active ? (
                <span
                  key={touring ? 'tour' : 'held'}
                  onAnimationEnd={touring ? advance : undefined}
                  className={`block h-full origin-left bg-foreground ${touring ? 'progress-run' : ''}`}
                />
              ) : null}
            </span>
          </TabsTrigger>
        ))}
      </TabsList>
      <div className="stage pan mt-5 grid *:col-start-1 *:row-start-1">
        {slides.map((slide, index) => (
          <TabsContent key={slide.id} value={slide.id} className="text-base">
            <img
              className="shot slide-in max-md:min-w-[46rem]"
              src={slide.image.src}
              srcSet={slide.image.srcset}
              sizes={SIZES}
              width={slide.image.width}
              height={slide.image.height}
              alt={slide.alt}
              loading={index === 0 ? 'eager' : 'lazy'}
              fetchPriority={index === 0 ? 'high' : undefined}
            />
            <p className="sticky left-0 mx-auto mt-5 max-w-[64ch] text-center text-[0.9375rem] leading-relaxed text-muted-foreground">
              {slide.caption}
            </p>
          </TabsContent>
        ))}
      </div>
    </Tabs>
  )
}
