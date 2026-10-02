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

const SIZES = '(min-width: 1296px) 1136px, (min-width: 1024px) calc(100vw - 8rem), 960px'

export function Showcase({ slides, backdrop }: { slides: Slide[]; backdrop: string }) {
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
            className="body h-auto flex-none px-3 pt-1 pb-3 after:hidden data-active:text-foreground"
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
      <div className="stage stage-photo mt-5" style={{ backgroundImage: `url(${backdrop})` }}>
        <div className="grid rounded-lg *:col-start-1 *:row-start-1 max-lg:overflow-x-auto max-lg:overscroll-x-contain">
          {slides.map((slide, index) => (
            <TabsContent key={slide.id} value={slide.id} className="text-base">
              <img
                className="shot slide-in max-lg:min-w-[60rem]"
                src={slide.image.src}
                srcSet={slide.image.srcset}
                sizes={SIZES}
                width={slide.image.width}
                height={slide.image.height}
                alt={slide.alt}
                loading={index === 0 ? 'eager' : 'lazy'}
                fetchPriority={index === 0 ? 'high' : undefined}
              />
            </TabsContent>
          ))}
        </div>
      </div>
      <p aria-live="polite" className="body mt-5 max-w-[68ch] text-muted-foreground">
        <span className="font-medium text-foreground">
          {slides.find((slide) => slide.id === active)?.label}.
        </span>{' '}
        {slides.find((slide) => slide.id === active)?.caption}
      </p>
      <p className="body mt-1 text-muted-foreground">
        The agent sessions in these captures are scripted stand-ins running in the real app.
      </p>
    </Tabs>
  )
}
