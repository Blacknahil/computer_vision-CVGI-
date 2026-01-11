import { useState, useEffect, useRef,useCallback } from 'react';
import { DynamicSmoothingAgent } from '../utils/smoother';

export interface HandData {
    detected: boolean;
    x: number;       // 0-1 (Smoothed)
    y: number;       // 0-1 (Smoothed)
    shooting: boolean;
    image: string;   // Base64 image
}

export default function useHandControl(url: string = 'ws://localhost:8765') {
    const [data, setData] = useState<HandData>({
        detected: false,
        x: 0.5,
        y: 0.5,
        shooting: false,
        image: ''
    });

    const ws = useRef<WebSocket | null>(null);
    const reconnectTimeout = useRef<number | undefined>(undefined);

    // Smoothing agents for X and Y
    const smoothX = useRef(new DynamicSmoothingAgent(0.5));
    const smoothY = useRef(new DynamicSmoothingAgent(0.5));

const toggleFilter = useCallback((isEnabled: boolean) => {
        if (ws.current?.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({ type: 'SET_FILTER', value: isEnabled }));
        }
    }, []);

    useEffect(() => {
        let isComponentMounted = true;

        function connect() {
            if (!isComponentMounted) return;

            ws.current = new WebSocket(url);

            ws.current.onopen = () => {
                console.log('Connected to Hand Controller');
            };

            ws.current.onmessage = (event) => {
                try {
                    const parsed = JSON.parse(event.data);
                    if (parsed.detected !== undefined) {

                        let finalX = 0.5;
                        let finalY = 0.5;

                        if (parsed.detected) {
                            // Apply smoothing
                            finalX = smoothX.current.update(parsed.x);
                            finalY = smoothY.current.update(parsed.y);
                        } else {
                            // If lost, maybe slowly drift to center or just hold?
                            // Let's hold last known or center. 
                            // Resetting leads to jumping if hand flickers.
                            // Let's just keep last smoothed value if not detected, or drift to center?
                            // For now, let's just not update the smoothing targets if not detected? 
                            // Actually, let's just use the parsed values if available, or defaults.
                            // If not detected, parsed.x/y might be static.
                        }

                        setData({
                            detected: parsed.detected,
                            x: finalX,
                            y: finalY,
                            shooting: parsed.shooting,
                            image: parsed.image || ''
                        });
                    }
                } catch (e) {
                    console.error('Failed to parse hand data', e);
                }
            };

            ws.current.onclose = () => {
                console.log('Disconnected from Hand Controller. Retrying in 2s...');
                reconnectTimeout.current = setTimeout(connect, 2000);
            };

            ws.current.onerror = (err) => {
                console.error('WebSocket error:', err);
                ws.current?.close();
            };
        }

        connect();
        return () => {
            isComponentMounted = false;
            ws.current?.close();
            clearTimeout(reconnectTimeout.current);
        }

        return () => {
            ws.current?.close();
            clearTimeout(reconnectTimeout.current);
        };
    }, [url]);

    return {data, toggleFilter};
}
