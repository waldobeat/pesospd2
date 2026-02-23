

// Since SerialOptions is used in interface, we export it.
export interface SerialOptions {
    baudRate: number;
    dataBits: 7 | 8;
    stopBits: 1 | 2;
    parity: "none" | "even" | "odd";
}

export class SerialService {
    private port: SerialPort | null = null;
    private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
    private onDataCallback: ((data: Uint8Array) => void) | null = null;
    private onErrorCallback: ((error: Error) => void) | null = null;

    constructor() {
        if (!("serial" in navigator)) {
            console.error("Web Serial API not supported in this browser.");
        }
    }

    async requestPort(): Promise<boolean> {
        try {
            this.port = await navigator.serial.requestPort();
            return true;
        } catch (err) {
            console.error("User cancelled port selection or error:", err);
            return false;
        }
    }

    async open(options: SerialOptions): Promise<void> {
        if (!this.port) throw new Error("No port selected");

        // Check if port is already open
        if (this.port.readable) {
            console.warn("Port is already open. Skipping open().");
            return;
        }

        try {
            await this.port.open({
                baudRate: options.baudRate,
                dataBits: options.dataBits,
                stopBits: options.stopBits,
                parity: options.parity,
            });
            this.readLoop();
        } catch (err) {
            console.error("Error opening port:", err);
            if (this.onErrorCallback) this.onErrorCallback(err as Error);
            throw err;
        }
    }

    async close(): Promise<void> {
        if (this.reader) {
            try {
                await this.reader.cancel();
            } catch (e) { console.warn("Error cancelling reader:", e); }
            this.reader = null;
        }
        if (this.port) {
            try {
                await this.port.close();
            } catch (e) { console.warn("Error closing port:", e); }
            this.port = null;
        }
    }

    async send(data: string | Uint8Array): Promise<void> {
        if (!this.port || !this.port.writable) return;

        const writer = this.port.writable.getWriter();
        const payload = typeof data === 'string' ? new TextEncoder().encode(data) : data;

        await writer.write(payload);
        writer.releaseLock();
    }

    emitData(data: Uint8Array) {
        if (this.onDataCallback) {
            this.onDataCallback(data);
        }
    }

    setOnData(callback: (data: Uint8Array) => void) {
        this.onDataCallback = callback;
    }

    setOnError(callback: (error: Error) => void) {
        this.onErrorCallback = callback;
    }

    private async readLoop() {
        if (!this.port || !this.port.readable) return;

        try {
            this.reader = this.port.readable.getReader();

            while (true) {
                const { value, done } = await this.reader.read();
                if (done) break;
                if (value && this.onDataCallback) {
                    try {
                        this.onDataCallback(value);
                    } catch (cbErr) {
                        console.error("Error in onDataCallback:", cbErr);
                        // Do not crash the loop!
                    }
                }
            }
        } catch (err) {
            console.error("Read Error:", err);
            if (this.onErrorCallback) this.onErrorCallback(err as Error);
        } finally {
            if (this.reader) {
                this.reader.releaseLock();
                this.reader = null;
            }
        }
    }
}

export const serialService = new SerialService();
