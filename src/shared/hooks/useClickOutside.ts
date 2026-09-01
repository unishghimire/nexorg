import { useEffect, RefObject } from 'react';

/**
 * Hook that alerts clicks outside of the passed ref.
 * 
 * @param ref React ref object of the element to detect outside clicks for
 * @param handler Function to call when an outside click is detected
 */
export function useClickOutside(ref: RefObject<HTMLElement>, handler: () => void) {
    useEffect(() => {
        const listener = (event: MouseEvent | TouchEvent) => {
            // Do nothing if clicking ref's element or descendent elements
            if (!ref.current || ref.current.contains(event.target as Node)) {
                return;
            }
            handler();
        };

        // Bind the event listener
        document.addEventListener('mousedown', listener);
        document.addEventListener('touchstart', listener);

        // Unbind the event listener on clean up
        return () => {
            document.removeEventListener('mousedown', listener);
            document.removeEventListener('touchstart', listener);
        };
    }, [ref, handler]);
}
