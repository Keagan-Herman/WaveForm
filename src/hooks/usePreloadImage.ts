import { useEffect } from 'react'

export function usePreloadImage(url: string | null): void {
  useEffect(() => {
    if (!url) return
    const img = new Image()
    img.src = url
  }, [url])
}
