import { useCallback, useRef } from 'react';

/**
 * Custom hook for detecting long-press (touch & hold) gestures
 * Used to trigger Magic Breakdown on cards
 * 
 * @param {Function} callback - Function to call when long press is detected
 * @param {Object} options - Configuration options
 * @param {number} options.threshold - Duration in ms to trigger (default: 500)
 * @returns {Object} - Event handlers to spread on the target element
 */
export function useLongPress(callback, options = {}) {
    const { threshold = 500 } = options;
    const timeoutRef = useRef(null);
    const isLongPress = useRef(false);
    const startPosition = useRef({ x: 0, y: 0 });

    const start = useCallback((e) => {
        // Store initial position to detect movement
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        startPosition.current = { x: clientX, y: clientY };

        isLongPress.current = false;

        timeoutRef.current = setTimeout(() => {
            isLongPress.current = true;
            // Haptic feedback if available
            if (navigator.vibrate) {
                navigator.vibrate(50);
            }
            callback(e);
        }, threshold);
    }, [callback, threshold]);

    const move = useCallback((e) => {
        // Cancel if finger/mouse moved too much (user is dragging, not holding)
        if (timeoutRef.current) {
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            const moveThreshold = 10; // pixels

            const deltaX = Math.abs(clientX - startPosition.current.x);
            const deltaY = Math.abs(clientY - startPosition.current.y);

            if (deltaX > moveThreshold || deltaY > moveThreshold) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
        }
    }, []);

    const cancel = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    }, []);

    // Return value indicates if the gesture was a long press (for click prevention)
    const shouldPreventClick = useCallback(() => {
        return isLongPress.current;
    }, []);

    return {
        onMouseDown: start,
        onMouseUp: cancel,
        onMouseLeave: cancel,
        onMouseMove: move,
        onTouchStart: start,
        onTouchEnd: cancel,
        onTouchMove: move,
        shouldPreventClick,
    };
}

export default useLongPress;
