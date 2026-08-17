import { useCallback, useEffect, useRef } from 'react';
import { cn } from '../../utils/cn';

interface ResizeHandleProps {
  direction: 'horizontal' | 'vertical';
  /** Called with pixel delta since the previous move event (not total drag). */
  onResize: (delta: number) => void;
  className?: string;
}

/**
 * Draggable splitter between panels.
 * Uses pointer capture + document listeners so drag keeps working outside the handle.
 */
export function ResizeHandle({ direction, onResize, className }: ResizeHandleProps) {
  const onResizeRef = useRef(onResize);
  useEffect(() => {
    onResizeRef.current = onResize;
  }, [onResize]);

  const dragging = useRef(false);
  const lastPos = useRef(0);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      // Only primary button
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();

      dragging.current = true;
      lastPos.current = direction === 'vertical' ? e.clientX : e.clientY;

      const target = e.currentTarget;
      try {
        target.setPointerCapture(e.pointerId);
      } catch {
        // ignore if capture fails
      }

      const prevUserSelect = document.body.style.userSelect;
      const prevCursor = document.body.style.cursor;
      document.body.style.userSelect = 'none';
      document.body.style.cursor = direction === 'vertical' ? 'col-resize' : 'row-resize';

      const onMove = (ev: PointerEvent) => {
        if (!dragging.current) return;
        const current = direction === 'vertical' ? ev.clientX : ev.clientY;
        const delta = current - lastPos.current;
        if (delta === 0) return;
        lastPos.current = current;
        onResizeRef.current(delta);
      };

      const onUp = (ev: PointerEvent) => {
        dragging.current = false;
        document.body.style.userSelect = prevUserSelect;
        document.body.style.cursor = prevCursor;
        try {
          if (target.hasPointerCapture(ev.pointerId)) {
            target.releasePointerCapture(ev.pointerId);
          }
        } catch {
          // ignore
        }
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        document.removeEventListener('pointercancel', onUp);
      };

      // document so we keep receiving events even if pointer leaves the handle
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
      document.addEventListener('pointercancel', onUp);
    },
    [direction],
  );

  return (
    <div
      role="separator"
      aria-orientation={direction === 'vertical' ? 'vertical' : 'horizontal'}
      tabIndex={0}
      onPointerDown={onPointerDown}
      className={cn(
        'resize-handle relative z-20 shrink-0 touch-none',
        direction === 'vertical'
          ? 'resize-handle-vertical w-1 cursor-col-resize'
          : 'resize-handle-horizontal h-1 cursor-row-resize',
        className,
      )}
    />
  );
}
