import { useState, useEffect, useCallback, useRef } from 'react';
import { serialService, type SerialOptions } from '../services/SerialService';
import { ProtocolParser } from '../utils/ProtocolParser';

export interface ScaleState {
    weight: number;
    unit: 'kg' | 'lb';
    isStable: boolean;
    isZero: boolean;
    isNet: boolean;
    isConnected: boolean;
    isConnecting: boolean;
    error: string | null;
    lastReceived: Date | null;
    rawBuffer: string[]; // For debug window
}

export function useScale() {
    const [state, setState] = useState<ScaleState>({
        weight: 0,
        unit: 'kg',
        isStable: true,
        isZero: true,
        isNet: false,
        isConnected: false,
        isConnecting: false,
        error: null,
        lastReceived: null,
        rawBuffer: []
    });

    const parser = useRef(new ProtocolParser());

    const handleData = useCallback((chunk: Uint8Array) => {
        // Watchdog removed for Send-on-Change protocol support
        // The scale only sends data when weight changes, so silence is normal.

        const results = parser.current.parse(chunk);

        // Add to raw buffer (keep last 20 lines)
        const text = new TextDecoder().decode(chunk);

        setState(prev => {
            const newBuffer = [...prev.rawBuffer, text].slice(-20);

            // Process parsed results
            // We take the latest valid result
            const latest = results[results.length - 1];

            if (!latest) {
                return { ...prev, rawBuffer: newBuffer, lastReceived: new Date() };
            }

            if (latest.error) {
                return {
                    ...prev,
                    error: latest.error,
                    rawBuffer: newBuffer,
                    lastReceived: new Date()
                };
            }

            return {
                ...prev,
                weight: latest.weight,
                unit: latest.unit,
                isStable: latest.isStable,
                isZero: latest.isZero,
                isNet: latest.isNet,
                error: null, // Clear error on valid data
                rawBuffer: newBuffer,
                lastReceived: new Date()
            };
        });
    }, []);

    const handleError = useCallback((err: Error) => {
        setState(s => ({ ...s, error: `Error de Puerto: ${err.message}`, isConnected: false, isConnecting: false }));
    }, []);

    useEffect(() => {
        serialService.setOnData(handleData);
        serialService.setOnError(handleError);
        return () => {
            // Cleanup
        };
    }, [handleData, handleError]);

    const connect = async (options: SerialOptions = { baudRate: 9600, dataBits: 8, parity: 'none', stopBits: 1 }) => {
        setState(s => ({ ...s, isConnecting: true, error: null }));
        try {
            const granted = await serialService.requestPort();
            if (granted) {
                await serialService.open(options);
                // Send 'W' to initiate data transmission (Type 2/3 Protocol)
                await serialService.send('W');
                setState(s => ({ ...s, isConnected: true, isConnecting: false }));
            } else {
                setState(s => ({ ...s, isConnecting: false }));
            }
        } catch (err) {
            console.error(err);
            // Error handled by callback
        }
    };

    const disconnect = async () => {
        try {
            await serialService.close();
            setState(s => ({ ...s, isConnected: false, isConnecting: false }));
        } catch (err) {
            console.error(err);
        }
    };

    return {
        ...state,
        connect,
        disconnect
    };
}
