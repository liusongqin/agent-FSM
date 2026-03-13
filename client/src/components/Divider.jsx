import React, { useRef, useCallback, useState } from 'react';

export default function Divider({ direction, onDrag }) {
  const [dragging, setDragging] = useState(false);
  const lastPos = useRef(0);

  const onMouseDown = useCallback(
    (e) => {
      e.preventDefault();
      setDragging(true);
      lastPos.current = direction === 'vertical' ? e.clientX : e.clientY;

      const onMouseMove = (e2) => {
        const current = direction === 'vertical' ? e2.clientX : e2.clientY;
        const delta = current - lastPos.current;
        lastPos.current = current;
        onDrag(delta);
      };

      const onMouseUp = () => {
        setDragging(false);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    },
    [direction, onDrag]
  );

  return (
    <div
      className={`divider divider-${direction} ${dragging ? 'dragging' : ''}`}
      onMouseDown={onMouseDown}
    />
  );
}
